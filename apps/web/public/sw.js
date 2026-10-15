/* Service worker SERAH (S04-4). Ditulis sendiri, tanpa pustaka.
   - Cangkang /petugas, /pengangkut, /penerima + aset statis: tersimpan setelah satu kali kunjungan.
   - Navigasi: jaringan dulu, cadangan cache (agar pencatatan tetap bisa dibuka offline).
   - API (/api/*): jaringan dulu; GET boleh jatuh ke cache terakhir; selain GET tidak pernah dicache.
   - Aksi tulis offline ditangani antrean IndexedDB di aplikasi (S09), bukan di sini. */
const VERSI = "serah-v1";
const CANGKANG = `${VERSI}-cangkang`;
const ASET = `${VERSI}-aset`;
const API = `${VERSI}-api`;
const LAYAR_OFFLINE = ["/petugas", "/pengangkut", "/penerima"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  // Pra-cache terbaik-upaya; kegagalan (belum login, dsb.) tidak membatalkan instalasi.
  e.waitUntil(
    caches.open(CANGKANG).then((c) =>
      Promise.all(
        LAYAR_OFFLINE.map((u) =>
          fetch(u, { credentials: "same-origin" })
            .then((r) => (r.ok && !r.redirected ? c.put(u, r) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nama) => Promise.all(nama.filter((n) => !n.startsWith(VERSI)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function jaringanDulu(req, namaCache) {
  const cache = await caches.open(namaCache);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (galat) {
    const simpan = await cache.match(req, { ignoreSearch: false });
    if (simpan) return simpan;
    throw galat;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(ASET);
  const simpan = await cache.match(req);
  const segar = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return simpan ?? (await segar) ?? Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    // Aliran SSE jangan dicache.
    if (url.pathname === "/api/langsung") return;
    e.respondWith(jaringanDulu(req, API));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(
      jaringanDulu(req, CANGKANG).catch(async () => {
        const cache = await caches.open(CANGKANG);
        return (await cache.match(url.pathname)) ?? Response.error();
      }),
    );
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/ikon/") || url.pathname === "/manifest.webmanifest") {
    e.respondWith(staleWhileRevalidate(req));
  }
});
