import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS } from "@serah/kontrak/teks";

// S12 — layar laporan, K1/K3/K4, P2, laporan pengangkut, /serah/[kode], /rantai. NEXT_PUBLIC_API_MOCK=true.

async function axeBersih(page: Page) {
  const hasil = await new AxeBuilder({ page }).analyze();
  const parah = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(parah.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.describe("K1 /kawasan", () => {
  test("neraca, menunggu persetujuan, prioritas dengan catatan + atribusi, peringatan; periksa rantai", async ({ page }) => {
    await page.goto("/kawasan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.K1_JUDUL);
    await expect(page.getByTestId("menunggu-setuju")).toContainText(TEKS.K1_MENUNGGU_SETUJU);
    await expect(page.getByRole("heading", { name: TEKS.K1_HARI_INI })).toBeVisible();
    await expect(page.getByRole("heading", { name: TEKS.K1_BULAN_INI })).toBeVisible();
    await expect(page.locator('[data-aksi="PRIORITAS"]')).toContainText(TEKS.R10_CATATAN);
    await expect(page.getByText(TEKS.BMKG_ATRIBUSI)).toBeVisible();
    await expect(page.locator('[data-aturan="R06"]')).toBeVisible();
    await axeBersih(page);

    await page.getByRole("button", { name: TEKS.RANTAI_PERIKSA }).click();
    const hasil = page.getByTestId("hasil-rantai");
    await expect(hasil).toHaveAttribute("data-utuh", "true");
    await expect(hasil).toHaveText(/\d+ catatan telah diperiksa\./);
  });
});

test.describe("K3 /kawasan/ditolak", () => {
  test("tabel penyebab, penjelasan selisih, ringkasan diterima vs ditolak; tanpa sumber harga bila harga tak ada", async ({ page }) => {
    await page.goto("/kawasan/ditolak");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.K3_JUDUL);
    await expect(page.getByTestId("diterima-vs")).toContainText("kg diterima");
    await expect(page.getByTestId("selisih-penjelasan")).toHaveText(TEKS.K3_SELISIH_PENJELASAN);
    await expect(page.getByRole("columnheader", { name: TEKS.K3_KOLOM_SELISIH })).toBeVisible();
    await expect(page.getByRole("cell", { name: TEKS.ALASAN_BASAH_KOTOR })).toBeVisible();
    await expect(page.getByTestId("sumber-harga")).toHaveCount(0);
    await axeBersih(page);
  });
});

test.describe("K4 /kawasan/laporan", () => {
  test("tiga tab menampilkan total yang identik; kode serah menaut ke detail", async ({ page }) => {
    await page.goto("/kawasan/laporan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.K4_JUDUL);
    const total: string[] = [];
    for (const judul of [TEKS.LAPORAN_KAWASAN, TEKS.LAPORAN_PENGANGKUT, TEKS.LAPORAN_PENERIMA]) {
      await page.getByRole("tab", { name: judul }).click();
      const panel = page.getByTestId("total-laporan");
      await expect(panel).toBeVisible();
      total.push(((await panel.innerText()) ?? "").replace(/\s+/g, " ").trim());
    }
    expect(total[0]).toContain(TEKS.LAPORAN_TOTAL);
    expect(total[1]).toBe(total[0]);
    expect(total[2]).toBe(total[0]);
    // Sidik di tabel dipotong 8 karakter pertama.
    await expect(page.getByTestId("laporan-penerima").locator("tbody tr").first().locator("td").last()).toHaveText(/^[0-9a-f]{8}$/);
    await axeBersih(page);
  });

  test("CSV terunduh; PDF dan Lembar Neraca tersedia dengan hak", async ({ page }) => {
    await page.goto("/kawasan/laporan");
    await expect(page.getByTestId("laporan-kawasan")).toBeVisible();
    const unduhan = page.waitForEvent("download");
    await page.getByRole("button", { name: TEKS.EKSPOR_CSV }).click();
    expect((await unduhan).suggestedFilename()).toMatch(/^laporan-kawasan-\d{4}-\d{2}\.csv$/);
    const pdf = page.waitForEvent("download");
    await page.getByRole("button", { name: TEKS.EKSPOR_PDF }).click();
    expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
    const lembar = page.waitForEvent("download");
    await page.getByRole("button", { name: TEKS.UMUM_UNDUH, exact: true }).click();
    expect((await lembar).suggestedFilename()).toMatch(/^lembar-neraca-\d{4}-\d{2}\.pdf$/);
  });

  test("tanpa hak: PDF dan Lembar menampilkan G_HAK_PAKET; CSV tetap jalan", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("serah.mock.tanpaHak", "1"));
    await page.goto("/kawasan/laporan");
    await expect(page.getByTestId("laporan-kawasan")).toBeVisible();
    await page.getByRole("button", { name: TEKS.EKSPOR_PDF }).click();
    await expect(page.getByTestId("hak-ekspor.pdf")).toHaveText(TEKS.G_HAK_PAKET);
    await page.getByRole("button", { name: TEKS.UMUM_UNDUH, exact: true }).click();
    await expect(page.getByTestId("hak-lembar_neraca")).toHaveText(TEKS.G_HAK_PAKET);
    const unduhan = page.waitForEvent("download");
    await page.getByRole("button", { name: TEKS.EKSPOR_CSV }).click();
    expect((await unduhan).suggestedFilename()).toMatch(/\.csv$/);
  });
});

test.describe("P2 dan laporan pengangkut", () => {
  test("P2 /penerima/laporan memuat laporan penerima", async ({ page }) => {
    await page.goto("/penerima/laporan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.P2_JUDUL);
    await expect(page.getByTestId("laporan-penerima")).toBeVisible();
    await axeBersih(page);
  });
  test("/pengangkut/laporan memuat laporan pengangkut", async ({ page }) => {
    await page.goto("/pengangkut/laporan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.LAPORAN_PENGANGKUT);
    await expect(page.getByTestId("laporan-pengangkut")).toBeVisible();
    await axeBersih(page);
  });
});

test.describe("/serah/[kode] dan /rantai", () => {
  test("detail: timeline dengan sidik 8 karakter, salin sidik penuh; lulus axe", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/kawasan/laporan");
    await page.getByTestId("laporan-kawasan").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/serah\/SRH-\d{8}-\d{4}$/);
    const timeline = page.getByTestId("timeline");
    await expect(timeline.locator("li").first()).toBeVisible();
    const tombol = timeline.locator("button[data-sidik-penuh]").first();
    const penuh = (await tombol.getAttribute("data-sidik-penuh")) ?? "";
    expect(penuh).toMatch(/^[0-9a-f]{64}$/);
    await expect(tombol).toContainText(penuh.slice(0, 8));
    await expect(tombol).not.toContainText(penuh.slice(0, 9));
    await tombol.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(penuh);
    await axeBersih(page);
  });

  test("/rantai: periksa rantai kawasan yang dilayani", async ({ page }) => {
    await page.goto("/kawasan");
    await page.goto("/rantai");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.RANTAI_JUDUL);
    await page.getByRole("button", { name: TEKS.RANTAI_PERIKSA }).click();
    await expect(page.getByTestId("hasil-rantai")).toHaveText(/^Rantai catatan utuh./);
    await axeBersih(page);
  });
});
