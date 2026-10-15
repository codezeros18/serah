import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { formatGramKeKg } from "@serah/core/angka";
import { TEKS, isi } from "@serah/kontrak/teks";

// S09-4 — layar petugas terhadap API NYATA (tanpa mock). Syarat: DB ber-seed demo (`DEMO_MODE=true pnpm db:reset`),
// dev server dengan NEXT_PUBLIC_API_MOCK=false, DEMO_MODE=true, BASE_URL = alamat server uji.
// Dilewati bila mock aktif.

test.skip(process.env.NEXT_PUBLIC_API_MOCK === "true", "spesifikasi ini khusus API nyata");

test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

// Berat unik per proses uji: DB nyata dipakai bersama proyek hp & laptop, agar hitungan tidak bercampur.
const DASAR = 1000 + (Date.now() % 80_000);
const g = (n: number) => DASAR + n * 1_000_000 % 7_000 + n;
const kg = (n: number) => formatGramKeKg(g(n));

const QR_TPS = "demo-qr-TPS-PCS-01"; // token QR demo (seed demo, hanya DEMO_MODE)

type Amplop<T> = { ok: boolean; data?: T };

async function masukDemo(page: Page, baseURL: string) {
  const r = await page.request.post("/api/auth/demo", { data: { peran: "PETUGAS" }, headers: { Origin: baseURL } });
  expect(r.ok()).toBe(true);
}

async function wadahMenunggu(request: APIRequestContext, tpsId: string) {
  const r = await request.get(`/api/tps/${tpsId}/menunggu`);
  expect(r.ok()).toBe(true);
  return ((await r.json()) as Amplop<{ wadah: Array<{ id: string; aliran: string; beratG: number | null }> }>).data!.wadah;
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() {
        const q = (window as unknown as { __qr?: string }).__qr;
        return q ? [{ rawValue: q }] : [];
      }
    };
  });
  await masukDemo(page, baseURL ?? "http://localhost:3000");
});

async function pindai(page: Page) {
  await page.goto("/petugas");
  await page.getByRole("button", { name: TEKS.T1_PINDAI }).click();
  await page.evaluate((q) => ((window as unknown as { __qr: string }).__qr = q), QR_TPS);
  await expect(page.getByTestId("tps-terpilih")).toContainText("TPS-PCS-01");
}

async function tpsId(page: Page): Promise<string> {
  const r = await page.request.get(`/api/tps/qr/${QR_TPS}`);
  expect(r.ok()).toBe(true);
  return ((await r.json()) as Amplop<{ tps: { id: string } }>).data!.tps.id;
}

test("T1 nyata: QR → simpan → tercatat di server dengan gram bulat; lulus axe", async ({ page }) => {
  await pindai(page);
  await page.getByRole("button", { name: TEKS.ALIRAN_KUNING }).click();
  await page.getByLabel(TEKS.T1_BERAT_LABEL).fill(kg(1));
  await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
  await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN);
  await expect(page.getByTestId("catatan-terakhir").locator("li").first()).toContainText(isi("UMUM_KG", { nilai: kg(1) }));

  const wadah = await wadahMenunggu(page.request, await tpsId(page));
  expect(wadah.filter((w) => w.aliran === "KUNING" && w.beratG === g(1))).toHaveLength(1);

  const hasil = await new AxeBuilder({ page }).analyze();
  expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("offline → online nyata: satu catatan, tidak menggandakan", async ({ page, context }) => {
  await pindai(page);
  const id = await tpsId(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: TEKS.ALIRAN_ABU }).click();
  await page.getByLabel(TEKS.T1_BERAT_LABEL).fill(kg(2));
  await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
  await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN_LOKAL);
  await context.setOffline(false);
  await expect(page.locator('[data-pita="terkirim"]')).toContainText(TEKS.G_ANTREAN_TERKIRIM);
  // Muat ulang dan sinkron ulang: kunci idempotensi sama → tetap satu catatan.
  await page.reload();
  await page.waitForTimeout(1500);
  const wadah = await wadahMenunggu(page.request, id);
  expect(wadah.filter((w) => w.aliran === "ABU" && w.beratG === g(2))).toHaveLength(1);
});

test("T2 nyata: buat serah dari wadah menunggu → kode SRH + QR; status DRAF di server", async ({ page }) => {
  await pindai(page);
  await page.getByRole("button", { name: TEKS.ALIRAN_HIJAU }).click();
  await page.getByLabel(TEKS.T1_BERAT_LABEL).fill(kg(3));
  await page.getByRole("button", { name: TEKS.T1_SIMPAN }).click();
  await expect(page.getByTestId("hasil-simpan")).toHaveText(TEKS.T1_TERSIMPAN);

  await page.goto("/petugas/serah");
  const baris = page.getByTestId("wadah-menunggu").locator("li", { hasText: isi("UMUM_KG", { nilai: kg(3) }) }).first();
  await baris.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: TEKS.T2_BUAT }).click();
  await expect(page.getByTestId("kode-serah")).toHaveText(/^SRH-\d{8}-\d{4}$/);
  const kode = (await page.getByTestId("kode-serah").textContent()) ?? "";
  await expect(page.getByTestId("serah-dibuat").getByRole("img", { name: TEKS.T2_QR_PETUNJUK })).toBeVisible();

  const r = await page.request.get(`/api/serah/${kode}`);
  expect(r.ok()).toBe(true);
  expect(((await r.json()) as Amplop<{ status: string }>).data!.status).toBe("DRAF");
});
