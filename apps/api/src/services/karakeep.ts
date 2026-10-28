export interface KarakeepBookmark {
  id: string;
  title: string | null;
  note: string | null;
  tags: Array<{ name: string }>;
  content: { type: string; url?: string };
}

export class KarakeepError extends Error {
  constructor(
    message: string,
    public readonly status: 422 | 502
  ) {
    super(message);
    this.name = "KarakeepError";
  }
}

function apiUrl(baseUrl: string, path: string): string {
  return new URL(`/api/v1${path}`, baseUrl).toString();
}

async function request<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(baseUrl, path), {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new KarakeepError("Could not reach Karakeep", 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new KarakeepError("Karakeep rejected the API key", 422);
    }
    throw new KarakeepError(
      `Karakeep request failed (${response.status})`,
      502
    );
  }
  return response.json() as Promise<T>;
}

export async function verifyKarakeepConnection(
  baseUrl: string,
  apiKey: string
) {
  await request(baseUrl, apiKey, "/bookmarks?limit=1");
}

export async function createKarakeepBookmark(
  baseUrl: string,
  apiKey: string,
  idea: { title: string; url: string; notes: string | null; tags: string[] }
): Promise<KarakeepBookmark> {
  const bookmark = await request<KarakeepBookmark>(
    baseUrl,
    apiKey,
    "/bookmarks",
    {
      method: "POST",
      body: JSON.stringify({
        type: "link",
        url: idea.url,
        title: idea.title,
        note: idea.notes ?? undefined,
        source: "api",
      }),
    }
  );
  if (idea.tags.length > 0) {
    await request(
      baseUrl,
      apiKey,
      `/bookmarks/${encodeURIComponent(bookmark.id)}/tags`,
      {
        method: "POST",
        body: JSON.stringify({
          tags: idea.tags.map((tagName) => ({ tagName })),
        }),
      }
    );
  }
  return bookmark;
}

export async function searchKarakeepBookmarks(
  baseUrl: string,
  apiKey: string,
  query: string
): Promise<KarakeepBookmark[]> {
  const response = await request<{ bookmarks: KarakeepBookmark[] }>(
    baseUrl,
    apiKey,
    `/bookmarks/search?q=${encodeURIComponent(query)}&limit=20`
  );
  return response.bookmarks;
}

export async function getKarakeepBookmark(
  baseUrl: string,
  apiKey: string,
  bookmarkId: string
): Promise<KarakeepBookmark> {
  return request(
    baseUrl,
    apiKey,
    `/bookmarks/${encodeURIComponent(bookmarkId)}`
  );
}
