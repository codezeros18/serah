import { uraiUrlDb } from "@serah/db/url";
import type { Peran } from "@serah/kontrak";
import pg from "pg";
import { muatEnv } from "./env";

// Live sync server (BLUEPRINT §F.4, S17-1). SATU koneksi pg LISTEN per proses (bukan per klien); fan-out ke klien
// SSE menurut organisasi aktif sesinya. Kanal `org_<id>` di-LISTEN saat pelanggan pertama datang dan di-UNLISTEN
// saat pelanggan terakhir pergi. Payload NOTIFY tanpa data pribadi: {jenis, kode, versi} (+ t & peran untuk notifikasi).

export const DETAK_MS = 25_000;
const JEDA_SAMBUNG_MS = 1_000;
const POLA_ORG = /^[a-z0-9]{1,64}$/;

type Pelanggan = { peran: Peran | null; kirim: (event: "serah" | "notifikasi", data: string) => void };
type PayloadNotify = { t?: string; jenis?: unknown; kode?: unknown; versi?: unknown; peran?: unknown };

class Pendengar {
  private klien: pg.Client | null = null;
  private menyambung: Promise<pg.Client> | null = null;
  private readonly kanal = new Map<string, Set<Pelanggan>>();

  /** Jumlah kanal yang sedang didengar (untuk test kebersihan). */
  jumlahKanal(): number {
    return this.kanal.size;
  }

  private async sambung(): Promise<pg.Client> {
    if (this.klien) return this.klien;
    this.menyambung ??= (async () => {
      const { connectionString } = uraiUrlDb(muatEnv().DATABASE_URL);
      const k = new pg.Client({ connectionString });
      k.on("notification", (m) => this.sebar(m.channel, m.payload));
      const putus = () => {
        if (this.klien !== k) return;
        this.klien = null;
        if (this.kanal.size > 0) setTimeout(() => void this.dengarUlang(), JEDA_SAMBUNG_MS).unref();
      };
      k.on("error", putus);
      k.on("end", putus);
      await k.connect();
      this.klien = k;
      return k;
    })().finally(() => {
      this.menyambung = null;
    });
    return this.menyambung;
  }

  /** Setelah koneksi putus: sambung lagi dan LISTEN ulang semua kanal yang masih punya pelanggan. */
  private async dengarUlang(): Promise<void> {
    try {
      const k = await this.sambung();
      for (const nama of this.kanal.keys()) await k.query(`LISTEN "${nama}"`);
    } catch {
      process.stderr.write("[serah] SSE: sambung ulang LISTEN gagal, dicoba lagi\n");
      if (this.kanal.size > 0) setTimeout(() => void this.dengarUlang(), JEDA_SAMBUNG_MS).unref();
    }
  }

  private sebar(nama: string, payload: string | undefined): void {
    const pelanggan = this.kanal.get(nama);
    if (!pelanggan || !payload) return;
    let p: PayloadNotify;
    try {
      p = JSON.parse(payload) as PayloadNotify;
    } catch {
      return;
    }
    if (typeof p.jenis !== "string" || typeof p.kode !== "string") return;
    const data = JSON.stringify({ jenis: p.jenis, kode: p.kode, versi: typeof p.versi === "number" ? p.versi : 0 });
    const notifikasi = p.t === "notifikasi";
    const peranTujuan = Array.isArray(p.peran) ? (p.peran as string[]) : [];
    for (const s of pelanggan) {
      // Notifikasi ditujukan ke peran dalam organisasi: peran lain di organisasi yang sama tidak menerimanya.
      if (notifikasi && (!s.peran || !peranTujuan.includes(s.peran))) continue;
      try {
        s.kirim(notifikasi ? "notifikasi" : "serah", data);
      } catch {
        /* aliran klien sudah tertutup; dibersihkan oleh pemiliknya */
      }
    }
  }

  /** Daftarkan pelanggan untuk organisasi-organisasinya; kembalikan fungsi berhenti (idempoten). */
  async daftar(orgIds: readonly string[], p: Pelanggan): Promise<() => Promise<void>> {
    const nama = [...new Set(orgIds)].filter((o) => POLA_ORG.test(o)).map((o) => `org_${o}`);
    for (const n of nama) {
      let s = this.kanal.get(n);
      if (!s) {
        s = new Set();
        this.kanal.set(n, s);
        await (await this.sambung()).query(`LISTEN "${n}"`);
      }
      s.add(p);
    }
    let berhenti = false;
    return async () => {
      if (berhenti) return;
      berhenti = true;
      for (const n of nama) {
        const s = this.kanal.get(n);
        if (!s) continue;
        s.delete(p);
        if (s.size === 0) {
          this.kanal.delete(n);
          try {
            await this.klien?.query(`UNLISTEN "${n}"`);
          } catch {
            /* koneksi sudah putus: tidak ada yang perlu dilepas */
          }
        }
      }
    };
  }
}

const simpan = globalThis as unknown as { __serahPendengar?: Pendengar };

export function pendengar(): Pendengar {
  simpan.__serahPendengar ??= new Pendengar();
  return simpan.__serahPendengar;
}

/**
 * Aliran SSE untuk satu sesi. Event: `serah` & `notifikasi` (data {jenis, kode, versi}), `ping` tiap `detakMs`.
 * Ditutup bersih (UNLISTEN bila perlu, interval dihentikan) saat `signal` dibatalkan atau klien memutus.
 */
export async function bukaAliran(m: { orgIds: readonly string[]; peran: Peran | null; signal: AbortSignal; detakMs?: number }): Promise<ReadableStream<Uint8Array>> {
  const enc = new TextEncoder();
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  let selesai: (() => Promise<void>) | null = null;
  let detak: ReturnType<typeof setInterval> | null = null;
  let tertutup = false;

  const tulis = (s: string) => {
    if (!tertutup) ctl.enqueue(enc.encode(s));
  };
  const tutup = async () => {
    if (tertutup) return;
    tertutup = true;
    if (detak) clearInterval(detak);
    await selesai?.();
    try {
      ctl.close();
    } catch {
      /* sudah ditutup */
    }
  };

  const aliran = new ReadableStream<Uint8Array>({
    start(c) {
      ctl = c;
    },
    async cancel() {
      tertutup = true;
      if (detak) clearInterval(detak);
      await selesai?.();
    },
  });

  if (m.signal.aborted) {
    await tutup();
    return aliran;
  }
  // LISTEN terpasang SEBELUM aliran dikembalikan (dan header respons dikirim): event yang terjadi tepat setelah
  // klien tersambung tidak boleh terlewat. Pelanggan tidak punya antrean sebelum ini, jadi tidak ada yang tertinggal.
  selesai = await pendengar().daftar(m.orgIds, { peran: m.peran, kirim: (event, data) => tulis(`event: ${event}\ndata: ${data}\n\n`) });
  if (m.signal.aborted) {
    await tutup();
    return aliran;
  }
  m.signal.addEventListener("abort", () => void tutup(), { once: true });
  tulis("retry: 5000\n\n");
  detak = setInterval(() => tulis("event: ping\ndata: {}\n\n"), m.detakMs ?? DETAK_MS);
  return aliran;
}
