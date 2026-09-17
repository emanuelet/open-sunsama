/**
 * ClickUp task-source provider (API v2, personal API token).
 *
 * Read-only and one task at a time: the user pastes a link or an id, we
 * fetch that task. Nothing is written back to ClickUp, and nothing polls.
 */
import type {
  CredentialField,
  ExternalTask,
  TaskProvider,
  VerifiedAccount,
} from "./index.js";
import {
  ProviderCredentialError,
  ProviderRateLimitError,
  ProviderRequestError,
  ProviderTaskNotFoundError,
} from "./index.js";
import {
  clickUpCredentialSchema,
  isCustomTaskId,
  mapChecklistItems,
  normalizeTask,
  parseClickUpReference,
  type ClickUpCredentials,
  type ClickUpTaskDetail,
  type ClickUpTeamsResponse,
  type ClickUpUserResponse,
} from "./clickup-helpers.js";

const CLICKUP_API = "https://api.clickup.com/api/v2";

export class ClickUpProvider implements TaskProvider {
  readonly id = "clickup";
  readonly displayName = "ClickUp";
  readonly docsUrl =
    "https://clickup.com/api/developer-portal/authentication/#personal-api-token";
  readonly referenceExample = "https://app.clickup.com/t/86abc1234";

  readonly credentialFields: CredentialField[] = [
    {
      key: "token",
      label: "Personal API token",
      type: "password",
      placeholder: "pk_...",
      help: "ClickUp → Settings → Apps → Generate API token",
    },
  ];

  readonly credentialSchema = clickUpCredentialSchema;

  async verifyCredentials(credentials: unknown): Promise<VerifiedAccount> {
    const creds = clickUpCredentialSchema.parse(credentials);

    const [{ user }, { teams }] = await Promise.all([
      this.request<ClickUpUserResponse>(creds.token, "/user"),
      this.request<ClickUpTeamsResponse>(creds.token, "/team"),
    ]);

    if (!teams?.length) {
      throw new ProviderCredentialError(
        this.displayName,
        "the token has no accessible workspaces"
      );
    }

    return {
      providerAccountId: String(user.id),
      label: teams
        .map((team) => team.name)
        .join(", ")
        .slice(0, 255),
      credentials: {
        token: creds.token,
        teamIds: teams.map((team) => team.id),
      } satisfies ClickUpCredentials,
    };
  }

  parseReference(input: string): string | null {
    return parseClickUpReference(input);
  }

  async fetchTask(
    credentials: unknown,
    externalId: string
  ): Promise<ExternalTask> {
    const creds = clickUpCredentialSchema.parse(credentials);

    const detail = isCustomTaskId(externalId)
      ? await this.fetchByCustomId(creds, externalId)
      : await this.request<ClickUpTaskDetail>(
          creds.token,
          `/task/${encodeURIComponent(externalId)}?include_subtasks=true`
        );

    const task = normalizeTask(detail);
    task.subtasks = mapChecklistItems(detail.checklists);
    return task;
  }

  /**
   * Custom ids ("ABC-123") are only unique within a workspace, and the
   * API demands a `team_id` to resolve one. The paste gave us no
   * workspace, so try each one the token can see and take the first hit.
   */
  private async fetchByCustomId(
    creds: ClickUpCredentials,
    externalId: string
  ): Promise<ClickUpTaskDetail> {
    const teamIds = creds.teamIds?.length
      ? creds.teamIds
      : (
          await this.request<ClickUpTeamsResponse>(creds.token, "/team")
        ).teams.map((team) => team.id);

    for (const teamId of teamIds) {
      const params = new URLSearchParams({
        custom_task_ids: "true",
        team_id: teamId,
        include_subtasks: "true",
      });

      try {
        return await this.request<ClickUpTaskDetail>(
          creds.token,
          `/task/${encodeURIComponent(externalId)}?${params.toString()}`
        );
      } catch (error) {
        // Not in this workspace — keep looking. Anything else (bad
        // token, rate limit) is fatal and must not be swallowed.
        if (error instanceof ProviderTaskNotFoundError) continue;
        throw error;
      }
    }

    throw new ProviderTaskNotFoundError(this.displayName, externalId);
  }

  private async request<T>(token: string, path: string): Promise<T> {
    const response = await fetch(`${CLICKUP_API}${path}`, {
      headers: {
        // ClickUp personal tokens go in Authorization raw — there is no
        // `Bearer` prefix, and adding one yields a 401.
        Authorization: token,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new ProviderCredentialError(
        this.displayName,
        await safeText(response)
      );
    }

    if (response.status === 404) {
      throw new ProviderTaskNotFoundError(this.displayName, path);
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new ProviderRateLimitError(
        this.displayName,
        Number.isFinite(retryAfter) ? retryAfter : null
      );
    }

    if (!response.ok) {
      throw new ProviderRequestError(
        this.displayName,
        response.status,
        await safeText(response)
      );
    }

    return (await response.json()) as T;
  }
}

async function safeText(response: Response): Promise<string | undefined> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return undefined;
  }
}
