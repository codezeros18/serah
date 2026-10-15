import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { config as konfigProxy, proxy } from "../../proxy";
import { CSP_API, DOMAIN_BAYAR_SANDBOX, headerKeamanan, hostR2, nonceBaru, susunCsp } from "./keamanan";

// S26-2 — CSP (R2 + pembayaran sandbox), header keamanan, Permissions-Policy, proxy Next 16.

const arahan = (csp: string) => Object.fromEntries(csp.split("; ").map((a) => [a.split(" ")[0]!, a.split(" ").slice(1)]));

describe("susunCsp", () => {
  it("skrip hanya ber-nonce + strict-dynamic; tanpa unsafe-inline/unsafe-eval di produksi", () => {
    const a = arahan(susunCsp({ nonce: "abc123", dev: false, r2AccountId: "akun1" }));
    expect(a["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'", ...DOMAIN_BAYAR_SANDBOX]);
    expect(a["script-src"]).not.toContain("'unsafe-inline'");
    expect(a["script-src"]).not.toContain("'unsafe-eval'");
    expect(a["object-src"]).toEqual(["'none'"]);
    expect(a["frame-ancestors"]).toEqual(["'self'"]);
    expect(a["base-uri"]).toEqual(["'self'"]);
    expect(a["upgrade-insecure-requests"]).toEqual([]);
  });

  it("domain R2 (URL bertanda tangan) diizinkan untuk gambar & fetch; pembayaran sandbox untuk skrip, iframe, fetch", () => {
    const a = arahan(susunCsp({ nonce: "n", dev: false, r2AccountId: "akun1" }));
    for (const h of ["https://akun1.r2.cloudflarestorage.com", "https://*.akun1.r2.cloudflarestorage.com"]) {
      expect(a["img-src"]).toContain(h);
      expect(a["connect-src"]).toContain(h);
    }
    for (const d of ["https://app.sandbox.midtrans.com", "https://api.sandbox.midtrans.com"]) {
      expect(a["frame-src"]).toContain(d);
      expect(a["connect-src"]).toContain(d);
    }
    // Domain produksi pembayaran tidak pernah diizinkan.
    expect(susunCsp({ nonce: "n", dev: false })).not.toMatch(/https:\/\/app\.midtrans\.com|https:\/\/api\.midtrans\.com/);
  });

  it("development menambah unsafe-eval (React dev) dan tidak memaksa upgrade-insecure-requests", () => {
    const a = arahan(susunCsp({ nonce: "n", dev: true }));
    expect(a["script-src"]).toContain("'unsafe-eval'");
    expect(a["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("hostR2: tanpa akun / akun tak sah → wildcard R2 saja", () => {
    expect(hostR2(undefined)).toEqual(["https://*.r2.cloudflarestorage.com"]);
    expect(hostR2("evil.com/x")).toEqual(["https://*.r2.cloudflarestorage.com"]);
  });

  it("nonce acak, base64, berbeda tiap panggilan", () => {
    const n = new Set(Array.from({ length: 50 }, () => nonceBaru()));
    expect(n.size).toBe(50);
    for (const x of n) expect(x).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("header keamanan", () => {
  it("nosniff, Referrer-Policy same-origin, Permissions-Policy (tanpa lokasi & mikrofon, kamera hanya self), X-Frame-Options", () => {
    expect(Object.fromEntries(headerKeamanan(false).map((h) => [h.key, h.value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=(self)",
      "X-Frame-Options": "SAMEORIGIN",
    });
  });
  it("HSTS hanya di produksi", () => {
    expect(headerKeamanan(true).find((h) => h.key === "Strict-Transport-Security")?.value).toBe("max-age=63072000; includeSubDomains");
    expect(headerKeamanan(false).find((h) => h.key === "Strict-Transport-Security")).toBeUndefined();
  });
  it("next.config memasang header keamanan ke semua rute dan CSP JSON ke /api", async () => {
    const aturan = await nextConfig.headers!();
    const semua = aturan.find((a) => a.source === "/:path*");
    expect(semua?.headers.map((h) => h.key)).toEqual(expect.arrayContaining(["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]));
    expect(aturan.find((a) => a.source === "/api/:path*")?.headers).toEqual([{ key: "Content-Security-Policy", value: CSP_API }]);
  });
});

describe("proxy.ts (Next 16)", () => {
  it("halaman: CSP ber-nonce di respons, nonce & CSP sama diteruskan ke header permintaan; nonce baru tiap permintaan", () => {
    const r1 = proxy(new NextRequest("http://localhost/petugas"));
    const r2 = proxy(new NextRequest("http://localhost/petugas"));
    const csp1 = r1.headers.get("Content-Security-Policy")!;
    const nonce1 = /'nonce-([^']+)'/.exec(csp1)?.[1];
    expect(nonce1).toBeTruthy();
    expect(r2.headers.get("Content-Security-Policy")).not.toBe(csp1);
    // Header permintaan yang diteruskan Next (x-middleware-request-*) memuat nonce & CSP yang sama.
    expect(r1.headers.get("x-middleware-request-x-nonce")).toBe(nonce1);
    expect(r1.headers.get("x-middleware-request-content-security-policy")).toBe(csp1);
  });

  it("matcher tidak menyentuh /api dan aset statis", () => {
    const pola = new RegExp(`^${konfigProxy.matcher[0]!.source}$`);
    expect(pola.test("/petugas")).toBe(true);
    expect(pola.test("/")).toBe(true);
    for (const p of ["/api/health", "/_next/static/x.js", "/favicon.ico", "/sw.js", "/manifest.webmanifest"]) expect(pola.test(p)).toBe(false);
  });
});
