// Kamera (S04-5): hanya getUserMedia → kanvas → blob. TIDAK ada <input type="file"> / galeri
// (bukti harus foto saat itu juga). Foto yang dihasilkan tidak membawa EXIF; server tetap re-encode.
import { TEKS } from "@serah/kontrak/teks";

export type GalatKamera = "G_KAMERA_DITOLAK" | "G_KAMERA_TIDAK_ADA";

export function teksGalatKamera(g: GalatKamera): string {
  return g === "G_KAMERA_DITOLAK" ? TEKS.G_KAMERA_DITOLAK : TEKS.G_KAMERA_TIDAK_ADA;
}

export type HasilBuka = { ok: true; stream: MediaStream } | { ok: false; galat: GalatKamera };

/** Petakan galat peramban ke dua kode galat terdaftar. */
export function petakanGalatKamera(e: unknown): GalatKamera {
  const nama = e instanceof DOMException ? e.name : "";
  if (nama === "NotAllowedError" || nama === "SecurityError" || nama === "PermissionDeniedError") return "G_KAMERA_DITOLAK";
  return "G_KAMERA_TIDAK_ADA";
}

/** Buka kamera belakang bila ada. Tidak pernah meminta lokasi. */
export async function bukaKamera(): Promise<HasilBuka> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, galat: "G_KAMERA_TIDAK_ADA" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1200 } },
      audio: false,
    });
    return { ok: true, stream };
  } catch (e) {
    return { ok: false, galat: petakanGalatKamera(e) };
  }
}

export function tutupKamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Sisi terpanjang foto yang diunggah (server membatasi 1600 px juga). */
export const SISI_MAKS_PX = 1600;

/** Ambil satu bingkai dari <video> sebagai blob webp (cadangan jpeg bila webp tak didukung). */
export function ambilFoto(video: HTMLVideoElement, kualitas = 0.82): Promise<Blob | null> {
  const lebar = video.videoWidth;
  const tinggi = video.videoHeight;
  if (lebar === 0 || tinggi === 0) return Promise.resolve(null);
  const skala = Math.min(1, SISI_MAKS_PX / Math.max(lebar, tinggi));
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.round(lebar * skala);
  kanvas.height = Math.round(tinggi * skala);
  const ctx = kanvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, kanvas.width, kanvas.height);
  return new Promise((selesai) => {
    kanvas.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return selesai(webp);
        kanvas.toBlob((jpeg) => selesai(jpeg), "image/jpeg", kualitas);
      },
      "image/webp",
      kualitas,
    );
  });
}
