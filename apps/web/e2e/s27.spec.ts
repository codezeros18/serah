import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS } from "@serah/kontrak/teks";

async function axeBersih(page: Page) {
  const h = await new AxeBuilder({ page }).analyze();
  expect(
    h.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);
}

test.describe("S27: Mode demo juri /demo, snapshot BMKG cadangan, dan halaman publik final", () => {
  test("S27-1: Layar /demo memiliki label demo, tombol reset berfungsi, dan 4 iframe termuat", async ({ page }) => {
    await page.goto("/demo");

    // Label demo terlihat
    await expect(page.getByText(TEKS.DEMO_LABEL)).toBeVisible({ timeout: 20_000 });

    // Tombol reset demo terlihat dan berfungsi
    const tombolReset = page.getByTestId("tombol-reset-demo");
    await expect(tombolReset).toBeVisible();
    await tombolReset.click();

    // Feedback sukses muncul
    await expect(page.getByRole("status")).toHaveText(TEKS.DEMO_RESET_SELESAI);

    // Keempat iframe termuat dengan title yang benar
    const iframePetugas = page.locator('iframe[title="Panel Petugas"]');
    const iframePengangkut = page.locator('iframe[title="Panel Pengangkut"]');
    const iframePengelola = page.locator('iframe[title="Panel Pengelola"]');
    const iframePenerima = page.locator('iframe[title="Panel Penerima"]');

    await expect(iframePetugas).toBeVisible();
    await expect(iframePengangkut).toBeVisible();
    await expect(iframePengelola).toBeVisible();
    await expect(iframePenerima).toBeVisible();

    // Cek header masing-masing peran di panel
    await expect(page.getByRole("heading", { level: 2, name: TEKS.PERAN_PETUGAS })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.PERAN_PENGANGKUT })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.PERAN_PENGELOLA })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.PERAN_PENERIMA })).toBeVisible();

    await axeBersih(page);
  });

  test("S27-3a: Halaman landing / memuat judul, subjudul, CTA, dan 5 fitur", async ({ page }) => {
    await page.goto("/");

    // Hero: judul & subjudul
    await expect(page.getByRole("heading", { level: 1, name: TEKS.LANDING_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.LANDING_SUB)).toBeVisible();

    // CTA buttons
    await expect(page.getByRole("link", { name: TEKS.LANDING_CTA })).toBeVisible();
    await expect(page.getByRole("link", { name: TEKS.LANDING_CTA_DEMO }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: TEKS.HRG_JUDUL }).first()).toBeVisible();

    // 5 Sorotan Fitur
    await expect(page.getByRole("heading", { level: 3, name: TEKS.LANDING_L1_JUDUL })).toBeVisible();
    await expect(page.getByText(TEKS.LANDING_L1_ISI)).toBeVisible();

    await expect(page.getByRole("heading", { level: 3, name: TEKS.LANDING_L2_JUDUL })).toBeVisible();
    await expect(page.getByText(TEKS.LANDING_L2_ISI)).toBeVisible();

    await expect(page.getByRole("heading", { level: 3, name: TEKS.LANDING_L3_JUDUL })).toBeVisible();
    await expect(page.getByText(TEKS.LANDING_L3_ISI)).toBeVisible();

    await expect(page.getByRole("heading", { level: 3, name: TEKS.LANDING_L4_JUDUL })).toBeVisible();
    await expect(page.getByText(TEKS.LANDING_L4_ISI)).toBeVisible();

    await expect(page.getByRole("heading", { level: 3, name: TEKS.LANDING_L5_JUDUL })).toBeVisible();
    await expect(page.getByText(TEKS.LANDING_L5_ISI)).toBeVisible();

    // Dasar regulasi & batasan
    await expect(page.getByText(TEKS.LANDING_DASAR)).toBeVisible();
    await expect(page.getByText(TEKS.LANDING_BUKAN_PORTAL)).toBeVisible();

    // Footer
    await expect(page.getByText(TEKS.KAKI_HAK_CIPTA)).toBeVisible();

    await axeBersih(page);
  });

  test("S27-3b: Halaman /tentang memuat cara kerja, 10 batasan, penjelasan AI, dan atribusi BMKG", async ({ page }) => {
    await page.goto("/#tentang");

    // Judul & Subjudul
    await expect(page.getByRole("heading", { level: 2, name: TEKS.TENTANG_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 2, name: TEKS.TENTANG_BATASAN_JUDUL })).toBeVisible();

    // 10 Batasan
    await expect(page.getByText(TEKS.TENTANG_BATASAN_1)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_2)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_3)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_4)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_5)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_6)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_7)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_8)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_9)).toBeVisible();
    await expect(page.getByText(TEKS.TENTANG_BATASAN_10)).toBeVisible();

    // Penjelasan AI & Atribusi BMKG
    await expect(page.getByText(TEKS.TENTANG_AI)).toBeVisible();
    await expect(page.getByText(TEKS.BMKG_ATRIBUSI)).toBeVisible();

    await axeBersih(page);
  });

  test("S27-3c: Halaman /privasi memuat judul, versi, banner acuan UU 27/2022, dan 9 poin", async ({ page }) => {
    await page.goto("/privasi");

    // Judul & Versi
    await expect(page.getByRole("heading", { level: 1, name: TEKS.PRIV_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(TEKS.PRIV_VERSI)).toBeVisible();

    // Banner acuan UU 27/2022
    await expect(page.getByText("UU 27/2022 PDP")).toBeVisible();
    await expect(page.getByText(TEKS.PRIV_9_ISI).first()).toBeVisible();

    // 9 Poin
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_1_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_2_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_3_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_4_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_5_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_6_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_7_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_8_JUDUL })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: TEKS.PRIV_9_JUDUL })).toBeVisible();

    await axeBersih(page);
  });

  test("S27-3d: Halaman /syarat memuat judul dan 6 poin syarat layanan", async ({ page }) => {
    await page.goto("/syarat");

    // Judul
    await expect(page.getByRole("heading", { level: 1, name: TEKS.SYR_JUDUL })).toBeVisible({ timeout: 20_000 });

    // 6 Poin
    await expect(page.getByText(TEKS.SYR_1)).toBeVisible();
    await expect(page.getByText(TEKS.SYR_2)).toBeVisible();
    await expect(page.getByText(TEKS.SYR_3)).toBeVisible();
    await expect(page.getByText(TEKS.SYR_4)).toBeVisible();
    await expect(page.getByText(TEKS.SYR_5)).toBeVisible();
    await expect(page.getByText(TEKS.SYR_6)).toBeVisible();

    await axeBersih(page);
  });
});
