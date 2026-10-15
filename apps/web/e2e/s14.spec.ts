import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS, isi } from "@serah/kontrak/teks";

async function axeBersih(page: Page) {
  const h = await new AxeBuilder({ page }).analyze();
  expect(
    h.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);
}

test.describe("S14: Layar publik auth, onboarding, dan pengelolaan", () => {
  test("Auth: halaman masuk, tombol demo, daftar, dan lupa-sandi", async ({ page }) => {
    await page.goto("/masuk");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.MASUK_JUDUL })).toBeVisible();

    const tombolDemoPengelola = page.getByRole("button", {
      name: isi("MASUK_DEMO", { peran: TEKS.PERAN_PENGELOLA }),
    });
    await expect(tombolDemoPengelola).toBeVisible();

    await axeBersih(page);

    await page.goto("/daftar");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.DAFTAR_JUDUL })).toBeVisible();
    await expect(page.getByText(TEKS.DAFTAR_SETUJU)).toBeVisible();
    await axeBersih(page);

    await page.goto("/lupa-sandi");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.LUPA_JUDUL })).toBeVisible();
    await axeBersih(page);
  });

  test("Onboarding: alur /mulai 4 langkah", async ({ page }) => {
    await page.goto("/mulai");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.MULAI_JUDUL })).toBeVisible();
    await expect(page.getByText(TEKS.MULAI_L1_KAWASAN)).toBeVisible();

    // Pilih jenis kawasan
    await page.getByRole("radio", { name: TEKS.MULAI_L1_KAWASAN }).check();
    await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();

    await expect(page.getByRole("heading", { level: 2, name: TEKS.MULAI_L2 })).toBeVisible();

    // Isi nama organisasi
    await page.getByLabel(TEKS.MULAI_L2_NAMA).fill("PT Kawasan Lestari");
    await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();

    // Langkah 3: TPS awal
    await expect(page.getByRole("heading", { level: 2, name: TEKS.MULAI_L3_KAWASAN })).toBeVisible();
    await page.getByLabel(TEKS.TPS_NAMA).fill("TPS Utama");
    await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();

    // Langkah 4: Anggota
    await expect(page.getByRole("heading", { level: 2, name: TEKS.MULAI_L4 })).toBeVisible();
    await axeBersih(page);
  });

  test("Pengelolaan: TPS dan Cetak QR", async ({ page }) => {
    await page.goto("/kawasan/tps");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.TPS_JUDUL })).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.TPS_TAMBAH })).toBeVisible();
    await axeBersih(page);

    await page.goto("/kawasan/tps/cetak");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.TPS_CETAK_QR })).toBeVisible();
    await axeBersih(page);
  });

  test("Pengelolaan: Kontrak kawasan", async ({ page }) => {
    await page.goto("/kawasan/kontrak");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.KTR_JUDUL })).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.KTR_TAMBAH })).toBeVisible();
    await axeBersih(page);
  });

  test("Pengelolaan: Kendaraan pengangkut", async ({ page }) => {
    await page.goto("/pengangkut/kendaraan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.KND_JUDUL })).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.KND_TAMBAH })).toBeVisible();
    await axeBersih(page);
  });

  test("Akun: organisasi, peran, notifikasi, dan privasi", async ({ page }) => {
    await page.goto("/akun");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.AKUN_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.AKUN_ORGANISASI })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.AKUN_NOTIFIKASI })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.AKUN_PRIVASI })).toBeVisible();

    await expect(page.getByRole("button", { name: TEKS.AKUN_UNDUH_DATA })).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.AKUN_TARIK })).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.AKUN_HAPUS })).toBeVisible();

    await axeBersih(page);
  });
});
