import { expect, test, type Page } from "@playwright/test";
import { TEKS, isi } from "@serah/kontrak/teks";

// S10-5 — layar A1/A2/K2/P1 terhadap API NYATA (NEXT_PUBLIC_API_MOCK=false, DEMO_MODE=true, DB ber-seed demo).
// Hanya dijalankan bila E2E_NYATA=1 (butuh server produksi + Postgres + seed). Alur berantai satu serah.

test.skip(process.env.E2E_NYATA !== "1", "butuh server API nyata (E2E_NYATA=1)");
test.describe.configure({ mode: "serial" });
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

type Peran = "PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA";

async function masuk(page: Page, peran: Peran) {
  const asal = new URL(page.url() === "about:blank" ? (test.info().project.use.baseURL ?? "http://localhost:3000") : page.url()).origin;
  const r = await page.request.post("/api/auth/demo", { data: { peran }, headers: { origin: asal } });
  expect(r.ok(), `masuk demo ${peran}`).toBe(true);
}

async function api<T>(page: Page, jalur: string): Promise<T> {
  const r = await page.request.get(jalur);
  const j = (await r.json()) as { ok: boolean; data: T };
  expect(j.ok, jalur).toBe(true);
  return j.data;
}

type Ringkas = { kode: string; status: string; aliran: string[] };
type Detail = Ringkas & {
  wadah: Array<{ aliran: string; beratG: number | null }>;
  tiket: { id: string; beratFinalG: number } | null;
};

const PENERIMA_PER_ALIRAN: Record<string, RegExp> = {
  KUNING: /Daur Ulang Contoh Mandiri/,
  ABU: /TPST Contoh/,
  HIJAU: /TPS3R Contoh/,
  MERAH: /Fasilitas B3 Contoh/,
};

/**
 * Kamera acak: R-04 nyata menolak foto yang mirip (dHash). Kamera palsu bawaan Chromium selalu memberi bingkai
 * yang sama, jadi unggahan kedua ditolak. Di sini setiap bingkai berupa kisi 9×8 abu-abu acak (dHash berbeda).
 */
async function kameraAcak(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement("canvas");
      c.width = 360;
      c.height = 320;
      const g = c.getContext("2d")!;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 9; x++) {
          const v = Math.floor(Math.random() * 256);
          g.fillStyle = `rgb(${v},${v},${v})`;
          g.fillRect(x * 40, y * 40, 40, 40);
        }
      }
      return c.captureStream(5);
    };
  });
}

let kodeAmbil = "";

/** A2 butuh GET /api/kendaraan & /api/kontrak (S13, jalur A). Sebelum itu MERGED, bagian A2 dilewati. */
async function rutePendukungAda(page: Page): Promise<boolean> {
  const [k, m] = await Promise.all([page.request.get("/api/kendaraan"), page.request.get("/api/kontrak")]);
  return k.status() !== 404 && m.status() !== 404;
}

test("A1 nyata: daftar ambil memuat serah DRAF demo dengan lencana prioritas bila ada", async ({ page }) => {
  await page.goto("/masuk");
  await masuk(page, "PENGANGKUT");
  const daftar = await api<{ serah: Array<{ kode: string; aliran: string[]; prioritas?: unknown }> }>(page, "/api/ambil");
  await page.goto("/pengangkut");
  await expect(page.getByRole("heading", { level: 1, name: TEKS.A1_JUDUL })).toBeVisible();
  if (daftar.serah.length === 0) {
    await expect(page.getByText(TEKS.K_KOSONG_AMBIL)).toBeVisible();
    test.skip(true, "seed demo tidak punya serah DRAF");
  }
  const sasaran = daftar.serah.find((s) => s.aliran.length === 1) ?? daftar.serah[0]!;
  kodeAmbil = sasaran.kode;
  const kartu = page.locator(`[data-kode="${sasaran.kode}"]`);
  await expect(kartu).toBeVisible();
  if (sasaran.prioritas) {
    await expect(kartu).toContainText(TEKS.R10_CATATAN);
    await expect(kartu).toContainText(TEKS.BMKG_ATRIBUSI);
  }
});

test("A2 nyata: foto → kendaraan & penerima → ambil (atau panel aturan bila muatan campur)", async ({ page }) => {
  test.skip(kodeAmbil === "", "tidak ada serah DRAF");
  await page.goto("/masuk");
  await masuk(page, "PENGANGKUT");
  test.skip(!(await rutePendukungAda(page)), "menunggu S13: /api/kendaraan & /api/kontrak belum ada");
  const d = await api<Detail>(page, `/api/serah/${kodeAmbil}`);
  await page.goto(`/pengangkut/serah/${kodeAmbil}`);
  await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();
  const ambil = page.getByRole("button", { name: TEKS.A2_FOTO });
  await expect(ambil).toBeEnabled();
  await ambil.click();
  await expect(page.getByLabel(TEKS.A2_KENDARAAN)).toBeVisible();
  await page.getByLabel(TEKS.A2_KENDARAAN).selectOption({ index: 1 });

  if (d.aliran.length === 1) {
    await page.getByRole("radio", { name: PENERIMA_PER_ALIRAN[d.aliran[0]!]! }).check();
    await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
    await expect(page.getByText(TEKS.A2_TERKIRIM)).toBeVisible();
  } else {
    // Muatan campur: tidak ada satu penerima yang sah → server menolak dengan kutipan pasal.
    await page.getByRole("radio", { name: PENERIMA_PER_ALIRAN.KUNING! }).check();
    await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
    await expect(page.locator("[data-aturan]")).toBeVisible();
  }
});

test("A2 nyata: R-01 terlihat saat memilih TPST untuk muatan KUNING", async ({ page }) => {
  await kameraAcak(page);
  await page.goto("/masuk");
  // Siapkan muatan KUNING baru lewat API sebagai pengelola (seed hanya punya satu serah DRAF residu).
  await masuk(page, "PENGELOLA");
  const asal = new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin;
  const tps = await api<{ tps: Array<{ id: string }> }>(page, "/api/tps");
  const wadah = await page.request.post("/api/wadah", {
    headers: { origin: asal, "idempotency-key": crypto.randomUUID() },
    data: { tpsId: tps.tps[0]!.id, aliran: "KUNING", beratG: 5_000, terjadiPada: new Date().toISOString() },
  });
  const wadahId = ((await wadah.json()) as { data: { id: string } }).data.id;
  const buat = await page.request.post("/api/serah", {
    headers: { origin: asal, "idempotency-key": crypto.randomUUID() },
    data: { tpsId: tps.tps[0]!.id, wadahIds: [wadahId] },
  });
  const kuning = { kode: ((await buat.json()) as { data: { kode: string } }).data.kode };
  await masuk(page, "PENGANGKUT");
  test.skip(!(await rutePendukungAda(page)), "menunggu S13: /api/kendaraan & /api/kontrak belum ada");
  await page.goto(`/pengangkut/serah/${kuning.kode}`);
  await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();
  const ambil = page.getByRole("button", { name: TEKS.A2_FOTO });
  await expect(ambil).toBeEnabled();
  await ambil.click();
  await page.getByLabel(TEKS.A2_KENDARAAN).selectOption({ index: 1 });
  await page.getByRole("radio", { name: /TPST Contoh/ }).check();
  await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
  const panel = page.locator('[data-aturan="R01"]');
  await expect(panel).toContainText(TEKS.ATURAN_JUDUL_TOLAK);
  // Teks dari server memuat label aliran lengkap; kutipan pasal harus terlihat.
  await expect(panel).toContainText("Pasal 20 ayat (2) huruf d");
  await expect(panel).toContainText(TEKS.ALIRAN_KUNING);
  await expect(panel).toContainText(TEKS.ATURAN_BUKAN_NASIHAT);
});

test("K2 nyata: menyetujui serah yang menunggu", async ({ page }) => {
  await page.goto("/masuk");
  await masuk(page, "PENGELOLA");
  const daftar = await api<{ serah: Ringkas[] }>(page, "/api/serah?status=MENUNGGU_SETUJU");
  test.skip(daftar.serah.length === 0, "tidak ada serah MENUNGGU_SETUJU");
  // Utamakan serah bertujuan penerima demo (agar P1 punya serah untuk ditutup).
  let kode = daftar.serah[0]!.kode;
  for (const s of daftar.serah) {
    const d = await api<Detail & { penerima: { nama: string } | null }>(page, `/api/serah/${s.kode}`);
    if (d.penerima && /Daur Ulang Contoh Mandiri/.test(d.penerima.nama)) {
      kode = s.kode;
      break;
    }
  }
  await page.goto(`/kawasan/setujui/${kode}`);
  await page.getByRole("button", { name: TEKS.K2_SETUJUI }).click();
  await expect(page.getByText(isi("K2_DISETUJUI", { kode_serah: kode }))).toBeVisible();
  const sesudah = await api<Detail>(page, `/api/serah/${kode}`);
  expect(sesudah.status).toBe("DIANGKUT");
});

test("P1 nyata: tutup serah (AI tidak tersedia → isi manual) lalu status tertutup", async ({ page }) => {
  await page.goto("/masuk");
  await masuk(page, "PENERIMA");
  const daftar = await api<{ serah: Ringkas[] }>(page, "/api/serah?status=DIANGKUT");
  test.skip(daftar.serah.length === 0, "tidak ada serah DIANGKUT");
  // Pilih serah DIANGKUT; berat TPS boleh belum lengkap (wadah dicatat per jumlah) → pakai 10 kg.
  const sasaran = await api<Detail>(page, `/api/serah/${daftar.serah[0]!.kode}`);
  const lengkap = sasaran.wadah.length > 0 && sasaran.wadah.every((w) => w.beratG !== null);
  const total = lengkap ? sasaran.wadah.reduce((j, w) => j + (w.beratG ?? 0), 0) : 10_000;
  const fmt = (g: number) => `${Math.trunc(g / 1000)}${g % 1000 === 0 ? "" : `,${String(g % 1000).padStart(3, "0").replace(/0+$/, "")}`}`;
  const kg = fmt(total);
  const perAliran = new Map<string, number>();
  if (lengkap) for (const w of sasaran.wadah) perAliran.set(w.aliran, (perAliran.get(w.aliran) ?? 0) + (w.beratG ?? 0));
  else perAliran.set(sasaran.aliran[0]!, total);

  await page.goto(`/penerima/serah/${sasaran.kode}`);
  const foto = page.getByRole("button", { name: TEKS.P1_FOTO_TIKET }).last();
  await expect(foto).toBeEnabled();
  await foto.click();
  // Tanpa kunci Anthropic server memakai ManualPembaca → G_AI_MATI.
  await expect(page.getByText(TEKS.G_AI_MATI)).toBeVisible();
  await page.getByLabel(TEKS.P1_BERAT_TIKET).fill(kg);
  await page.getByRole("button", { name: TEKS.P1_KONFIRMASI_AI }).click();

  // Terima semua: isi "diterima" tiap aliran; aliran lain (bila ada) dibiarkan 0.
  for (const [aliran, g] of perAliran) await page.locator(`#diterima-${aliran}`).fill(fmt(g));
  await page.getByRole("button", { name: TEKS.P1_TERIMA }).click();
  await expect(page.getByText(isi("P1_DITUTUP", { kode_serah: sasaran.kode }))).toBeVisible();

  const sesudah = await api<Detail>(page, `/api/serah/${sasaran.kode}`);
  expect(sesudah.status).toBe("DITERIMA");
});
