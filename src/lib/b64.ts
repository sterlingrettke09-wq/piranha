// Unicode-safe base64 for packing JSON into URL params (the compare links).
// Plain btoa(JSON.stringify(x)) throws on any non-Latin1 character — one
// accented street name in a parcel address would break the link silently.

/** JSON → base64 of the UTF-8 bytes. Never throws on unicode. */
export function encodeJsonB64(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** Inverse of encodeJsonB64. Returns null on any malformed input. */
export function decodeJsonB64<T>(encoded: string): T | null {
  try {
    const bin = atob(encoded)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}
