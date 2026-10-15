import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS, isi } from "@serah/kontrak/teks";

// S30: QA Layar Komprehensif Seluruh Peran (HP & Laptop), Audit Aksesibilitas (axe), Demo 4-Panel & Reset.
// Dijalankan dengan NEXT_PUBLIC_API_MOCK=true.

test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

const HARI = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, "");
const KODE = (n: number) => `SRH-${HARI}-${String(n).padStart(4, "0")}`;
const QR_TPS_1 = "mocktokentps-pcs-01v1xxxxxxxx";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() {
        const q = (window as unknown as { __qr?: string }).__qr;
        return q ? [{ rawValue: q }] : [];
      }
    };
  });
});

async function axeBersih(page: Page, konteks: string) {
  const hasil = await new AxeBuilder({ page }).analyze();
  const parah = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    parah.map((v) => `${konteks} -> ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

test.describe("S30-1: Halaman Demo 4-Panel (/demo) & Reset Demo", () => {
  test("halaman /demo termuat lengkap, tombol reset bekerja, dan lulus axe", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByText(TEKS.DEMO_LABEL)).toBeVisible({ timeout: 20_000 });

    const tombolReset = page.getByTestId("tombol-reset-demo");
    await expect(tombolReset).toBeVisible();
    await tombolReset.click();

    await expect(page.getByRole("status")).toHaveText(TEKS.DEMO_RESET_SELESAI);

    await expect(page.locator('iframe[title="Panel Petugas"]')).toBeVisible();
    await expect(page.locator('iframe[title="Panel Pengangkut"]')).toBeVisible();
    await expect(page.locator('iframe[title="Panel Pengelola"]')).toBeVisible();
    await expect(page.locator('iframe[title="Panel Penerima"]')).toBeVisible();

    await axeBersih(page, "demo-4-panel");
  });
});

test.describe("S30-2: Peran Petugas TPS (/petugas, /petugas/serah)", () => {
  test("alur petugas: catat wadah di /petugas, buat serah di /petugas/serah, lulus axe", async ({ page }) => {
    await page.goto("/petugas");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.T1_JUDUL })).toBeVisible();
    await axeBersih(page, "petugas-awal");

    // Pindai TPS
    await page.getByRole("button", { name: TEKS.T1_PINDAI }).click();
    await page.evaluate((q) => ((window as unknown as { __qr: string }).__qr = q), QR_TPS_1);
    await expect(page.getByTestId("tps-terpilih")).toContainText("TPS-PCS-01");

    // Catat Kuning 42,5 kg
    await page.getByRole("button", { name: TEKS.ALIRAN_KUNING }).click();
    await page.getByLabel(TEKS.T1_BERAT_LABEL).fill("42,5");
    await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
    await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN);

    // Catat Abu-abu 30 kg
    await page.getByRole("button", { name: TEKS.ALIRAN_ABU }).click();
    await page.getByLabel(TEKS.T1_BERAT_LABEL).fill("30");
    await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
    await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN);
    await axeBersih(page, "petugas-catat-selesai");

    // Siapkan serah di /petugas/serah
    await page.goto("/petugas/serah");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.T2_JUDUL })).toBeVisible();
    await axeBersih(page, "petugas-serah-awal");

    // Pilih wadah
    const wadahList = page.getByTestId("wadah-menunggu").locator('input[type="checkbox"]');
    const jumlahWadah = await wadahList.count();
    expect(jumlahWadah).toBeGreaterThan(0);
    await wadahList.first().check();

    // Buat serah
    await page.getByRole("button", { name: TEKS.T2_BUAT }).click();
    await expect(page.getByTestId("serah-dibuat")).toBeVisible();
    await expect(page.getByTestId("kode-serah")).toBeVisible();
    await axeBersih(page, "petugas-serah-dibuat");
  });
});

test.describe("S30-3: Peran Pengangkut (/pengangkut, /pengangkut/serah/[kode], /kendaraan, /tagihan, /izin)", () => {
  test("daftar serah & aturan R-10 BMKG di /pengangkut", async ({ page }) => {
    await page.goto("/pengangkut");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.A1_JUDUL })).toBeVisible();
    const kartu = page.locator("[data-kode]").first();
    await expect(kartu).toContainText(TEKS.STATUS_PRIORITAS_ANGKUT);
    await expect(kartu).toContainText(TEKS.R10_CATATAN);
    await expect(kartu).toContainText(TEKS.BMKG_ATRIBUSI);
    await axeBersih(page, "pengangkut-daftar");
  });

  test("serah muatan, foto, R-01 tolak TPST, kirim sah di /pengangkut/serah/[kode]", async ({ page }) => {
    await page.goto(`/pengangkut/serah/${KODE(1)}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await axeBersih(page, "pengangkut-serah-awal");

    // Ambil foto muatan
    await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();
    const ambil = page.getByRole("button", { name: TEKS.A2_FOTO });
    await expect(ambil).toBeEnabled();
    await ambil.click();

    // Pilih kendaraan
    await expect(page.getByLabel(TEKS.A2_KENDARAAN)).toBeVisible();
    await page.getByLabel(TEKS.A2_KENDARAAN).selectOption({ index: 1 });

    // Coba pilih TPST untuk muatan kuning -> R-01 tolak
    await page.getByRole("radio", { name: /TPST Contoh/ }).check();
    await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
    const panelR01 = page.locator('[data-aturan="R01"]');
    await expect(panelR01).toBeVisible();
    await expect(panelR01).toContainText(TEKS.ATURAN_JUDUL_TOLAK);
    await expect(panelR01).toContainText("Pasal 20 ayat (2) huruf d");
    await axeBersih(page, "pengangkut-r01-tolak");

    // Ganti ke Daur Ulang Contoh Mandiri -> Kirim
    await page.getByRole("radio", { name: /Daur Ulang Contoh Mandiri/ }).check();
    await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
    await expect(page.getByText(TEKS.A2_TERKIRIM)).toBeVisible();
    await axeBersih(page, "pengangkut-terkirim");
  });

  test("layar kendaraan di /pengangkut/kendaraan", async ({ page }) => {
    await page.goto("/pengangkut/kendaraan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.KND_JUDUL })).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.KND_TAMBAH })).toBeVisible();
    await axeBersih(page, "pengangkut-kendaraan");
  });

  test("layar tagihan angkut di /pengangkut/tagihan-angkut", async ({ page }) => {
    await page.goto("/pengangkut/tagihan-angkut");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.TGA_JUDUL })).toBeVisible();
    await expect(page.getByText(TEKS.TGA_PENJELASAN)).toBeVisible();
    await axeBersih(page, "pengangkut-tagihan-angkut");
  });

  test("layar izin usaha di /pengangkut/izin", async ({ page }) => {
    await page.goto("/pengangkut/izin");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.IZN_JUDUL })).toBeVisible();
    await expect(page.getByTestId("status-izin")).toBeVisible();
    await axeBersih(page, "pengangkut-izin");
  });
});

test.describe("S30-4: Peran Pengelola Kawasan (/kawasan, /setujui, /laporan, /ditolak, /koreksi, /bayangan, /tagihan, /langganan)", () => {
  test("layar ringkasan di /kawasan", async ({ page }) => {
    await page.goto("/kawasan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.K1_JUDUL })).toBeVisible();
    await expect(page.getByTestId("menunggu-setuju")).toBeVisible();
    await expect(page.getByRole("heading", { name: TEKS.K1_HARI_INI })).toBeVisible();
    await expect(page.getByRole("heading", { name: TEKS.K1_BULAN_INI })).toBeVisible();
    await axeBersih(page, "kawasan-ringkasan");
  });

  test("layar persetujuan di /kawasan/setujui/[kode]", async ({ page }) => {
    await page.goto(`/kawasan/setujui/${KODE(2)}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: TEKS.K2_SETUJUI }).click();
    await expect(page.getByText(isi("K2_DISETUJUI", { kode_serah: KODE(2) }))).toBeVisible();
    await axeBersih(page, "kawasan-disetujui");
  });

  test("layar laporan tiga tab di /kawasan/laporan", async ({ page }) => {
    await page.goto("/kawasan/laporan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.K4_JUDUL })).toBeVisible();
    await expect(page.getByRole("tab", { name: TEKS.LAPORAN_KAWASAN })).toBeVisible();
    await expect(page.getByRole("tab", { name: TEKS.LAPORAN_PENGANGKUT })).toBeVisible();
    await expect(page.getByRole("tab", { name: TEKS.LAPORAN_PENERIMA })).toBeVisible();
    await axeBersih(page, "kawasan-laporan");
  });

  test("layar penyebab ditolak di /kawasan/ditolak", async ({ page }) => {
    await page.goto("/kawasan/ditolak");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.K3_JUDUL })).toBeVisible();
    await expect(page.getByTestId("diterima-vs")).toBeVisible();
    await axeBersih(page, "kawasan-ditolak");
  });

  test("layar permintaan koreksi di /kawasan/koreksi", async ({ page }) => {
    await page.goto("/kawasan/koreksi");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.PKR_JUDUL })).toBeVisible();
    await expect(page.getByTestId("daftar-koreksi")).toBeVisible();
    await axeBersih(page, "kawasan-koreksi");
  });

  test("layar mode bayangan di /kawasan/bayangan", async ({ page }) => {
    await page.goto("/kawasan/bayangan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.BYG_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.BYG_TAMBAH })).toBeVisible();
    await axeBersih(page, "kawasan-bayangan");
  });

  test("layar tagihan angkut di /kawasan/tagihan-angkut", async ({ page }) => {
    await page.goto("/kawasan/tagihan-angkut");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.TGA_JUDUL })).toBeVisible();
    await axeBersih(page, "kawasan-tagihan-angkut");
  });

  test("layar langganan di /kawasan/langganan", async ({ page }) => {
    await page.goto("/kawasan/langganan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.LGN_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.TGH_JUDUL })).toBeVisible();
    await axeBersih(page, "kawasan-langganan");
  });
});

test.describe("S30-5: Peran Penerima (/penerima, /serah/[kode], /laporan, /koreksi, /izin)", () => {
  test("layar daftar masuk di /penerima", async ({ page }) => {
    await page.goto("/penerima");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.P1_JUDUL })).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.P1_PINDAI })).toBeVisible();
    await axeBersih(page, "penerima-daftar");
  });

  test("tutup serah: tiket timbang & terima sebagian di /penerima/serah/[kode]", async ({ page }) => {
    await page.goto(`/penerima/serah/${KODE(3)}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await axeBersih(page, "penerima-serah-awal");

    // Buka mode isi manual
    await page.getByRole("button", { name: TEKS.P1_ISI_MANUAL }).click();
    await expect(page.getByLabel(TEKS.P1_BERAT_TIKET)).toBeVisible();

    // Isi berat tiket 30 kg & konfirmasi
    await page.getByLabel(TEKS.P1_BERAT_TIKET).fill("30");
    await page.getByRole("button", { name: TEKS.P1_KONFIRMASI_AI }).click();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.P1_PER_ALIRAN })).toBeVisible();

    // Terima sebagian: 24 kg diterima, 6 kg ditolak karena BASAH_KOTOR
    await page.getByLabel(TEKS.P1_DITERIMA).fill("24");
    await page.getByLabel(TEKS.P1_DITOLAK).fill("6");
    await page.getByLabel(TEKS.UMUM_ALASAN).selectOption("BASAH_KOTOR");

    await page.getByRole("button", { name: TEKS.P1_TOLAK_SEBAGIAN }).click();
    await expect(page.getByText(isi("P1_DITUTUP", { kode_serah: KODE(3) }))).toBeVisible();
    await axeBersih(page, "penerima-serah-ditutup");
  });

  test("layar laporan penerima di /penerima/laporan", async ({ page }) => {
    await page.goto("/penerima/laporan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.P2_JUDUL })).toBeVisible();
    await axeBersih(page, "penerima-laporan");
  });

  test("layar permintaan koreksi di /penerima/koreksi", async ({ page }) => {
    await page.goto("/penerima/koreksi");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.PKR_JUDUL })).toBeVisible();
    await axeBersih(page, "penerima-koreksi");
  });

  test("layar izin usaha di /penerima/izin", async ({ page }) => {
    await page.goto("/penerima/izin");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.IZN_JUDUL })).toBeVisible();
    await expect(page.getByTestId("status-izin")).toBeVisible();
    await axeBersih(page, "penerima-izin");
  });
});
