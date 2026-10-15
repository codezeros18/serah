import { NextResponse, type NextRequest } from "next/server";
import { nonceBaru, susunCsp } from "./lib/server/keamanan";

// Proxy Next.js 16 (pengganti `middleware`): CSP ber-nonce per permintaan untuk halaman (S26-2).
// Next membaca nonce dari header CSP permintaan dan memasangnya pada skrip kerangka saat render dinamis
// (root layout memanggil connection() agar semua halaman dirender per permintaan).
// Header keamanan lain (nosniff, Referrer-Policy, Permissions-Policy, HSTS) dipasang next.config.ts untuk semua rute.

export function proxy(request: NextRequest) {
  const nonce = nonceBaru();
  const csp = susunCsp({ nonce, dev: process.env.NODE_ENV === "development", r2AccountId: process.env.R2_ACCOUNT_ID });

  const headerPermintaan = new Headers(request.headers);
  headerPermintaan.set("x-nonce", nonce);
  headerPermintaan.set("Content-Security-Policy", csp);

  const respons = NextResponse.next({ request: { headers: headerPermintaan } });
  respons.headers.set("Content-Security-Policy", csp);
  return respons;
}

export const config = {
  matcher: [
    {
      // Semua halaman kecuali API (CSP JSON dari next.config), aset statis, dan berkas publik umum.
      source: "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|ikon/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
