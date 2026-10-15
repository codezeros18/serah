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

let kodeAmbil = "";

/** A2 butuh GET /api/kendaraan & /api/direktori/mitra (S13, jalur A). Sebelum itu MERGED, bagian A2 dilewati. */
async function rutePendukungAda(page: Page): Promise<boolean> {
  const [k, m] = await Promise.all([page.request.get("/api/kendaraan"), page.request.get("/api/direktori/mitra?jenis=PENERIMA")]);
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
  test.skip(!(await rutePendukungAda(page)), "menunggu S13: /api/kendaraan & /api/direktori/mitra belum ada");
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
  await page.goto("/masuk");
  await masuk(page, "PENGANGKUT");
  test.skip(!(await rutePendukungAda(page)), "menunggu S13: /api/kendaraan & /api/direktori/mitra belum ada");
  const daftar = await api<{ serah: Ringkas[] }>(page, "/api/ambil");
  const kuning = daftar.serah.find((s) => s.aliran.length === 1 && s.aliran[0] === "KUNING");
  test.skip(!kuning, "tidak ada serah DRAF KUNING tersisa");
  await page.goto(`/pengangkut/serah/${kuning!.kode}`);
  await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();
  const ambil = page.getByRole("button", { name: TEKS.A2_FOTO });
  await expect(ambil).toBeEnabled();
  await ambil.click();
  await page.getByLabel(TEKS.A2_KENDARAAN).selectOption({ index: 1 });
  await page.getByRole("radio", { name: /TPST Contoh/ }).check();
  await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
  const panel = page.locator('[data-aturan="R01"]');
  await expect(panel).toContainText(TEKS.ATURAN_JUDUL_TOLAK);
  await expect(panel).toContainText(isi("ATURAN_R01", { aliran: "KUNING" }));
});

test("K2 nyata: menyetujui serah yang menunggu", async ({ page }) => {
  await page.goto("/masuk");
  await masuk(page, "PENGELOLA");
  const daftar = await api<{ serah: Ringkas[] }>(page, "/api/serah?status=MENUNGGU_SETUJU");
  test.skip(daftar.serah.length === 0, "tidak ada serah MENUNGGU_SETUJU");
  const kode = daftar.serah[0]!.kode;
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
  let sasaran: Detail | null = null;
  for (const s of daftar.serah) {
    const d = await api<Detail>(page, `/api/serah/${s.kode}`);
    if (d.wadah.length > 0 && d.wadah.every((w) => w.beratG !== null)) {
      sasaran = d;
      break;
    }
  }
  test.skip(sasaran === null, "tidak ada serah DIANGKUT dengan berat lengkap");
  const total = sasaran!.wadah.reduce((j, w) => j + (w.beratG ?? 0), 0);
  // Format kg dengan koma (gram bulat): 42500 → "42,5".
  const kg = `${Math.trunc(total / 1000)}${total % 1000 === 0 ? "" : `,${String(total % 1000).padStart(3, "0").replace(/0+$/, "")}`}`;

  await page.goto(`/penerima/serah/${sasaran!.kode}`);
  const foto = page.getByRole("button", { name: TEKS.P1_FOTO_TIKET }).last();
  await expect(foto).toBeEnabled();
  await foto.click();
  // Tanpa kunci Anthropic server memakai ManualPembaca → G_AI_MATI.
  await expect(page.getByText(TEKS.G_AI_MATI)).toBeVisible();
  await page.getByLabel(TEKS.P1_BERAT_TIKET).fill(kg);
  await page.getByRole("button", { name: TEKS.P1_KONFIRMASI_AI }).click();

  // Terima semua: isi "diterima" tiap aliran dengan berat TPS-nya.
  const perAliran = new Map<string, number>();
  for (const w of sasaran!.wadah) perAliran.set(w.aliran, (perAliran.get(w.aliran) ?? 0) + (w.beratG ?? 0));
  for (const [aliran, g] of perAliran) {
    const teksKg = `${Math.trunc(g / 1000)}${g % 1000 === 0 ? "" : `,${String(g % 1000).padStart(3, "0").replace(/0+$/, "")}`}`;
    await page.locator(`#diterima-${aliran}`).fill(teksKg);
  }
  await page.getByRole("button", { name: TEKS.P1_TERIMA }).click();
  await expect(page.getByText(isi("P1_DITUTUP", { kode_serah: sasaran!.kode }))).toBeVisible();

  const sesudah = await api<Detail>(page, `/api/serah/${sasaran!.kode}`);
  expect(sesudah.status).toBe("DITERIMA");
});
