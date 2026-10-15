import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS, isi } from "@serah/kontrak/teks";

// S10 — layar A1/A2/K2/P1 dengan API mock (NEXT_PUBLIC_API_MOCK=true).

test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

const HARI = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, "");
const KODE = (n: number) => `SRH-${HARI}-${String(n).padStart(4, "0")}`;

async function skenario(page: Page, kunci: string, nilai: string) {
  await page.addInitScript(([k, v]) => sessionStorage.setItem(`serah.mock.${k}`, v as string), [kunci, nilai]);
}

async function axeBersih(page: Page) {
  const h = await new AxeBuilder({ page }).analyze();
  expect(h.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

async function ambilFotoMuatan(page: Page) {
  await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();
  const ambil = page.getByRole("button", { name: TEKS.A2_FOTO });
  await expect(ambil).toBeEnabled();
  await ambil.click();
}

test.describe("A1", () => {
  test("prioritas di atas, dengan teks R-10, R10_CATATAN dan atribusi BMKG", async ({ page }) => {
    await page.goto("/pengangkut");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.A1_JUDUL })).toBeVisible();
    const kartu = page.locator("[data-kode]").first();
    await expect(kartu).toContainText(TEKS.STATUS_PRIORITAS_ANGKUT);
    await expect(kartu).toContainText(TEKS.R10_CATATAN);
    await expect(kartu).toContainText(TEKS.BMKG_ATRIBUSI);
    await expect(kartu).toContainText(/Hujan Lebat/);
    await axeBersih(page);
  });
});

test.describe("A2", () => {
  async function sampaiTujuan(page: Page) {
    await page.goto(`/pengangkut/serah/${KODE(1)}`);
    await ambilFotoMuatan(page);
    await expect(page.getByLabel(TEKS.A2_KENDARAAN)).toBeVisible();
    await page.getByLabel(TEKS.A2_KENDARAAN).selectOption({ index: 1 });
  }

  test("R-01: memilih TPST untuk muatan KUNING → panel TOLAK dengan kutipan pasal", async ({ page }) => {
    await sampaiTujuan(page);
    await page.getByRole("radio", { name: /TPST Contoh/ }).check();
    await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
    const panel = page.locator('[data-aturan="R01"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(TEKS.ATURAN_JUDUL_TOLAK);
    await expect(panel).toContainText(isi("ATURAN_R01", { aliran: "KUNING" }));
    await expect(panel).toContainText("Pasal 20 ayat (2) huruf d");
    await expect(panel).toContainText(TEKS.ATURAN_BUKAN_NASIHAT);
    await axeBersih(page);
  });

  test("R-11: penerima izin belum terverifikasi", async ({ page }) => {
    await sampaiTujuan(page);
    await page.getByRole("radio", { name: /Pelapak Contoh Baru/ }).check();
    await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
    await expect(page.locator('[data-aturan="R11"]')).toContainText(TEKS.ATURAN_R11);
  });

  test("R-03: penerima tidak menerima aliran muatan", async ({ page }) => {
    await sampaiTujuan(page);
    await page.getByRole("radio", { name: /TPS3R Contoh/ }).check();
    await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
    await expect(page.locator('[data-aturan="R03"]')).toContainText(isi("ATURAN_R03", { aliran: "KUNING" }));
  });

  test("R-04: foto terlalu mirip → panel TOLAK dan minta foto ulang", async ({ page }) => {
    await skenario(page, "r04", "1");
    await page.goto(`/pengangkut/serah/${KODE(1)}`);
    await ambilFotoMuatan(page);
    await expect(page.locator('[data-aturan="R04"]')).toContainText(isi("ATURAN_R04", { kode_serah: KODE(4) }));
    await expect(page.getByRole("button", { name: TEKS.A2_FOTO_ULANG })).toBeVisible();
  });

  test("tujuan sah → menunggu persetujuan; tanpa input galeri", async ({ page }) => {
    await sampaiTujuan(page);
    expect(await page.locator('input[type="file"]').count()).toBe(0);
    await page.getByRole("radio", { name: /Daur Ulang Contoh Mandiri/ }).check();
    await page.getByRole("button", { name: TEKS.A2_KIRIM }).click();
    await expect(page.getByText(TEKS.A2_TERKIRIM)).toBeVisible();
  });
});

test.describe("K2", () => {
  test("setujui → DIANGKUT", async ({ page }) => {
    await page.goto(`/kawasan/setujui/${KODE(2)}`);
    await page.getByRole("button", { name: TEKS.K2_SETUJUI }).click();
    await expect(page.getByText(isi("K2_DISETUJUI", { kode_serah: KODE(2) }))).toBeVisible();
    await axeBersih(page);
  });

  test("kembalikan: alasan wajib", async ({ page }) => {
    await page.goto(`/kawasan/setujui/${KODE(2)}`);
    await page.getByRole("button", { name: TEKS.K2_KEMBALIKAN }).click();
    await page.getByRole("button", { name: TEKS.K2_KEMBALIKAN }).click();
    await expect(page.getByText(TEKS.UMUM_ALASAN_WAJIB)).toBeVisible();
    await page.getByLabel(TEKS.UMUM_ALASAN).fill("Foto muatan kurang jelas");
    await page.getByRole("button", { name: TEKS.K2_KEMBALIKAN }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });
});

test.describe("P1", () => {
  async function fotoTiket(page: Page) {
    await page.goto(`/penerima/serah/${KODE(3)}`);
    const ambil = page.getByRole("button", { name: TEKS.P1_FOTO_TIKET }).last();
    await expect(ambil).toBeEnabled();
    await ambil.click();
  }

  test("AI mati → G_AI_MATI, isi manual, jumlah harus sama, sebagian + alasan", async ({ page }) => {
    await skenario(page, "ai", "MATI");
    await fotoTiket(page);
    await expect(page.getByText(TEKS.G_AI_MATI)).toBeVisible();
    await page.getByLabel(TEKS.P1_BERAT_TIKET).fill("30");
    await page.getByRole("button", { name: TEKS.P1_KONFIRMASI_AI }).click();

    await page.getByLabel(TEKS.P1_DITERIMA).fill("20");
    await page.getByLabel(TEKS.P1_DITOLAK).fill("5");
    await expect(page.getByText(isi("P1_JUMLAH_TIDAK_SAMA", { berat_tiket: "30" }))).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.P1_TOLAK_SEBAGIAN })).toBeDisabled();

    await page.getByLabel(TEKS.P1_DITOLAK).fill("10");
    await expect(page.getByRole("button", { name: TEKS.P1_TOLAK_SEBAGIAN })).toBeDisabled(); // alasan belum dipilih
    await page.getByLabel(TEKS.UMUM_ALASAN).selectOption("BASAH_KOTOR");
    await page.getByRole("button", { name: TEKS.P1_TOLAK_SEBAGIAN }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEKS.UMUM_KONFIRMASI }).click();
    await expect(page.getByText(isi("P1_DITUTUP", { kode_serah: KODE(3) }))).toBeVisible();
    await axeBersih(page);
  });

  test("AI TINGGI → AI_LABEL, angka terisi, tetap wajib konfirmasi", async ({ page }) => {
    await fotoTiket(page);
    await expect(page.getByText(TEKS.AI_LABEL)).toBeVisible();
    await expect(page.getByLabel(TEKS.P1_BERAT_TIKET)).toHaveValue("30");
    // Tanpa konfirmasi, rincian belum tampil.
    await expect(page.getByText(TEKS.P1_PER_ALIRAN)).toHaveCount(0);
    await page.getByRole("button", { name: TEKS.P1_KONFIRMASI_AI }).click();
    await page.getByLabel(TEKS.P1_DITERIMA).fill("30");
    await page.getByRole("button", { name: TEKS.P1_TERIMA }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEKS.UMUM_KONFIRMASI }).click();
    await expect(page.getByText(isi("P1_DITUTUP", { kode_serah: KODE(3) }))).toBeVisible();
  });

  test("AI ragu → G_AI_RAGU", async ({ page }) => {
    await skenario(page, "ai", "RAGU");
    await fotoTiket(page);
    await expect(page.getByText(TEKS.G_AI_RAGU)).toBeVisible();
    await expect(page.getByText(TEKS.AI_LABEL)).toHaveCount(0);
  });

  test("R-08: konfirmasi kedua, tidak menolak; lalu koreksi berat", async ({ page }) => {
    await skenario(page, "ai", "MATI");
    await fotoTiket(page);
    await page.getByLabel(TEKS.P1_BERAT_TIKET).fill("60");
    await page.getByRole("button", { name: TEKS.P1_KONFIRMASI_AI }).click();
    await page.getByLabel(TEKS.P1_DITERIMA).fill("60");
    await page.getByRole("button", { name: TEKS.P1_TERIMA }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEKS.UMUM_KONFIRMASI }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(isi("ATURAN_R08", { berat_tiket: "60", persen: 100, berat_tps: "30" }));
    await expect(page.getByText(isi("P1_DITUTUP", { kode_serah: KODE(3) }))).toBeVisible();

    await dialog.getByRole("button", { name: TEKS.P1_KOREKSI }).click();
    await page.locator("#koreksi-tiket").fill("30");
    await page.locator('[id^="koreksi-d-"]').first().fill("30");
    await page.getByLabel(TEKS.UMUM_ALASAN).last().fill("Salah baca tiket");
    await page.getByRole("button", { name: TEKS.UMUM_KIRIM }).click();
    await expect(page.getByText(`✓ ${TEKS.P1_KOREKSI}`)).toBeVisible();
  });
});
