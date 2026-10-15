import pino, { type DestinationStream, type Logger } from "pino";

// Log aplikasi tanpa PII (S26-3, CLAUDE.md §2.5, BLUEPRINT §P.1/§P.2): tidak memuat email, token, cookie, isi foto,
// atau IP mentah. Dua lapis:
// 1. kunci sensitif di objek apa pun (email, token, cookie, authorization, sandi, ip, …) → "[disensor]";
// 2. pola di dalam teks bebas (alamat email, IPv4/IPv6, Bearer, cookie sesi, token panjang) → "[disensor]".
// Penyaring yang sama dipakai Sentry (lib/server/sentry.ts).

export const DISENSOR = "[disensor]";

const KUNCI_SENSITIF = new Set([
  "email",
  "emailtujuan",
  "token",
  "tokenhash",
  "accesstoken",
  "refreshtoken",
  "cookie",
  "cookies",
  "set-cookie",
  "authorization",
  "sandi",
  "sandihash",
  "password",
  "secret",
  "ip",
  "ipaddress",
  "x-forwarded-for",
  "x-real-ip",
  "x-alasan",
  "signaturekey",
  "signature_key",
  "serverkey",
  "body",
]);

const POLA_TEKS: readonly RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // email
  /__Host-serah=[^;\s]*/g, // cookie sesi
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, // header otorisasi
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IPv4
  /\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, // IPv6 (bentuk panjang)
  /[A-Za-z0-9_-]{32,}/g, // token/rahasia panjang (base64url, hex)
];

const BATAS_KEDALAMAN = 6;

/** Saring teks bebas dari pola PII/rahasia. */
export function sensorTeks(s: string): string {
  let hasil = s;
  for (const p of POLA_TEKS) hasil = hasil.replace(p, DISENSOR);
  return hasil;
}

/** Salinan nilai yang aman dicatat: kunci sensitif & pola teks disensor; Error → {nama, kode, pesan tersensor}. */
export function sensor(nilai: unknown, kedalaman = 0): unknown {
  if (typeof nilai === "string") return sensorTeks(nilai);
  if (nilai === null || typeof nilai !== "object") return nilai;
  if (kedalaman >= BATAS_KEDALAMAN) return DISENSOR;
  if (nilai instanceof Error) {
    const kode = (nilai as { code?: unknown; kode?: unknown }).kode ?? (nilai as { code?: unknown }).code;
    return { nama: nilai.name, ...(kode !== undefined ? { kode: String(kode) } : {}), pesan: sensorTeks(nilai.message) };
  }
  if (nilai instanceof Headers) return sensor(Object.fromEntries(nilai.entries()), kedalaman);
  if (Array.isArray(nilai)) return nilai.map((x) => sensor(x, kedalaman + 1));
  const keluar: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nilai)) keluar[k] = KUNCI_SENSITIF.has(k.toLowerCase()) ? DISENSOR : sensor(v, kedalaman + 1);
  return keluar;
}

export type Log = {
  info(pesan: string, data?: Record<string, unknown>): void;
  warn(pesan: string, data?: Record<string, unknown>): void;
  error(pesan: string, data?: Record<string, unknown>): void;
};

/** Logger JSON (pino) ke `tujuan` (bawaan stderr). Semua argumen disensor sebelum ditulis. */
export function buatLog(tujuan?: DestinationStream): Log {
  const p: Logger = pino(
    {
      base: { app: "serah" },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Lapis cadangan bila objek mentah lolos dari sensor().
      redact: { paths: ["*.email", "*.token", "*.cookie", "*.authorization", "*.ip", "req.headers.cookie", "req.headers.authorization"], censor: DISENSOR },
    },
    tujuan ?? pino.destination(2),
  );
  const tulis = (tingkat: "info" | "warn" | "error") => (pesan: string, data?: Record<string, unknown>) =>
    data ? p[tingkat](sensor(data) as object, sensorTeks(pesan)) : p[tingkat](sensorTeks(pesan));
  return { info: tulis("info"), warn: tulis("warn"), error: tulis("error") };
}

let bawaan: Log | undefined;

/** Logger aplikasi (stderr, JSON per baris). */
export function log(): Log {
  bawaan ??= buatLog();
  return bawaan;
}
