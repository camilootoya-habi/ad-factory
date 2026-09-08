const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // sin 0/o/1/l para que se lea sin ambigüedad

/** 6 caracteres [a-z2-9]; viaja en utm_term y en la ruta del render. */
export function shortId(length = 6): string {
  let out = "";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${shortId(10)}`;
}
