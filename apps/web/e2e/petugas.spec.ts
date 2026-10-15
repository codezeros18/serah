import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS, isi } from "@serah/kontrak/teks";

// S09 — layar petugas T1/T2 + antrean offline. Dijalankan dengan NEXT_PUBLIC_API_MOCK=true.
// Pemindai QR memakai BarcodeDetector; di sini diganti tiruan yang "membaca" window.__qr agar alur
// QR → simpan dapat diuji tanpa kamera nyata (uji HP Android nyata dicatat terpisah di PROGRESS).

test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

const QR_TPS_1 = "mocktokentps-pcs-01v1xxxxxxxx";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() {
        const q = (window as unknown as { __qr?: string }).__qr;
        return q ? [{ rawValue: q }] : [];
      }
    };
  });
});

async function axeBersih(page: Page) {
  const hasil = await new AxeBuilder({ page }).analyze();
  const parah = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(parah.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function pindaiTps(page: Page) {
  await page.goto("/petugas");
  await page.getByRole("button", { name: TEKS.T1_PINDAI }).click();
  await page.evaluate((q) => ((window as unknown as { __qr: string }).__qr = q), QR_TPS_1);
  await expect(page.getByTestId("tps-terpilih")).toHaveText(isi("T1_TPS_TERPILIH", { kode_tps: "TPS-PCS-01", nama_kawasan: await namaKawasan(page) }));
}

async function namaKawasan(page: Page): Promise<string> {
  const teks = (await page.getByTestId("tps-terpilih").textContent()) ?? "";
  return teks.split(" · ")[1] ?? "";
}

async function simpan(page: Page, warna: string, berat: string) {
  await page.getByRole("button", { name: warna }).click();
  await page.getByLabel(TEKS.T1_BERAT_LABEL).fill(berat);
  await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
}

test.describe("T1 /petugas", () => {
  test("QR → warna → berat berkoma → simpan; ≤20 detik dari QR terbaca; lulus axe", async ({ page }) => {
    await page.goto("/petugas");
    await axeBersih(page);
    await page.getByRole("button", { name: TEKS.T1_PINDAI }).click();
    await page.evaluate((q) => ((window as unknown as { __qr: string }).__qr = q), QR_TPS_1);
    await expect(page.getByTestId("tps-terpilih")).toContainText("TPS-PCS-01");

    await simpan(page, TEKS.ALIRAN_KUNING, "42,5");
    await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN);
    await expect(page.getByTestId("catatan-terakhir").locator("li").first()).toContainText(isi("UMUM_KG", { nilai: "42,5" }));
    await expect(page.getByTestId("catatan-terakhir").locator("li").first()).toContainText(TEKS.ALIRAN_KUNING_PENDEK);

    const ms = await page.evaluate(() => performance.getEntriesByName("t1-qr-ke-simpan")[0]?.duration ?? -1);
    test.info().annotations.push({ type: "t1-qr-ke-simpan-ms", description: String(Math.round(ms)) });
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThan(20_000);
    await axeBersih(page);
  });

  test("validasi: kosong → T1_ISI_SALAH_SATU; berat tak sah → G_BERAT_TIDAK_SAH; tanpa warna → T1_PILIH_ALIRAN", async ({ page }) => {
    await pindaiTps(page);
    await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
    await expect(page.getByText(TEKS.T1_PILIH_ALIRAN, { exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: TEKS.ALIRAN_HIJAU }).click();
    await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
    await expect(page.getByText(TEKS.T1_ISI_SALAH_SATU)).toBeVisible();
    await page.getByLabel(TEKS.T1_BERAT_LABEL).fill("abc");
    await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
    await expect(page.getByText(TEKS.G_BERAT_TIDAK_SAH)).toBeVisible();
  });

  test("QR tidak dikenal → G_QR_TIDAK_DIKENAL", async ({ page }) => {
    await page.goto("/petugas");
    await page.getByRole("button", { name: TEKS.T1_PINDAI }).click();
    await page.evaluate(() => ((window as unknown as { __qr: string }).__qr = "pendek"));
    await expect(page.getByText(TEKS.G_QR_TIDAK_DIKENAL)).toBeVisible();
  });

  test("offline → tersimpan di perangkat → online → terkirim sekali, tidak menggandakan", async ({ page, context }) => {
    await pindaiTps(page);
    const daftar = page.getByTestId("catatan-terakhir").locator("li");
    const awal = await daftar.count();

    await context.setOffline(true);
    await expect(page.locator('[data-pita="offline"]')).toContainText(TEKS.G_OFFLINE);
    await simpan(page, TEKS.ALIRAN_ABU, "10");
    await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN_LOKAL);
    await simpan(page, TEKS.ALIRAN_HIJAU, "3,2");
    await expect(page.locator('[data-pita="antrean"]')).toContainText(isi("G_ANTREAN", { jumlah: 2 }));
    await expect(page.getByTestId("catatan-terakhir").getByText(TEKS.T1_TERSIMPAN_LOKAL)).toHaveCount(2);

    await context.setOffline(false);
    await expect(page.locator('[data-pita="terkirim"]')).toContainText(TEKS.G_ANTREAN_TERKIRIM);
    await expect(page.locator('[data-pita="antrean"]')).toHaveCount(0);
    await expect(page.getByTestId("catatan-terakhir").getByText(TEKS.T1_TERSIMPAN_LOKAL)).toHaveCount(0);
    // Dua catatan baru, bukan empat: kirim ulang tidak menggandakan (daftar dibatasi lima baris).
    await expect(daftar).toHaveCount(Math.min(5, awal + 2));
    await page.reload();
    await expect(page.getByTestId("tps-terpilih")).toBeVisible();
  });
});

test.describe("T2 /petugas/serah", () => {
  test("pilih wadah → buat serah → kode SRH + QR serah; tanpa pilihan ditolak; lulus axe", async ({ page }) => {
    await pindaiTps(page);
    await page.goto("/petugas/serah");
    await expect(page.getByTestId("wadah-menunggu")).toBeVisible();
    await axeBersih(page);

    await page.getByRole("button", { name: TEKS.T2_BUAT }).click();
    await expect(page.getByText(TEKS.T2_TANPA_PILIHAN)).toBeVisible();

    await page.getByTestId("wadah-menunggu").locator('input[type="checkbox"]').first().check();
    await page.getByRole("button", { name: TEKS.T2_BUAT }).click();
    const dibuat = page.getByTestId("serah-dibuat");
    await expect(dibuat).toBeVisible();
    await expect(page.getByTestId("kode-serah")).toHaveText(/^SRH-\d{8}-\d{4}$/);
    await expect(dibuat.getByRole("img", { name: TEKS.T2_QR_PETUNJUK })).toBeVisible();
    await expect(dibuat).toContainText(TEKS.T2_QR_PETUNJUK);
    await axeBersih(page);
  });
});
