import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AksiAntrean, PenyimpananAntrean } from "./tipe";

const NAMA_DB = "serah-antrean";
const VERSI_DB = 1;

interface Skema extends DBSchema {
  aksi: { key: string; value: AksiAntrean; indexes: { urut: number } };
}

/** Penyimpanan tahan restart: IndexedDB `serah-antrean`. */
export function penyimpananIdb(): PenyimpananAntrean {
  let db: Promise<IDBPDatabase<Skema>> | null = null;
  const buka = () =>
    (db ??= openDB<Skema>(NAMA_DB, VERSI_DB, {
      upgrade(d) {
        const s = d.createObjectStore("aksi", { keyPath: "idempotencyKey" });
        s.createIndex("urut", "urut");
      },
    }));
  return {
    async simpan(aksi) {
      await (await buka()).put("aksi", aksi);
    },
    async semua() {
      return (await buka()).getAllFromIndex("aksi", "urut");
    },
    async hapus(kunci) {
      await (await buka()).delete("aksi", kunci);
    },
  };
}

/** Penyimpanan dalam memori untuk test dan cadangan bila IndexedDB tidak tersedia. */
export function penyimpananMemori(): PenyimpananAntrean {
  const peta = new Map<string, AksiAntrean>();
  return {
    async simpan(aksi) {
      peta.set(aksi.idempotencyKey, structuredClone(aksi));
    },
    async semua() {
      return [...peta.values()].map((a) => structuredClone(a)).sort((a, b) => a.urut - b.urut);
    },
    async hapus(kunci) {
      peta.delete(kunci);
    },
  };
}
