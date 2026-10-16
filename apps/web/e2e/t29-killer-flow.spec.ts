import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS, isi } from "@serah/kontrak/teks";

// T29 — KILLER FLOW (BLUEPRINT §R, DEMO.md §1) terhadap API NYATA (tanpa mock), di viewport HP & laptop:
// petugas catat → buat serah → pengangkut foto muatan (R-01 menolak TPST, lalu tujuan sah) → pengelola setujui →
// penerima tutup sebagian (36,5 kg diterima, 6 kg ditolak) → tiga laporan memuat angka yang sama → rantai utuh.
// Syarat: build produksi berjalan (E2E_PRODUKSI=1 pnpm build lalu playwright), DEMO_MODE=true, DB ber-seed demo,
// NEXT_PUBLIC_API_MOCK=false. Dijalankan 3× berturut (`--repeat-each=3`); setiap putaran membuat serah baru.
// Yang BELUM dicakup (butuh foto tiket sungguhan, P-05): pembacaan otomatis tiket oleh AI — jalur manual dipakai.

test.skip(process.env.E2E_NYATA !== "1", "butuh server nyata (E2E_NYATA=1)");
test.describe.configure({ mode: "serial" });
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

type Peran = "PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA";
const QR_TPS = "demo-qr-TPS-PCS-01";
const KUNING = "42,5";

async function masuk(page: Page, peran: Peran) {
  const asal = new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin;
  const r = await page.request.post("/api/auth/demo", { data: { peran }, headers: { origin: asal } });
  expect(r.ok(), `masuk demo ${peran}`).toBe(true);
}

async function axeBersih(page: Page, konteks: string) {
  const h = await new AxeBuilder({ page }).analyze();
  const parah = h.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(parah.map((v) => `${konteks} -> ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Kamera acak: R-04 menolak foto yang mirip, sedangkan kamera palsu bawaan selalu memberi bingkai sama. */
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() {
        const q = (window as unknown as { __qr?: string }).__qr;
        return q ? [{ rawValue: q }] : [];
      }
    };
  });
  await kameraAcak(page);
});

let kode = "";
let kawasanId = "";

test("T29-1 petugas: pindai QR TPS → catat Kuning & Abu-abu → buat serah (kode SRH + QR)", async ({ page }) => {
  await masuk(page, "PETUGAS");
  await page.goto("/petugas");
  await expect(page.getByRole("heading", { level: 1, name: TEKS.T1_JUDUL })).toBeVisible();
  await page.getByRole("button", { name: TEKS.T1_PINDAI }).click();
  await page.evaluate((q) => ((window as unknown as { __qr: string }).__qr = q), QR_TPS);
  await expect(page.getByTestId("tps-terpilih")).toContainText("TPS-PCS-01");

  await page.getByRole("button", { name: TEKS.ALIRAN_KUNING }).click();
  await page.getByLabel(TEKS.T1_BERAT_LABEL).fill(KUNING);
  await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
  await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN);
  await page.getByRole("button", { name: TEKS.ALIRAN_ABU }).click();
  await page.getByLabel(TEKS.T1_BERAT_LABEL).fill("30");
  await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
  await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN);

  await page.goto("/petugas/serah");
  await expect(page.getByRole("heading", { level: 1, name: TEKS.T2_JUDUL })).toBeVisible();
  // Wadah Kuning 42,5 kg TERBARU (daftar menaik menurut waktu) — sisa putaran gagal sebelumnya tidak terpilih.
  const baris = page.getByTestId("wadah-menunggu").locator("li", { hasText: isi("UMUM_KG", { nilai: KUNING }) }).last();
  await baris.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: TEKS.T2_BUAT }).click();
  await expect(page.getByTestId("kode-serah")).toHaveText(/^SRH-\d{8}-\d{4}$/);
  kode = ((await page.getByTestId("kode-serah").textContent()) ?? "").trim();
  await expect(page.getByTestId("serah-dibuat").getByRole("img", { name: TEKS.T2_QR_PETUNJUK })).toBeVisible();
  await axeBersih(page, "t29-petugas");

  const d = await page.request.get(`/api/serah/${kode}`);
  const j = (await d.json()) as { data: { status: string; kawasan?: { id: string } } };
  expect(j.data.status).toBe("DRAF");
  kawasanId = j.data.kawasan?.id ?? "";
});

test("T29-2 pengangkut: foto muatan → R-01 menolak TPST dengan kutipan pasal → tujuan sah → terkirim", async ({ page }) => {
  expect(kode).toMatch(/^SRH-/);
  await masuk(page, "PENGANGKUT");
  await page.goto(`/pengangkut/serah/${kode}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();
  const ambil = page.getByRole("button", { name: TEKS.A2_FOTO });
  await expect(ambil).toBeEnabled();
  await ambil.click();

  // Dropdown kustom memakai <select id="kendaraan"> tersembunyi; label "Kendaraan" juga milik tautan navigasi bawah.
  await page.locator("#kendaraan").selectOption({ index: 1 });

  // Momen wow 1: aturan hukum bekerja di layar.
  await page.getByRole("radio", { name: /TPST Contoh/ }).check();
  await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
  const panelR01 = page.locator('[data-aturan="R01"]');
  await expect(panelR01).toBeVisible();
  await expect(panelR01).toContainText(TEKS.ATURAN_JUDUL_TOLAK);
  await expect(panelR01).toContainText("Pasal 20 ayat (2) huruf d");
  await axeBersih(page, "t29-pengangkut-r01");

  await page.getByRole("radio", { name: /Daur Ulang Contoh Mandiri/ }).check();
  await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
  await expect(page.getByText(TEKS.A2_TERKIRIM)).toBeVisible();

  const d = await page.request.get(`/api/serah/${kode}`);
  expect(((await d.json()) as { data: { status: string } }).data.status).toBe("MENUNGGU_SETUJU");
});

test("T29-3 pengelola: setujui serah → DIANGKUT", async ({ page }) => {
  await masuk(page, "PENGELOLA");
  await page.goto(`/kawasan/setujui/${kode}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: TEKS.K2_SETUJUI }).click();
  await page.getByRole("dialog").getByRole("button", { name: TEKS.UMUM_KONFIRMASI }).click();
  await expect(page.getByText(isi("K2_DISETUJUI", { kode_serah: kode }))).toBeVisible();
  const d = await page.request.get(`/api/serah/${kode}`);
  expect(((await d.json()) as { data: { status: string } }).data.status).toBe("DIANGKUT");
});

test("T29-4 penerima: tiket timbang manual → terima sebagian 36,5 kg, tolak 6 kg (Tercampur sampah organik)", async ({ page }) => {
  await masuk(page, "PENERIMA");
  await page.goto(`/penerima/serah/${kode}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: TEKS.P1_ISI_MANUAL }).click();
  await page.getByLabel(TEKS.P1_BERAT_TIKET).fill(KUNING);
  await page.getByRole("button", { name: TEKS.P1_KONFIRMASI_AI }).click();
  await expect(page.getByRole("heading", { level: 2, name: TEKS.P1_PER_ALIRAN })).toBeVisible();
  await page.getByLabel(TEKS.P1_DITERIMA).fill("36,5");
  await page.getByLabel(TEKS.P1_DITOLAK).fill("6");
  await page.getByLabel(TEKS.UMUM_ALASAN).selectOption("TERCAMPUR_ORGANIK");
  await page.getByRole("button", { name: TEKS.P1_TOLAK_SEBAGIAN }).click();
  await page.getByRole("dialog").getByRole("button", { name: TEKS.UMUM_KONFIRMASI }).click();
  await expect(page.getByText(isi("P1_DITUTUP", { kode_serah: kode }))).toBeVisible();
  await axeBersih(page, "t29-penerima-ditutup");

  const d = await page.request.get(`/api/serah/${kode}`);
  expect(((await d.json()) as { data: { status: string } }).data.status).toBe("DITERIMA_SEBAGIAN");
});

test("T29-5 tiga laporan memuat angka & kode yang SAMA; K3 menyebut penyebab; rantai utuh", async ({ page }) => {
  const periode = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);
  type Baris = Record<string, unknown> & { kodeSerah: string; aliran: string; beratTpsG: number; beratDiterimaG: number; beratDitolakG: number; alasanTolak: string | null; status: string; sidikEvent: string };
  // Satu baris per serah × aliran; serah ini hanya KUNING.
  const ambilBaris = async (peran: Peran, pihak: "kawasan" | "pengangkut" | "penerima"): Promise<Baris | undefined> => {
    await masuk(page, peran);
    const r = await page.request.get(`/api/laporan/${pihak}?periode=${periode}${kawasanId ? `&kawasanId=${kawasanId}` : ""}`);
    expect(r.ok(), `laporan ${pihak}`).toBe(true);
    const j = (await r.json()) as { data: { baris: Baris[] } };
    return j.data.baris.find((b) => b.kodeSerah === kode && b.aliran === "KUNING");
  };
  const [k, p, n] = [await ambilBaris("PENGELOLA", "kawasan"), await ambilBaris("PENGANGKUT", "pengangkut"), await ambilBaris("PENERIMA", "penerima")];
  for (const [nama, b] of [["kawasan", k], ["pengangkut", p], ["penerima", n]] as const) expect(b, `baris ${nama} memuat ${kode}`).toBeDefined();
  // T14: tiga laporan dari satu catatan → baris IDENTIK (semua kolom, termasuk sidik rantai).
  expect(p).toEqual(k);
  expect(n).toEqual(k);
  expect(k).toMatchObject({ status: "DITERIMA_SEBAGIAN", beratTpsG: 42_500, beratDiterimaG: 36_500, beratDitolakG: 6_000, alasanTolak: "TERCAMPUR_ORGANIK" });
  expect(k!.sidikEvent).toMatch(/^[0-9a-f]{64}$/);

  // Momen wow 2 di layar: tiga tab laporan pengelola memuat kode yang sama.
  await masuk(page, "PENGELOLA");
  await page.goto("/kawasan/laporan");
  await expect(page.getByRole("heading", { level: 1, name: TEKS.K4_JUDUL })).toBeVisible();
  for (const tab of [TEKS.LAPORAN_KAWASAN, TEKS.LAPORAN_PENGANGKUT, TEKS.LAPORAN_PENERIMA]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByText(kode).first()).toBeVisible({ timeout: 15_000 });
  }
  await axeBersih(page, "t29-laporan");

  await page.goto("/kawasan/ditolak");
  await expect(page.getByRole("heading", { level: 1, name: TEKS.K3_JUDUL })).toBeVisible();
  await expect(page.getByTestId("diterima-vs")).toBeVisible();

  // Bukti tahan sengketa.
  await page.goto("/rantai");
  const periksa = page.getByRole("button", { name: TEKS.RANTAI_PERIKSA });
  await expect(periksa).toBeVisible({ timeout: 20_000 });
  await periksa.click();
  await expect(page.getByTestId("hasil-rantai")).toHaveAttribute("data-utuh", "true", { timeout: 20_000 });
});
