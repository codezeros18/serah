import { adalahGalatJaringan, panggilMentah } from "../api";
import { Antrean, type AksiKirim, type HasilKirimBatch, type KirimBatch } from "./antrean";
import { penyimpananIdb, penyimpananMemori } from "./penyimpanan";

/**
 * Kunci batch (header Idempotency-Key, wajib di /api/sinkron) diturunkan dari kunci aksinya:
 * mengirim ulang batch yang sama membawa kunci yang sama, sehingga server membalas respons identik.
 */
export async function kunciBatch(aksi: readonly Pick<AksiKirim, "idempotencyKey">[]): Promise<string> {
  const data = new TextEncoder().encode(aksi.map((a) => a.idempotencyKey).join("|"));
  const sidik = new Uint8Array(await crypto.subtle.digest("SHA-256", data)).slice(0, 16);
  sidik[6] = (sidik[6]! & 0x0f) | 0x40;
  sidik[8] = (sidik[8]! & 0x3f) | 0x80;
  const hex = Array.from(sidik, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const kirimKeServer: KirimBatch = async (aksi) => {
  const h = await panggilMentah("POST", "/api/sinkron", { body: { aksi }, idempotencyKey: await kunciBatch(aksi) });
  return { offline: adalahGalatJaringan(h), hasil: h as HasilKirimBatch };
};

let tunggal: Antrean | null = null;

/** Antrean tunggal per tab: IndexedDB bila ada, memori bila tidak (mis. mode privat tertentu). */
export function antreanBersama(): Antrean {
  tunggal ??= new Antrean(typeof indexedDB === "undefined" ? penyimpananMemori() : penyimpananIdb(), kirimKeServer);
  return tunggal;
}
