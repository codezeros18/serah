import { buatPrisma, type Peran, type Prisma, type PrismaClient } from "@serah/db";
import { muatEnv } from "./env";
import { GalatApi } from "./galat";

// Satu-satunya pintu akses DB aplikasi. Role runtime serah_app (NOBYPASSRLS): tanpa konteks yang diisi
// fungsi di bawah, kebijakan RLS mengembalikan kosong — itu disengaja.

export type Tx = Prisma.TransactionClient;

export type KonteksAkses = {
  penggunaId: string;
  orgIds: readonly string[];
  peran: Peran | null;
};

const simpan = globalThis as unknown as { __serahPrisma?: PrismaClient };

/** Klien Prisma tunggal per proses (role serah_app). */
export function prisma(): PrismaClient {
  simpan.__serahPrisma ??= buatPrisma(muatEnv().DATABASE_URL);
  return simpan.__serahPrisma;
}

const OPSI_TX = { maxWait: 5_000, timeout: 15_000 } as const;

/** Literal larik teks Postgres: {"a","b"}. */
export function larikPg(nilai: readonly string[]): string {
  return `{${nilai.map((v) => `"${v.replace(/["\\]/g, "\\$&")}"`).join(",")}}`;
}

// ── Kait setelah commit ───────────────────────────────────────────────────
// Efek di luar DB (push, email) hanya boleh terjadi bila transaksinya benar-benar commit. Kait didaftarkan di
// dalam transaksi denganX lalu dijalankan berurutan sesudah commit; galat kait tidak menggagalkan permintaan
// (dicatat tanpa PII). Transaksi yang batal tidak menjalankan kaitnya sama sekali.

type Kait = () => Promise<void>;
const kaitPerTx = new WeakMap<object, Kait[]>();

/** Daftarkan efek yang dijalankan setelah transaksi `tx` commit. */
export function setelahCommit(tx: Tx, kait: Kait): void {
  const daftar = kaitPerTx.get(tx);
  if (!daftar) throw new Error("setelahCommit hanya di dalam transaksi denganAkses/denganAdmin/denganSistem/denganAuth/denganPublik");
  daftar.push(kait);
}

async function transaksi<T>(isi: (tx: Tx) => Promise<T>): Promise<T> {
  const kait: Kait[] = [];
  const hasil = await prisma().$transaction(async (tx) => {
    kaitPerTx.set(tx, kait);
    return isi(tx);
  }, OPSI_TX);
  for (const k of kait) {
    try {
      await k();
    } catch (e) {
      process.stderr.write(`[serah] kait setelah commit gagal: ${e instanceof Error ? e.name : "unknown"}
`);
    }
  }
  return hasil;
}

type Bendera = { org_ids: string; pengguna_id: string; peran: string; admin: boolean; sistem: boolean; auth: boolean };

async function aturKonteks(tx: Tx, b: Bendera): Promise<void> {
  // set_config(…, true) = SET LOCAL: hanya berlaku di transaksi ini.
  await tx.$queryRaw`SELECT set_config('app.org_ids', ${b.org_ids}, true),
                            set_config('app.pengguna_id', ${b.pengguna_id}, true),
                            set_config('app.peran', ${b.peran}, true),
                            set_config('app.admin', ${String(b.admin)}, true),
                            set_config('app.sistem', ${String(b.sistem)}, true),
                            set_config('app.auth', ${String(b.auth)}, true)`;
}

/** Akses normal: hanya data organisasi dalam konteks sesi (RLS). */
export function denganAkses<T>(k: KonteksAkses, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return transaksi(async (tx) => {
    await aturKonteks(tx, { org_ids: larikPg(k.orgIds), pengguna_id: k.penggunaId, peran: k.peran ?? "", admin: false, sistem: false, auth: false });
    return fn(tx);
  });
}

export const ALASAN_ADMIN_MIN = 15;

export type CatatanAdmin = { aksi: string; objekJenis: string; objekId: string; organisasiId?: string | null };

/** Admin internal: lintas organisasi, wajib alasan ≥15 karakter, tercatat di audit_log dalam transaksi yang sama. */
export function denganAdmin<T>(k: KonteksAkses, alasan: string, fn: (tx: Tx) => Promise<T>, catatan?: CatatanAdmin): Promise<T> {
  if (k.peran !== "ADMIN") throw new GalatApi("PERAN_TIDAK_BOLEH");
  const alasanBersih = alasan.trim();
  if (alasanBersih.length < ALASAN_ADMIN_MIN) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "ADM_ALASAN_PENDEK" });
  return transaksi(async (tx) => {
    await aturKonteks(tx, { org_ids: larikPg(k.orgIds), pengguna_id: k.penggunaId, peran: "ADMIN", admin: true, sistem: false, auth: false });
    await tx.auditLog.create({
      data: {
        organisasiId: catatan?.organisasiId ?? null,
        peran: "ADMIN",
        aksi: catatan?.aksi ?? "AKSES_ADMIN",
        objekJenis: catatan?.objekJenis ?? "ADMIN",
        objekId: catatan?.objekId ?? "-",
        alasan: alasanBersih,
        data: {},
      },
    });
    return fn(tx);
  });
}

/** Pekerjaan sistem (cron, webhook terverifikasi): lintas organisasi. Hanya dipanggil dari rute cron/webhook. */
export function denganSistem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return transaksi(async (tx) => {
    await aturKonteks(tx, { org_ids: "{}", pengguna_id: "", peran: "", admin: false, sistem: true, auth: false });
    return fn(tx);
  });
}

/** Alur autentikasi sebelum ada sesi (masuk, baca sesi dari cookie, keluar): hanya tabel identitas. */
export function denganAuth<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return transaksi(async (tx) => {
    await aturKonteks(tx, { org_ids: "{}", pengguna_id: "", peran: "", admin: false, sistem: false, auth: true });
    return fn(tx);
  });
}

/** Rute publik tanpa sesi (mis. /api/health): tanpa konteks apa pun — RLS hanya membuka tabel global baca-semua. */
export function denganPublik<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return transaksi(async (tx) => {
    await aturKonteks(tx, { org_ids: "{}", pengguna_id: "", peran: "", admin: false, sistem: false, auth: false });
    return fn(tx);
  });
}
