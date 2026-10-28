import { describe, expect, it } from "vitest";
import { parseLinkPreview } from "./link-preview";

describe("parseLinkPreview", () => {
  it("extracts a page title and resolves a relative favicon", () => {
    expect(
      parseLinkPreview(
        '<html><head><title>Example &amp; Co</title><link rel="icon" href="/icon.svg"></head></html>',
        new URL("https://example.com/docs/page")
      )
    ).toEqual({
      title: "Example & Co",
      faviconUrl: "https://example.com/icon.svg",
    });
  });
});
