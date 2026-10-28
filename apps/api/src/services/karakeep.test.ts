import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KarakeepError,
  createKarakeepBookmark,
  searchKarakeepBookmarks,
} from "./karakeep.js";

describe("Karakeep service", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a link bookmark and applies idea tags", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "bookmark-1",
            title: "Idea",
            note: null,
            tags: [],
            content: { type: "link", url: "https://example.com" },
          }),
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ attached: ["tag-1"] }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetch);

    await createKarakeepBookmark("https://karakeep.test", "secret", {
      title: "Idea",
      url: "https://example.com",
      notes: null,
      tags: ["research"],
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://karakeep.test/api/v1/bookmarks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      })
    );
    expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toMatchObject({
      type: "link",
      url: "https://example.com",
      source: "api",
    });
    expect(fetch.mock.calls[1]![0]).toBe(
      "https://karakeep.test/api/v1/bookmarks/bookmark-1/tags"
    );
  });

  it("uses Karakeep search and does not expose remote failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }))
    );
    try {
      await searchKarakeepBookmarks("https://karakeep.test", "bad", "design");
      throw new Error("Expected Karakeep request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(KarakeepError);
      expect((error as KarakeepError).status).toBe(422);
    }
  });
});
