import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS } from "@serah/kontrak/teks";

// S04 — UI fondasi. Dijalankan dengan NEXT_PUBLIC_API_MOCK=true (data mock §H.5).

// Kamera palsu bawaan Chromium untuk uji otomatis; uji HP Android nyata dicatat terpisah di PROGRESS.
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

async function axeBersih(page: Page) {
  const hasil = await new AxeBuilder({ page }).analyze();
  const parah = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(parah.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.describe("komponen & token (S04-1, S04-2, S04-7)", () => {
  test("/__komponen menampilkan semua token & lulus axe", async ({ page }) => {
    await page.goto("/__komponen");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEKS.APP_NAMA);
    await expect(page.locator("[data-token]")).toHaveCount(12);
    await axeBersih(page);
  });

  test("lencana aliran selalu berlabel teks; lencana status tanpa merah", async ({ page }) => {
    await page.goto("/__komponen");
    for (const [kode, teks] of [
      ["HIJAU", TEKS.ALIRAN_HIJAU],
      ["KUNING", TEKS.ALIRAN_KUNING],
      ["MERAH", TEKS.ALIRAN_MERAH],
      ["ABU", TEKS.ALIRAN_ABU],
    ] as const) {
      await expect(page.locator(`[data-aliran="${kode}"]`).first()).toHaveText(teks);
    }
    const warna = await page.locator("span[data-status]").evaluateAll((els) =>
      els.map((e) => {
        const [r = 0, g = 0, b = 0] = (getComputedStyle(e).color.match(/\d+/g) ?? []).map(Number);
        return { r, g, b };
      }),
    );
    expect(warna.length).toBe(7);
    // Merah dominan = r jauh di atas g & b. Status tidak boleh begitu.
    for (const w of warna) expect(w.r > 150 && w.g < 90 && w.b < 90).toBe(false);
  });

  test("isian berat: 42,5 → 42500 g", async ({ page }) => {
    await page.goto("/__komponen");
    await expect(page.getByTestId("gram")).toContainText("42500 g");
    await page.getByLabel(TEKS.T1_BERAT_LABEL).fill("1,2345");
    await expect(page.getByText(TEKS.G_BERAT_TIDAK_SAH)).toBeVisible();
  });

  test("satu halaman memakai 3 rute mock", async ({ page }) => {
    await page.goto("/__komponen");
    const uji = page.getByTestId("uji-api");
    await expect(uji.getByRole("listitem")).toHaveCount(3);
    await expect(uji).toContainText("GET /api/sesi");
    await expect(uji).toContainText("GET /api/ambil");
    await expect(uji).toContainText("ringkasan");
  });
});

test.describe("layout peran (S04-3)", () => {
  const PETA = [
    ["/petugas", TEKS.T1_JUDUL, TEKS.PERAN_PETUGAS],
    ["/pengangkut", TEKS.A1_JUDUL, TEKS.PERAN_PENGANGKUT],
    ["/kawasan", TEKS.K1_JUDUL, TEKS.PERAN_PENGELOLA],
    ["/penerima", TEKS.P1_JUDUL, TEKS.PERAN_PENERIMA],
    ["/admin", TEKS.ADM_JUDUL, TEKS.PERAN_ADMIN],
  ] as const;

  for (const [jalur, judul, peran] of PETA) {
    test(`${jalur} terbuka dengan sesi mock`, async ({ page }) => {
      await page.goto(jalur);
      await expect(page.getByRole("heading", { level: 1, name: judul })).toBeVisible();
      await expect(page.locator("header")).toContainText(peran);
      await expect(page.getByText(TEKS.DEMO_LABEL)).toBeVisible();
      await expect(page.getByRole("navigation")).toBeVisible();
      await axeBersih(page);
    });
  }
});

test.describe("PWA (S04-4)", () => {
  test("manifest valid & dapat dibuka offline setelah sekali kunjungan", async ({ page, context, request }) => {
    const m = await request.get("/manifest.webmanifest");
    expect(m.ok()).toBe(true);
    const isi = await m.json();
    expect(isi.display).toBe("standalone");
    expect(isi.icons.length).toBeGreaterThanOrEqual(3);

    await page.goto("/petugas");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.T1_JUDUL })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    // Muat ulang agar halaman dikendalikan SW & cangkang tersimpan.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: TEKS.T1_JUDUL })).toBeVisible();
    await page.waitForTimeout(500);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: TEKS.T1_JUDUL })).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe("kamera (S04-5) & QR (S04-6)", () => {
  test("kamera menghasilkan foto webp/jpeg tanpa input galeri", async ({ page }) => {
    await page.goto("/__komponen");
    expect(await page.locator('input[type="file"]').count()).toBe(0);
    await page.getByRole("button", { name: TEKS.A2_FOTO }).first().click();
    const ambil = page.getByRole("button", { name: TEKS.A2_FOTO }).last();
    await expect(ambil).toBeEnabled();
    await ambil.click();
    await expect(page.getByTestId("foto")).toContainText(/image\/(webp|jpeg)/);
  });

  test("QR tampil sebagai gambar bergambar alt", async ({ page }) => {
    await page.goto("/__komponen");
    const qr = page.getByRole("img", { name: TEKS.T2_QR_PETUNJUK });
    await expect(qr).toBeVisible();
  });
});

test("kamera ditolak → G_KAMERA_DITOLAK", async ({ browser }) => {
  const konteks = await browser.newContext();
  const page = await konteks.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("ditolak", "NotAllowedError"));
  });
  await page.goto("/__komponen");
  await page.getByRole("button", { name: TEKS.A2_FOTO }).first().click();
  await expect(page.getByText(TEKS.G_KAMERA_DITOLAK)).toBeVisible();
  await konteks.close();
});
