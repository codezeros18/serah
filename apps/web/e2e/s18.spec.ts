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

test.describe("S18: Pusat notifikasi dan live sync", () => {
  test("Notifikasi: daftar notifikasi, penanda dibaca, dan aksesibilitas", async ({ page }) => {
    await page.goto("/notifikasi");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.NTF_JUDUL })).toBeVisible({ timeout: 20_000 });

    await axeBersih(page);

    const tombolBacaSemua = page.getByRole("button", { name: TEKS.NTF_BACA_SEMUA });
    if (await tombolBacaSemua.isVisible()) {
      await tombolBacaSemua.click();
      await expect(tombolBacaSemua).not.toBeVisible();
    }
  });
});
