import type { z } from "zod";
import type { NotifikasiDaftarKeluaran } from "@serah/kontrak";
import { isi } from "@serah/kontrak/teks";

export type ItemNotifikasi = z.infer<typeof NotifikasiDaftarKeluaran>["notifikasi"][number];

export function susunPesanNotifikasi(n: ItemNotifikasi): string {
  switch (n.jenis) {
    case "SERAH_MENUNGGU_SETUJU":
      return isi("NTF_SERAH_MENUNGGU_SETUJU", { kode: n.objekKode });
    case "SERAH_DIANGKUT":
      return isi("NTF_SERAH_DIANGKUT", {
        kode: n.objekKode,
        penerima: String(n.data.penerima ?? ""),
      });
    case "SERAH_DITUTUP":
      return isi("NTF_SERAH_DITUTUP", {
        kode: n.objekKode,
        status: String(n.data.status ?? ""),
      });
    case "SERAH_MENGGANTUNG":
      return isi("NTF_SERAH_MENGGANTUNG", {
        kode: n.objekKode,
        jam: Number(n.data.jam ?? 0),
      });
    case "PRIORITAS_ANGKUT":
      return isi("NTF_PRIORITAS_ANGKUT", {
        kode_tps: String(n.data.kode_tps ?? n.objekKode),
      });
    case "WADAH_LEWAT_BATAS":
      return isi("NTF_WADAH_LEWAT_BATAS", {
        kode_tps: String(n.data.kode_tps ?? n.objekKode),
      });
    case "CATATAN_HARIAN_BELUM":
      return isi("NTF_CATATAN_HARIAN_BELUM", {
        kode_tps: String(n.data.kode_tps ?? n.objekKode),
      });
    case "KONTRAK_PERLU_KONFIRMASI":
      return isi("NTF_KONTRAK_PERLU_KONFIRMASI", {
        nama_kawasan: String(n.data.nama_kawasan ?? ""),
      });
    case "PERMINTAAN_KOREKSI":
      return isi("NTF_PERMINTAAN_KOREKSI", { kode: n.objekKode });
    case "IZIN_DIPUTUS":
      return isi("NTF_IZIN_DIPUTUS", { status: String(n.data.status ?? "") });
    case "TAGIHAN_TERBIT":
      return isi("NTF_TAGIHAN_TERBIT", {
        nomor: n.objekKode,
        jumlah: Number(n.data.jumlah ?? 0),
      });
    case "UJI_COBA_BERAKHIR":
      return isi("NTF_UJI_COBA_BERAKHIR", {
        tanggal: String(n.data.tanggal ?? ""),
      });
    default:
      return n.objekKode;
  }
}

export function tautanObjek(n: ItemNotifikasi): string | null {
  if (n.objekKode.startsWith("SRH-")) {
    return `/serah/${n.objekKode}`;
  }
  if (n.jenis === "KONTRAK_PERLU_KONFIRMASI") {
    return "/kawasan/kontrak";
  }
  if (
    n.jenis === "PRIORITAS_ANGKUT" ||
    n.jenis === "WADAH_LEWAT_BATAS" ||
    n.jenis === "CATATAN_HARIAN_BELUM"
  ) {
    return "/kawasan/tps";
  }
  return null;
}

