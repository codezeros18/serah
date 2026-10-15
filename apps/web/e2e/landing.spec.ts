import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { TEKS } from "@serah/kontrak/teks";

test("landing menampilkan judul dan lulus axe tanpa pelanggaran serius", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.LANDING_JUDUL);
  const hasil = await new AxeBuilder({ page }).analyze();
  expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("health mengembalikan versi", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.ok()).toBe(true);
  const isi = await r.json();
  expect(isi.ok).toBe(true);
  expect(typeof isi.data.versi).toBe("string");
});
