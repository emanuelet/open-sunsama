/** Todoist task-source provider (API v1, personal API token). */
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
  normalizeTask,
  parseTodoistReference,
  todoistCredentialSchema,
  type TodoistCredentials,
  type TodoistProject,
  type TodoistTask,
  type TodoistUser,
} from "./todoist-helpers.js";

const TODOIST_API = "https://api.todoist.com/api/v1";

export class TodoistProvider implements TaskProvider {
  readonly id = "todoist";
  readonly displayName = "Todoist";
  readonly docsUrl = "https://developer.todoist.com/api/v1/";
  readonly referenceExample = "https://app.todoist.com/app/task/6cF5Q2gH9P3";

  readonly credentialFields: CredentialField[] = [
    {
      key: "token",
      label: "Personal API token",
      type: "password",
      placeholder: "API token",
      help: "Todoist → Settings → Integrations → Developer → API token",
    },
  ];

  readonly credentialSchema = todoistCredentialSchema;

  async verifyCredentials(credentials: unknown): Promise<VerifiedAccount> {
    const creds = todoistCredentialSchema.parse(credentials);
    const user = await this.request<TodoistUser>(creds.token, "/user");

    return {
      providerAccountId: user.id,
      label: user.full_name || user.email || "Todoist account",
      credentials: creds satisfies TodoistCredentials,
    };
  }

  parseReference(input: string): string | null {
    return parseTodoistReference(input);
  }

  async fetchTask(
    credentials: unknown,
    externalId: string
  ): Promise<ExternalTask> {
    const creds = todoistCredentialSchema.parse(credentials);
    const task = await this.request<TodoistTask>(
      creds.token,
      `/tasks/${encodeURIComponent(externalId)}`
    );

    let project: TodoistProject | null = null;
    try {
      project = await this.request<TodoistProject>(
        creds.token,
        `/projects/${encodeURIComponent(task.project_id)}`
      );
    } catch (error) {
      // A task can outlive a project rename/delete race. Import the task
      // without a source container rather than failing the whole operation.
      if (!(error instanceof ProviderTaskNotFoundError)) throw error;
    }

    return normalizeTask(task, project);
  }

  private async request<T>(token: string, path: string): Promise<T> {
    const response = await fetch(`${TODOIST_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      throw new ProviderCredentialError(this.displayName, await safeText(response));
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
