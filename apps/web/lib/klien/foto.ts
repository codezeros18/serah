import type { Galat } from "@serah/kontrak/galat";
import { TEKS } from "@serah/kontrak/teks";
import { MOCK_AKTIF, panggilMentah, teksGalat } from "./api";

export type HasilUnggah =
  | { ok: true; fotoId: string; dhash: string }
  | { ok: false; galat: Galat; pesan: string };

/** Unggah satu foto (multipart). Server me-re-encode, membuang EXIF, dan menghitung dHash (R-04). */
export async function unggahFoto(
  blob: Blob,
  jenis: "MUATAN" | "TIKET" | "BUKTI_TRANSFER" | "DOKUMEN_IZIN",
  serahKode?: string,
): Promise<HasilUnggah> {
  if (MOCK_AKTIF) {
    const h = await panggilMentah("POST", "/api/foto", { body: { jenis, serahKode, ukuran: blob.size } });
    return h.ok ? { ok: true, ...(h.data as { fotoId: string; dhash: string }) } : { ok: false, galat: h.galat, pesan: h.pesan };
  }
  const form = new FormData();
  form.set("jenis", jenis);
  if (serahKode) form.set("serahKode", serahKode);
  form.set("berkas", blob, "foto.webp");
  try {
    const res = await fetch("/api/foto", { method: "POST", body: form, credentials: "same-origin" });
    const json = (await res.json()) as { ok: boolean; data?: { fotoId: string; dhash: string }; galat?: Galat };
    if (json.ok && json.data) return { ok: true, ...json.data };
    const galat: Galat = json.galat ?? { kode: "GALAT_SERVER", pesan: "tidak dikenal" };
    return { ok: false, galat, pesan: teksGalat(galat) };
  } catch {
    return { ok: false, galat: { kode: "GALAT_SERVER", pesan: "jaringan" }, pesan: TEKS.G_OFFLINE };
  }
}
