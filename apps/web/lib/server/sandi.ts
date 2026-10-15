import { hash, verify } from "@node-rs/argon2";

// Sandi argon2id (§P.1; algoritme & parameter bawaan @node-rs/argon2). Minimal 10 karakter ditegakkan skema kontrak.

export function hashSandi(sandi: string): Promise<string> {
  return hash(sandi);
}

let pembanding: Promise<string> | undefined;

/**
 * Cocokkan sandi. Bila akun/sandi tidak ada, tetap jalankan verifikasi terhadap hash pembanding
 * agar waktu respons tidak membocorkan keberadaan email.
 */
export async function cocokSandi(sandiHash: string | null, sandi: string): Promise<boolean> {
  if (!sandiHash) {
    pembanding ??= hash("pembanding-waktu-serah");
    await verify(await pembanding, sandi).catch(() => false);
    return false;
  }
  try {
    return await verify(sandiHash, sandi);
  } catch {
    return false;
  }
}
