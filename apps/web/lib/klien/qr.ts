// QR (S04-6): tampil (`qrcode`) & pindai (`BarcodeDetector` → cadangan `jsqr`).
import QRCode from "qrcode";
import jsQR from "jsqr";

/** Data URL SVG QR untuk <img>. Koreksi galat M agar tetap terbaca bila dicetak. */
export async function qrKeDataUrl(isi: string, lebarPx = 320): Promise<string> {
  const svg = await QRCode.toString(isi, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: lebarPx });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type DetektorBawaan = {
  detect(sumber: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};

function bangunDetektorBawaan(): DetektorBawaan | null {
  const Kelas = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => DetektorBawaan }).BarcodeDetector;
  if (!Kelas) return null;
  try {
    return new Kelas({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

/** Pemindai satu bingkai: BarcodeDetector bila ada, jika tidak jsqr pada kanvas. */
export function buatPemindai(): (video: HTMLVideoElement) => Promise<string | null> {
  const bawaan = bangunDetektorBawaan();
  let kanvas: HTMLCanvasElement | null = null;
  return async (video) => {
    if (video.videoWidth === 0) return null;
    if (bawaan) {
      try {
        const hasil = await bawaan.detect(video);
        return hasil[0]?.rawValue ?? null;
      } catch {
        /* jatuh ke jsqr */
      }
    }
    kanvas ??= document.createElement("canvas");
    // Perkecil agar murah di HP Android entry-level.
    const skala = Math.min(1, 640 / video.videoWidth);
    kanvas.width = Math.round(video.videoWidth * skala);
    kanvas.height = Math.round(video.videoHeight * skala);
    const ctx = kanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, kanvas.width, kanvas.height);
    const gambar = ctx.getImageData(0, 0, kanvas.width, kanvas.height);
    return jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}
