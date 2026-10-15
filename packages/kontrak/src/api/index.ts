import { RUTE_ADMIN } from "./admin";
import { RUTE_AKUN } from "./akun";
import { RUTE_AUTH } from "./auth";
import { RUTE_BAYANGAN } from "./bayangan";
import { RUTE_CUACA } from "./cuaca";
import { RUTE_FOTO } from "./foto";
import { RUTE_KAWASAN } from "./kawasan";
import { RUTE_KENDARAAN } from "./kendaraan";
import { RUTE_KONTRAK } from "./kontrak";
import { RUTE_LANGGANAN } from "./langganan";
import { RUTE_LAPORAN } from "./laporan";
import { RUTE_NOTIFIKASI } from "./notifikasi";
import { RUTE_ORGANISASI } from "./organisasi";
import { RUTE_PERMINTAAN_KOREKSI } from "./permintaan-koreksi";
import type { DefinisiRute } from "./primitif";
import { RUTE_PUSH } from "./push";
import { RUTE_RANTAI } from "./rantai";
import { RUTE_SERAH } from "./serah";
import { RUTE_SINKRON } from "./sinkron";
import { RUTE_SISTEM } from "./sistem";
import { RUTE_TAGIHAN } from "./tagihan";
import { RUTE_TAGIHAN_ANGKUT } from "./tagihan-angkut";
import { RUTE_TIKET } from "./tiket";
import { RUTE_TPS } from "./tps";
import { RUTE_WADAH } from "./wadah";

export * from "./primitif";
export * from "./auth";
export * from "./akun";
export * from "./organisasi";
export * from "./kawasan";
export * from "./tps";
export * from "./kendaraan";
export * from "./kontrak";
export * from "./wadah";
export * from "./serah";
export * from "./foto";
export * from "./tiket";
export * from "./sinkron";
export * from "./rantai";
export * from "./cuaca";
export * from "./laporan";
export * from "./permintaan-koreksi";
export * from "./notifikasi";
export * from "./push";
export * from "./langganan";
export * from "./tagihan";
export * from "./tagihan-angkut";
export * from "./bayangan";
export * from "./admin";
export * from "./sistem";

/** Registri semua rute API (§K.2): metode, jalur, akses, skema masukan & keluaran. */
export const DAFTAR_RUTE: readonly DefinisiRute[] = [
  ...RUTE_AUTH,
  ...RUTE_AKUN,
  ...RUTE_ORGANISASI,
  ...RUTE_KAWASAN,
  ...RUTE_TPS,
  ...RUTE_KENDARAAN,
  ...RUTE_KONTRAK,
  ...RUTE_WADAH,
  ...RUTE_SERAH,
  ...RUTE_FOTO,
  ...RUTE_TIKET,
  ...RUTE_SINKRON,
  ...RUTE_RANTAI,
  ...RUTE_CUACA,
  ...RUTE_LAPORAN,
  ...RUTE_PERMINTAAN_KOREKSI,
  ...RUTE_NOTIFIKASI,
  ...RUTE_PUSH,
  ...RUTE_LANGGANAN,
  ...RUTE_TAGIHAN,
  ...RUTE_TAGIHAN_ANGKUT,
  ...RUTE_BAYANGAN,
  ...RUTE_ADMIN,
  ...RUTE_SISTEM,
];

export function cariRute(metode: DefinisiRute["metode"], jalur: string): DefinisiRute | undefined {
  return DAFTAR_RUTE.find((r) => r.metode === metode && r.jalur === jalur);
}
