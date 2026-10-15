import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS } from "@serah/kontrak/teks";

const HARI = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, "");
const KODE = (n: number) => `SRH-${HARI}-${String(n).padStart(4, "0")}`;

async function axeBersih(page: Page) {
  const h = await new AxeBuilder({ page }).analyze();
  expect(
    h.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);
}

test.describe("S25: Layar koreksi, izin, tagihan angkut, dan mode bayangan", () => {
  test("S25-1: Tombol dan dialog ajukan koreksi di /serah/[kode]", async ({ page }) => {
    // Serah ke-4 (tutup DITERIMA)
    const kodeSerah = KODE(4);
    await page.goto(`/serah/${kodeSerah}`);
    await expect(page.getByTestId("kode-serah")).toBeVisible({ timeout: 20_000 });

    // Tombol ajukan koreksi
    const tombolAjukan = page.getByRole("button", { name: TEKS.PKR_AJUKAN });
    await expect(tombolAjukan).toBeVisible();
    await tombolAjukan.click();

    // Dialog terbuka
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(TEKS.PKR_PETUNJUK)).toBeVisible();

    // Isi formulir koreksi
    const inputNilai = dialog.locator("input#koreksi-nilai-usulan");
    await inputNilai.fill("35,0");

    const inputAlasan = dialog.locator("textarea#koreksi-alasan");
    await inputAlasan.fill("Timbangan awal salah baca");

    await axeBersih(page);

    // Kirim permintaan koreksi
    const tombolKirim = dialog.getByRole("button", { name: TEKS.UMUM_KIRIM });
    await expect(tombolKirim).toBeEnabled();
    await tombolKirim.click();

    // Muncul status konfirmasi
    await expect(dialog.getByRole("status")).toBeVisible();
  });

  test("S25-2: Layar permintaan koreksi di /kawasan/koreksi dan /penerima/koreksi", async ({ page }) => {
    // Layar kawasan
    await page.goto("/kawasan/koreksi");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.PKR_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.PKR_PETUNJUK)).toBeVisible();

    await axeBersih(page);

    // Periksa daftar koreksi dan tombol putusan
    const daftarKoreksi = page.getByTestId("daftar-koreksi");
    await expect(daftarKoreksi).toBeVisible();

    const tombolSetujui = page.getByRole("button", { name: TEKS.PKR_SETUJUI }).first();
    const tombolTolak = page.getByRole("button", { name: TEKS.PKR_TOLAK }).first();
    await expect(tombolSetujui).toBeVisible();
    await expect(tombolTolak).toBeVisible();

    // Putus setujui
    await tombolSetujui.click();

    // Layar penerima
    await page.goto("/penerima/koreksi");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.PKR_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.PKR_PETUNJUK)).toBeVisible();

    await axeBersih(page);
  });

  test("S25-3: Layar izin usaha di /pengangkut/izin dan /penerima/izin", async ({ page }) => {
    // Pengangkut
    await page.goto("/pengangkut/izin");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.IZN_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.IZN_PENJELASAN)).toBeVisible();
    await expect(page.getByTestId("status-izin")).toBeVisible();

    await axeBersih(page);

    // Formulir permohonan izin
    const inputNomor = page.locator("input#izin-nomor");
    await inputNomor.fill("503/001/PENGANGKUT/2026");

    const inputDokumen = page.locator("input#izin-dokumen");
    await inputDokumen.setInputFiles({
      name: "dokumen-izin.png",
      mimeType: "image/png",
      buffer: Buffer.from("dokumen-palsu"),
    });

    const tombolAjukan = page.getByRole("button", { name: TEKS.IZN_AJUKAN }).last();
    await expect(tombolAjukan).toBeEnabled();
    await tombolAjukan.click();

    // Notifikasi sukses
    await expect(page.getByText(TEKS.IZN_DIAJUKAN)).toBeVisible();
    await axeBersih(page);

    // Penerima
    await page.goto("/penerima/izin");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.IZN_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.IZN_PENJELASAN)).toBeVisible();

    await axeBersih(page);
  });

  test("S25-4: Layar tagihan angkut di /pengangkut/tagihan-angkut dan /kawasan/tagihan-angkut", async ({ page }) => {
    // Pengangkut
    await page.goto("/pengangkut/tagihan-angkut");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.TGA_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.TGA_PENJELASAN)).toBeVisible();

    // Pratinjau tagihan
    await expect(page.getByText(TEKS.TGA_RIT)).toBeVisible();
    await expect(page.getByText(TEKS.TGA_KG)).toBeVisible();
    await expect(page.getByText(TEKS.TGA_TOTAL)).toBeVisible();

    // Terbitkan tagihan angkut
    const tombolTerbitkan = page.getByRole("button", { name: TEKS.TGA_TERBITKAN });
    await expect(tombolTerbitkan).toBeVisible();
    await tombolTerbitkan.click();

    await axeBersih(page);

    // Kawasan (dilindungi KunciHak)
    await page.goto("/kawasan/tagihan-angkut");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.TGA_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.TGA_PENJELASAN)).toBeVisible();

    await axeBersih(page);
  });

  test("S25-5: Layar mode bayangan di /kawasan/bayangan", async ({ page }) => {
    await page.goto("/kawasan/bayangan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.BYG_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.BYG_PENJELASAN)).toBeVisible();

    await axeBersih(page);

    // Formulir tambah angka catatan lama
    const inputSumber = page.locator("input#byg-sumber");
    await inputSumber.fill("Catatan Buku Kas TPS A");

    const inputBerat = page.locator("input#byg-berat");
    await inputBerat.fill("58,5");

    const tombolTambah = page.getByRole("button", { name: TEKS.BYG_TAMBAH });
    await expect(tombolTambah).toBeEnabled();
    await tombolTambah.click();

    // Periksa tabel perbandingan dan selisih
    await expect(page.getByRole("heading", { level: 2, name: TEKS.BYG_SELISIH })).toBeVisible();
    await expect(page.getByTestId("selisih-KUNING")).toBeVisible();
    await expect(page.getByTestId("selisih-HIJAU")).toBeVisible();

    await axeBersih(page);
  });
});
