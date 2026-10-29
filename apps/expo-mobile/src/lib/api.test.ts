import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => storage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { storage.set(key, value); },
  deleteItemAsync: async (key: string) => { storage.delete(key); },
}));
import { getApiUrl, initializeApi, normalizeApiUrl, setApiUrl, setToken } from "./api";

describe("mobile API server", () => {
  beforeEach(() => storage.clear());
  it("accepts HTTP(S) base URLs and rejects embedded credentials and parameters", () => {
    expect(normalizeApiUrl(" https://example.com/api/ ")).toBe("https://example.com/api");
    expect(normalizeApiUrl("http://10.0.2.2:3001")).toBe("http://10.0.2.2:3001");
    for (const url of ["ftp://example.com", "https://user:pass@example.com", "https://example.com?token=secret", "not-a-url"]) {
      expect(() => normalizeApiUrl(url)).toThrow();
    }
  });
  it("persists the selected endpoint and clears the old token", async () => {
    await setToken("old-token");
    await setApiUrl("https://self-hosted.example.com/");
    expect(storage.get("open_sunsama_token")).toBeUndefined();
    expect(storage.get("open_sunsama_api_url")).toBe("https://self-hosted.example.com");
    await initializeApi();
    expect(getApiUrl()).toBe("https://self-hosted.example.com");
  });
});
