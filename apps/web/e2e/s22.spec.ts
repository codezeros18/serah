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

test.describe("S22: Layar admin internal", () => {
  test("S22-1 & S22-2: Dashboard admin, dialog alasan, izin, pembayaran, paket, aturan, audit, dan metrik", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { level: 1, name: TEKS.ADM_JUDUL }),
    ).toBeVisible({ timeout: 20_000 });

    await axeBersih(page);

    // S22-1: Dialog alasan wajib sebelum melihat detail organisasi
    const tombolDetail = page.getByRole("button", { name: TEKS.UMUM_LIHAT_DETAIL }).first();
    await expect(tombolDetail).toBeVisible();
    await tombolDetail.click();

    // Dialog alasan harus terbuka
    const dialogAlasan = page.getByRole("dialog");
    await expect(dialogAlasan).toBeVisible();
    const inputAlasan = page.locator("textarea#input-alasan-admin");
    await expect(inputAlasan).toBeVisible();

    // Alasan kurang dari 15 karakter harus ditolak
    await inputAlasan.fill("Terlalu pendek");
    await expect(page.getByText(TEKS.ADM_ALASAN_PENDEK)).toBeVisible();
    await expect(page.getByRole("button", { name: TEKS.UMUM_LANJUT })).toBeDisabled();

    // Alasan valid >= 15 karakter
    await inputAlasan.fill("Pemeriksaan audit kepatuhan tahunan 2026");
    await expect(page.getByRole("button", { name: TEKS.UMUM_LANJUT })).toBeEnabled();
    await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();

    // Detail organisasi terbuka
    await expect(page.getByRole("heading", { level: 3, name: /Detail:/ })).toBeVisible();

    // S22-2: Tab Izin
    await page.getByRole("tab", { name: TEKS.ADM_IZIN }).click();
    const tombolSetujuiIzin = page.getByRole("button", { name: TEKS.ADM_IZIN_SETUJUI }).first();
    if (await tombolSetujuiIzin.isVisible()) {
      await tombolSetujuiIzin.click();
    }

    // S22-2: Tab Pembayaran
    await page.getByRole("tab", { name: TEKS.ADM_PEMBAYARAN }).click();
    const tombolKonfirmasi = page.getByRole("button", { name: TEKS.ADM_KONFIRMASI_BAYAR }).first();
    if (await tombolKonfirmasi.isVisible()) {
      await tombolKonfirmasi.click();
      await expect(page.getByText(TEKS.TGH_LUNAS).first()).toBeVisible();
    }

    // S22-2: Tab Paket
    await page.getByRole("tab", { name: TEKS.ADM_PAKET }).click();
    await expect(page.getByText("per TPS").first()).toBeVisible();

    // S22-2: Tab Aturan
    await page.getByRole("tab", { name: TEKS.ADM_ATURAN }).click();
    await expect(page.getByRole("button", { name: TEKS.ADM_ATURAN_VERSI })).toBeVisible();
    await page.getByRole("button", { name: TEKS.ADM_ATURAN_VERSI }).click();
    await expect(page.getByText(TEKS.ADM_ATURAN_VERSI).first()).toBeVisible();

    // S22-2: Tab Audit
    await page.getByRole("tab", { name: TEKS.ADM_AUDIT }).click();
    await expect(page.getByText("BUKA_DATA_ORGANISASI").first()).toBeVisible();

    // S22-2: Tab Metrik
    await page.getByRole("tab", { name: TEKS.ADM_METRIK }).click();
    await expect(page.getByText(TEKS.ADM_METRIK_TERTUTUP)).toBeVisible();
    await expect(page.getByText(TEKS.ADM_METRIK_HARI_TERCATAT)).toBeVisible();
    await expect(page.getByText(TEKS.ADM_METRIK_KAWASAN_AKTIF)).toBeVisible();

    // Reset Demo
    const tombolReset = page.getByRole("button", { name: TEKS.DEMO_RESET });
    await expect(tombolReset).toBeVisible();
    await tombolReset.click();
    await expect(page.getByText(TEKS.DEMO_RESET_SELESAI)).toBeVisible();

    await axeBersih(page);
  });
});
