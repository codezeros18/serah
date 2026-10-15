import AxeBuilder from "@axe-core/playwright";
import { expect as expectDasar, test, type Page } from "@playwright/test";
import { TEKS } from "@serah/kontrak/teks";

// S12-5 — layar laporan terhadap API NYATA. Syarat: DB ber-seed demo (`DEMO_MODE=true pnpm db:reset`), dev server
// dengan NEXT_PUBLIC_API_MOCK=false, DEMO_MODE=true, BASE_URL = alamat server uji. Dilewati bila mock aktif.
// PDF (ekspor & Lembar Neraca) belum diuji nyata: menunggu S23.

// Dev server kompilasi per halaman saat pertama dibuka; beri asersi waktu lebih panjang daripada bawaan 5 dtk.
const expect = expectDasar.configure({ timeout: 40_000 });

test.skip(process.env.NEXT_PUBLIC_API_MOCK === "true", "spesifikasi ini khusus API nyata");

async function masuk(page: Page, baseURL: string, peran: "PENGELOLA" | "PENGANGKUT" | "PENERIMA") {
  const r = await page.request.post("/api/auth/demo", { data: { peran }, headers: { Origin: baseURL } });
  expect(r.ok()).toBe(true);
}

async function axeBersih(page: Page) {
  const hasil = await new AxeBuilder({ page }).analyze();
  expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

test("K1 nyata: ringkasan, neraca, periksa rantai utuh", async ({ page, baseURL }) => {
  await masuk(page, baseURL ?? "http://localhost:3000", "PENGELOLA");
  await page.goto("/kawasan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.K1_JUDUL);
  await expect(page.getByTestId("menunggu-setuju")).toBeVisible();
  await expect(page.getByRole("heading", { name: TEKS.K1_BULAN_INI })).toBeVisible();
  await axeBersih(page);
  await page.getByRole("button", { name: TEKS.RANTAI_PERIKSA }).click();
  await expect(page.getByTestId("hasil-rantai")).toHaveAttribute("data-utuh", "true");
});

test("K4 nyata: tiga tab dengan total identik; CSV terunduh", async ({ page, baseURL }) => {
  await masuk(page, baseURL ?? "http://localhost:3000", "PENGELOLA");
  await page.goto("/kawasan/laporan");
  const total: string[] = [];
  for (const judul of [TEKS.LAPORAN_KAWASAN, TEKS.LAPORAN_PENGANGKUT, TEKS.LAPORAN_PENERIMA]) {
    await page.getByRole("tab", { name: judul }).click();
    const panel = page.getByTestId("total-laporan");
    await expect(panel).toBeVisible();
    total.push((await panel.innerText()).replace(/\s+/g, " ").trim());
  }
  expect(total[1]).toBe(total[0]);
  expect(total[2]).toBe(total[0]);

  await page.getByRole("tab", { name: TEKS.LAPORAN_KAWASAN }).click();
  const unduhan = page.waitForEvent("download");
  await page.getByRole("button", { name: TEKS.EKSPOR_CSV }).click();
  expect((await unduhan).suggestedFilename()).toMatch(/\.csv$/);
});

test("K3 nyata: penyebab ditolak memuat penjelasan selisih", async ({ page, baseURL }) => {
  await masuk(page, baseURL ?? "http://localhost:3000", "PENGELOLA");
  await page.goto("/kawasan/ditolak");
  await expect(page.getByTestId("selisih-penjelasan")).toHaveText(TEKS.K3_SELISIH_PENJELASAN);
  await axeBersih(page);
});

test("detail serah nyata: timeline berantai dengan sidik 64 hex; rantai utuh", async ({ page, baseURL }) => {
  await masuk(page, baseURL ?? "http://localhost:3000", "PENGELOLA");
  await page.goto("/kawasan/laporan");
  const tautan = page.getByTestId("laporan-kawasan").getByRole("link").first();
  await tautan.click();
  await expect(page).toHaveURL(/\/serah\/SRH-\d{8}-\d{4}$/);
  const tombol = page.getByTestId("timeline").locator("button[data-sidik-penuh]");
  await expect(tombol.first()).toBeVisible();
  for (const t of await tombol.all()) expect((await t.getAttribute("data-sidik-penuh")) ?? "").toMatch(/^[0-9a-f]{64}$/);
  await axeBersih(page);
  await page.goto("/rantai");
  await page.getByRole("button", { name: TEKS.RANTAI_PERIKSA }).click();
  await expect(page.getByTestId("hasil-rantai")).toHaveAttribute("data-utuh", "true");
});

test("laporan pengangkut dan penerima nyata tampil", async ({ page, baseURL }) => {
  await masuk(page, baseURL ?? "http://localhost:3000", "PENGANGKUT");
  await page.goto("/pengangkut/laporan");
  await expect(page.getByTestId("laporan-pengangkut")).toBeVisible();
  await masuk(page, baseURL ?? "http://localhost:3000", "PENERIMA");
  await page.goto("/penerima/laporan");
  await expect(page.getByTestId("laporan-penerima")).toBeVisible();
});
