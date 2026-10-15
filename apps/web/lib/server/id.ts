import { randomBytes } from "node:crypto";

/** ID berformat cuid2 (huruf kecil awal + 23 karakter base36) untuk baris yang ID-nya dibutuhkan sebelum INSERT. */
export function idBaru(): string {
  const b = randomBytes(24);
  let s = String.fromCharCode(97 + (b[0] ?? 0) % 26);
  for (let i = 1; i < 24; i++) s += ((b[i] ?? 0) % 36).toString(36);
  return s;
}
