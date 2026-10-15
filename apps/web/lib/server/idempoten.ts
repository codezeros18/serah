import type { Prisma } from "@serah/db";
import { HEADER_IDEMPOTENCY_KEY, HEADER_IDEMPOTENT_REPLAY, IdempotencyKey } from "@serah/kontrak";
import { denganAkses, type Tx } from "./db";
import { GalatApi, sukses } from "./galat";
import { konteksAkses, type Sesi } from "./sesi";

// Idempotensi aksi perangkat (CLAUDE.md §2.2): kiriman ganda → satu efek, respons sama.
// Respons sukses disimpan di `respons_idempoten` DALAM transaksi yang sama dengan efeknya. Kiriman ulang →
// 200 + header Idempotent-Replay dengan isi yang sama persis. Aksi yang gagal tidak disimpan (dinilai ulang).

export type HasilIdempoten<T> = { isi: T; replay: boolean };

/** Ambil & validasi header Idempotency-Key (UUID dibuat di perangkat). */
export function kunciIdempoten(request: Request): string {
  const h = request.headers.get(HEADER_IDEMPOTENCY_KEY);
  const hasil = IdempotencyKey.safeParse(h ?? "");
  if (!hasil.success) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: [HEADER_IDEMPOTENCY_KEY], kode: "wajib_uuid" }] });
  return hasil.data;
}

/** true bila galat = pelanggaran keunikan (Prisma P2002 atau Postgres 23505). */
export function pelanggaranUnik(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const kode = "code" in e ? String((e as { code: unknown }).code) : "";
  if (kode === "P2002" || kode === "23505") return true;
  const sebab = "cause" in e ? (e as { cause: unknown }).cause : undefined;
  return sebab !== undefined && sebab !== e && pelanggaranUnik(sebab);
}

async function bacaTersimpan(tx: Tx, kunci: string, rute: string): Promise<unknown | undefined> {
  const r = await tx.responsIdempoten.findUnique({ where: { kunci } });
  if (!r) return undefined;
  if (r.rute !== rute) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: [HEADER_IDEMPOTENCY_KEY], kode: "dipakai_aksi_lain" }] });
  return r.isi;
}

/**
 * Jalankan `kerja` sekali per kunci. Dipakai rute tunggal dan /api/sinkron (kunci per aksi, rute sama dengan rute
 * aslinya — sehingga aksi yang terkirim online lalu terulang dari antrean tetap satu efek).
 */
export async function sekaliSaja<T>(
  sesi: Sesi,
  kunci: string,
  rute: string,
  kerja: (tx: Tx) => Promise<T>,
): Promise<HasilIdempoten<T>> {
  const organisasiId = sesi.organisasiAktifId;
  if (!organisasiId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  try {
    return await denganAkses(konteksAkses(sesi), async (tx) => {
      const lama = await bacaTersimpan(tx, kunci, rute);
      if (lama !== undefined) return { isi: lama as T, replay: true };
      const isi = await kerja(tx);
      await tx.responsIdempoten.create({ data: { kunci, organisasiId, rute, statusHttp: 200, isi: isi as Prisma.InputJsonValue } });
      return { isi, replay: false };
    });
  } catch (e) {
    // Dua kiriman sama tiba bersamaan: yang kalah melanggar keunikan kunci → baca respons pemenang.
    if (!pelanggaranUnik(e)) throw e;
    const lama = await denganAkses(konteksAkses(sesi), (tx) => bacaTersimpan(tx, kunci, rute));
    if (lama === undefined) throw new GalatApi("KONFLIK_VERSI");
    return { isi: lama as T, replay: true };
  }
}

/** Respons HTTP sukses; replay diberi header Idempotent-Replay. */
export function responsIdempoten<T>(h: HasilIdempoten<T>): Response {
  return sukses(h.isi, h.replay ? { headers: { [HEADER_IDEMPOTENT_REPLAY]: "true" } } : {});
}

/** Pintu rute: header wajib → sekali saja → respons. */
export async function ruteIdempoten<T>(request: Request, sesi: Sesi, rute: string, kerja: (tx: Tx, kunci: string) => Promise<T>): Promise<Response> {
  const kunci = kunciIdempoten(request);
  return responsIdempoten(await sekaliSaja(sesi, kunci, rute, (tx) => kerja(tx, kunci)));
}
