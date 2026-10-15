import type { Galat } from "@serah/kontrak/galat";
import { MOCK_AKTIF, isiJalur, kueriKeString, teksGalat } from "./api";

export type HasilUnduh = { ok: true; nama: string } | { ok: false; pesan: string };

function namaDariHeader(h: string | null, cadangan: string): string {
  const m = h ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(h) : null;
  return m?.[1] ? decodeURIComponent(m[1]) : cadangan;
}

function simpanBlob(blob: Blob, nama: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Unduh berkas dari rute GET (CSV/PDF). Berkas disimpan apa adanya dari server — klien tidak menyusun isi laporan.
 * Mode mock tidak punya berkas nyata; unduhan berisi kosong agar alur tombol dapat diuji.
 */
export async function unduhBerkas(
  jalur: string,
  opsi: { params?: Record<string, string>; kueri?: Record<string, unknown>; namaCadangan: string },
): Promise<HasilUnduh> {
  if (MOCK_AKTIF) {
    simpanBlob(new Blob([""], { type: "application/octet-stream" }), opsi.namaCadangan);
    return { ok: true, nama: opsi.namaCadangan };
  }
  const url = `${isiJalur(jalur, opsi.params)}${kueriKeString(opsi.kueri)}`;
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin" });
  } catch {
    const { TEKS } = await import("@serah/kontrak/teks");
    return { ok: false, pesan: TEKS.G_OFFLINE };
  }
  if (!res.ok) {
    try {
      const j = (await res.json()) as { galat?: Galat };
      if (j.galat) return { ok: false, pesan: teksGalat(j.galat) };
    } catch {
      // Respons bukan JSON: jatuh ke galat umum di bawah.
    }
    const { TEKS } = await import("@serah/kontrak/teks");
    return { ok: false, pesan: TEKS.G_SERVER };
  }
  const nama = namaDariHeader(res.headers.get("Content-Disposition"), opsi.namaCadangan);
  simpanBlob(await res.blob(), nama);
  return { ok: true, nama };
}
