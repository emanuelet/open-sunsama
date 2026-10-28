import { lookup } from "node:dns/promises";

const MAX_HTML_BYTES = 128 * 1024;

export interface LinkPreview {
  title: string | null;
  faviconUrl: string | null;
}

function isPrivateAddress(address: string) {
  const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mappedIpv4) return isPrivateAddress(mappedIpv4);
  if (
    address === "::" ||
    address === "::1" ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("fe80:")
  )
    return true;
  const [a, b = -1] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function isPublicHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    return null;
  const addresses = await lookup(host, { all: true });
  return addresses.length > 0 &&
    addresses.every(({ address }) => !isPrivateAddress(address))
    ? url
    : null;
}

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

export function parseLinkPreview(html: string, pageUrl: URL): LinkPreview {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const icon = [...html.matchAll(/<link\b[^>]*>/gi)].find((tag) =>
    /\brel\s*=\s*["']?[^"'>]*\bicon\b/i.test(tag[0])
  );
  const href = icon?.[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  let faviconUrl: string | null = null;
  try {
    const favicon = new URL(href || "/favicon.ico", pageUrl);
    if (favicon.protocol === "https:" || favicon.protocol === "http:")
      faviconUrl = favicon.toString();
  } catch {
    // An invalid icon URL should not discard the page title.
  }
  return { title: title ? decodeHtml(title) || null : null, faviconUrl };
}

async function readHtml(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    length += value.length;
  }
  await reader.cancel();
  return new TextDecoder().decode(
    Buffer.concat(chunks).subarray(0, MAX_HTML_BYTES)
  );
}

/** Fetch a small, public HTTPS page preview. Metadata failure never blocks linking. */
export async function fetchLinkPreview(
  value: string
): Promise<LinkPreview | null> {
  try {
    const url = await isPublicHttpsUrl(value);
    if (!url) return null;
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Open-Sunsama-Link-Preview/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/html")
    )
      return null;
    return parseLinkPreview(await readHtml(response), url);
  } catch {
    return null;
  }
}
