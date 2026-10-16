// Header keamanan & CSP (S26-2, BLUEPRINT §P.1). Murni: dipakai proxy.ts (halaman, dengan nonce per permintaan)
// dan next.config.ts (semua rute, termasuk /api). Tanpa impor server/DB agar aman dimuat di proxy & config.
//
// Next.js 16.4.1: berkas `middleware` sudah usang dan berganti nama menjadi `proxy.ts` (runtime nodejs saja);
// CSP dengan nonce mengikuti panduan node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.

/** Domain Midtrans Snap SANDBOX (skrip, iframe pembayaran, API). Produksi tidak pernah diizinkan. */
export const DOMAIN_BAYAR_SANDBOX = ["https://app.sandbox.midtrans.com", "https://api.sandbox.midtrans.com"] as const;

/** Host R2 untuk URL bertanda tangan (gaya jalur & gaya virtual-host). Tanpa akun → wildcard R2. */
export function hostR2(accountId: string | undefined): string[] {
  const id = accountId?.trim();
  if (!id || !/^[a-z0-9]+$/i.test(id)) return ["https://*.r2.cloudflarestorage.com"];
  return [`https://${id}.r2.cloudflarestorage.com`, `https://*.${id}.r2.cloudflarestorage.com`];
}

export type OpsiCsp = { nonce: string; dev: boolean; r2AccountId?: string | undefined };

/**
 * CSP halaman. Skrip hanya ber-nonce (+ 'strict-dynamic'); gaya boleh inline (atribut style React & Tailwind) —
 * risiko injeksi gaya jauh lebih kecil daripada skrip. Gambar: diri sendiri, data/blob (pratinjau kamera), R2.
 * `'unsafe-eval'` hanya di development (React dev memakai eval untuk jejak galat).
 */
export function susunCsp(o: OpsiCsp): string {
  const bayar = DOMAIN_BAYAR_SANDBOX.join(" ");
  const r2 = hostR2(o.r2AccountId).join(" ");
  const arahan = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${o.nonce}' 'strict-dynamic' ${bayar}${o.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${r2} https://tile.openstreetmap.org`,
    "font-src 'self' data:",
    `connect-src 'self' ${bayar} ${r2} https://nominatim.openstreetmap.org`,
    `frame-src 'self' ${bayar}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(o.dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return arahan.join("; ");
}

/** CSP untuk respons JSON /api: tidak ada yang boleh dimuat atau di-iframe. */
export const CSP_API = "default-src 'none'; frame-ancestors 'none'";

/** Header keamanan untuk SEMUA respons (§P.1). HSTS hanya di produksi (HTTPS). */
export function headerKeamanan(produksi: boolean): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "same-origin" },
    // Kamera hanya untuk halaman sendiri (foto muatan & tiket); lokasi & mikrofon dimatikan (§2.5: nol GPS).
    { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(self)" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ...(produksi ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  ];
}

/** Nonce acak per permintaan (Web Crypto; tersedia di runtime nodejs proxy). */
export function nonceBaru(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}
