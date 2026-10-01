import { canonicalJson } from "./evaluate";

/** SHA-256 of the canonical JSON, hex-encoded. Browser (Web Crypto) version. */
export async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
