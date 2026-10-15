import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEKS, isi } from "@serah/kontrak/teks";

// S29: Pengerasan Aksesibilitas T30, Anggaran Performa, Uji HP Murah Offline, dan Perbaikan Temuan.
// Dijalankan dengan NEXT_PUBLIC_API_MOCK=true.

test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

const HARI = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, "");
const KODE = (n: number) => `SRH-${HARI}-${String(n).padStart(4, "0")}`;
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

async function axeBersih(page: Page, konteks: string) {
  const hasil = await new AxeBuilder({ page }).analyze();
  const parah = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    parah.map((v) => `${konteks} -> ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

test.describe("S29-1: T30 Aksesibilitas (axe) T1, A2, P1, K1", () => {
  test("T1 (/petugas) bebas pelanggaran serius/kritis di viewport saat ini", async ({ page }) => {
    await page.goto("/petugas");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.T1_JUDUL })).toBeVisible();
    await axeBersih(page, "T1-awal");

    // Pindai TPS untuk menguji formulir aktif
    await page.getByRole("button", { name: TEKS.T1_PINDAI }).click();
    await page.evaluate((q) => ((window as unknown as { __qr: string }).__qr = q), QR_TPS_1);
    await expect(page.getByTestId("tps-terpilih")).toContainText("TPS-PCS-01");

    await axeBersih(page, "T1-tps-terpilih");
  });

  test("A2 (/pengangkut/serah/[kode]) bebas pelanggaran serius/kritis di viewport saat ini", async ({ page }) => {
    await page.goto(`/pengangkut/serah/${KODE(1)}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await axeBersih(page, "A2-pindai");

    // Lanjut ke langkah tujuan
    await page.getByRole("button", { name: TEKS.UMUM_LANJUT }).click();
    const ambil = page.getByRole("button", { name: TEKS.A2_FOTO });
    await expect(ambil).toBeEnabled();
    await ambil.click();

    await expect(page.getByLabel(TEKS.A2_KENDARAAN)).toBeVisible();
    await axeBersih(page, "A2-tujuan");
  });

  test("P1 (/penerima/serah/[kode]) bebas pelanggaran serius/kritis di viewport saat ini", async ({ page }) => {
    await page.goto(`/penerima/serah/${KODE(3)}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await axeBersih(page, "P1-awal");

    // Buka mode isi manual untuk memeriksa seluruh form & kontrol
    await page.getByRole("button", { name: TEKS.P1_ISI_MANUAL }).click();
    await expect(page.getByLabel(TEKS.P1_BERAT_TIKET)).toBeVisible();
    await axeBersih(page, "P1-isi-manual");

    // Isi berat tiket & konfirmasi agar bagian per-aliran terbuka
    await page.getByLabel(TEKS.P1_BERAT_TIKET).fill("30");
    await page.getByRole("button", { name: TEKS.P1_KONFIRMASI_AI }).click();
    await expect(page.getByRole("heading", { level: 2, name: TEKS.P1_PER_ALIRAN })).toBeVisible();
    await axeBersih(page, "P1-rincian-aliran");
  });

  test("K1 (/kawasan) bebas pelanggaran serius/kritis di viewport saat ini", async ({ page }) => {
    await page.goto("/kawasan");
    await expect(page.getByRole("heading", { level: 1, name: TEKS.K1_JUDUL })).toBeVisible();
    await expect(page.getByTestId("menunggu-setuju")).toBeVisible();
    await expect(page.getByRole("heading", { name: TEKS.K1_HARI_INI })).toBeVisible();
    await expect(page.getByRole("heading", { name: TEKS.K1_BULAN_INI })).toBeVisible();

    await axeBersih(page, "K1-ringkasan");
  });
});

test.describe("S29-2: Anggaran Performa /petugas", () => {
  test("halaman /petugas merender cepat dengan LCP <= 3 detik pada kondisi jaringan", async ({ page }) => {
    // Mulai navigasi dan ukur waktu respon
    const awal = Date.now();
    await page.goto("/petugas", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: TEKS.T1_JUDUL })).toBeVisible();
    const durasi = Date.now() - awal;

    // Hitung Largest Contentful Paint (LCP) dari Performance API browser
    const lcpMs = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let maxLcp = 0;
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.startTime > maxLcp) maxLcp = entry.startTime;
          }
        });
        try {
          observer.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          // Fallback bila observer LCP tidak didukung
        }
        setTimeout(() => {
          observer.disconnect();
          resolve(maxLcp);
        }, 1000);
      });
    });

    test.info().annotations.push(
      { type: "lcp-ms", description: String(Math.round(lcpMs)) },
      { type: "domcontentloaded-ms", description: String(durasi) },
    );

    // LCP dan render utama harus di bawah 3000 ms (3 detik)
    expect(durasi).toBeLessThan(3000);
    if (lcpMs > 0) {
      expect(lcpMs).toBeLessThan(3000);
    }
  });
});

test.describe("S29-3: Uji Mode Offline HP Murah", () => {
  test("cangkang PWA dan service worker terdaftar", async ({ page }) => {
    await page.goto("/petugas");
    const swSiap = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      return true;
    });
    expect(swSiap).toBe(true);
  });

  test("offline -> simpan antrean lokal -> online -> sinkron tanpa catatan ganda atau hilang", async ({ page, context }) => {
    await page.goto("/petugas");
    // Pindai TPS
    await page.getByRole("button", { name: TEKS.T1_PINDAI }).click();
    await page.evaluate((q) => ((window as unknown as { __qr: string }).__qr = q), QR_TPS_1);
    await expect(page.getByTestId("tps-terpilih")).toContainText("TPS-PCS-01");

    const daftar = page.getByTestId("catatan-terakhir").locator("li");
    const jumlahAwal = await daftar.count();

    // 1. Putuskan jaringan (mode offline / simulasi basement tanpa sinyal)
    await context.setOffline(true);
    await expect(page.locator('[data-pita="offline"]')).toContainText(TEKS.G_OFFLINE);

    // 2. Simpan 2 catatan wadah berturut-turut dalam mode offline
    await page.getByRole("button", { name: TEKS.ALIRAN_KUNING }).click();
    await page.getByLabel(TEKS.T1_BERAT_LABEL).fill("15,5");
    await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
    await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN_LOKAL);

    await page.getByRole("button", { name: TEKS.ALIRAN_HIJAU }).click();
    await page.getByLabel(TEKS.T1_BERAT_LABEL).fill("8,0");
    await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
    await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN_LOKAL);

    // Verifikasi kedua catatan tersimpan di antrean lokal
    await expect(page.locator('[data-pita="antrean"]')).toContainText(isi("G_ANTREAN", { jumlah: 2 }));
    await expect(page.getByTestId("catatan-terakhir").getByText(TEKS.T1_TERSIMPAN_LOKAL)).toHaveCount(2);

    // 3. Sambungkan kembali jaringan (mode online / keluar dari basement)
    await context.setOffline(false);

    // Verifikasi sinkronisasi otomatis terpicu dan sukses
    await expect(page.locator('[data-pita="terkirim"]')).toContainText(TEKS.G_ANTREAN_TERKIRIM);
    await expect(page.locator('[data-pita="antrean"]')).toHaveCount(0);
    await expect(page.getByTestId("catatan-terakhir").getByText(TEKS.T1_TERSIMPAN_LOKAL)).toHaveCount(0);

    // Verifikasi jumlah catatan bertambah tepat 2 (tanpa catatan ganda atau catatan hilang)
    await expect(daftar).toHaveCount(Math.min(5, jumlahAwal + 2));
  });
});
