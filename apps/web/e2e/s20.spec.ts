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

test.describe("S20: Layar harga, langganan, dan tagihan", () => {
  test("S20-1: Halaman publik /harga dan aksesibilitas", async ({ page }) => {
    await page.goto("/harga");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.HRG_JUDUL })).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText(TEKS.HRG_KAWASAN)).toBeVisible();
    await expect(page.getByText(TEKS.HRG_KAWASAN_DETAIL)).toBeVisible();
    await expect(page.getByText(TEKS.HRG_MITRA)).toBeVisible();

    await expect(page.getByRole("link", { name: TEKS.MULAI_JUDUL })).toBeVisible();
    await expect(page.getByRole("link", { name: TEKS.DAFTAR_JUDUL })).toBeVisible();

    await axeBersih(page);
  });

  test("S20-2: Halaman /kawasan/langganan, pembayaran sandbox, dan transfer", async ({ page }) => {
    await page.goto("/kawasan/langganan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.LGN_JUDUL })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 2, name: TEKS.TGH_JUDUL })).toBeVisible();

    await axeBersih(page);

    // Buka pembayaran online (modal sandbox)
    const tombolBayarOnline = page.getByRole("button", { name: TEKS.TGH_BAYAR_ONLINE }).first();
    await expect(tombolBayarOnline).toBeVisible();
    await tombolBayarOnline.click();

    // Pastikan modal sandbox terbuka dengan pesan TGH_SANDBOX
    await expect(page.getByText(TEKS.TGH_SANDBOX)).toBeVisible();
    await axeBersih(page);

    // Tutup modal
    await page.getByRole("button", { name: TEKS.UMUM_TUTUP }).click();
    await expect(page.getByText(TEKS.TGH_SANDBOX)).not.toBeVisible();

    // Buka formulir transfer manual
    const tombolTransfer = page.getByRole("button", { name: TEKS.TGH_TRANSFER }).first();
    await expect(tombolTransfer).toBeVisible();
    await tombolTransfer.click();

    await expect(page.getByText(TEKS.TGH_TRANSFER_PETUNJUK)).toBeVisible();

    // Unggah bukti transfer
    const inputBerkas = page.locator('input[type="file"]');
    await inputBerkas.setInputFiles({
      name: "bukti-transfer.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-image-bytes"),
    });

    const tombolUnggah = page.getByRole("button", { name: TEKS.TGH_UNGGAH_BUKTI });
    await expect(tombolUnggah).toBeEnabled();
    await tombolUnggah.click();

    // Status berubah menjadi menunggu konfirmasi
    await expect(page.getByText(TEKS.TGH_MENUNGGU_KONFIRMASI)).toBeVisible();
    await axeBersih(page);
  });
});
