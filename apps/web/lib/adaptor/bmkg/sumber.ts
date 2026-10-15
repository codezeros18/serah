import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseCap, parseDaftarNowcast } from "./cap";
import { normalisasiPrakiraan } from "./prakiraan";
import { GalatBmkg, POLA_ADM4, SUMBER_BMKG, type ItemDaftarNowcast, type NowcastMentah, type PrakiraanMentah, type SumberCuaca } from "./tipe";

// Implementasi SumberCuaca: `live` (fetch, timeout 10 dtk, antrean ≤50/menit) dan `snapshot` (berkas data/bmkg).
// Gagal apa pun → GalatBmkg; tidak pernah mengembalikan data karangan (BLUEPRINT §O.1, §J).

export const TIMEOUT_MS = 10_000;
export const BATAS_PER_MENIT = 50;
const JENDELA_MS = 60_000;

const cocokProvinsi = (item: ItemDaftarNowcast, daftar: readonly string[]) =>
  item.provinsi !== null && daftar.some((p) => p.trim().toLowerCase() === item.provinsi!.trim().toLowerCase());

async function semuaDetail(
  sumber: Pick<SumberCuaca, "daftarNowcast" | "detailNowcast">,
  provinsi: readonly string[],
): Promise<NowcastMentah[]> {
  const item = (await sumber.daftarNowcast()).filter((i) => cocokProvinsi(i, provinsi));
  const hasil: NowcastMentah[] = [];
  for (const i of item) hasil.push(await sumber.detailNowcast(i.url));
  return hasil;
}

// ── Antrean batas laju ──────────────────────────────────────────────────────

export class PembatasLaju {
  private cap: number[] = [];
  private rantai: Promise<void> = Promise.resolve();

  constructor(
    private readonly sekarang: () => number = () => Date.now(),
    private readonly tidur: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
    private readonly batas: number = BATAS_PER_MENIT,
  ) {}

  /** Selesai bila permintaan boleh dikirim; permintaan diantre berurutan. */
  tunggu(): Promise<void> {
    const giliran = this.rantai.then(async () => {
      for (;;) {
        const kini = this.sekarang();
        this.cap = this.cap.filter((t) => kini - t < JENDELA_MS);
        if (this.cap.length < this.batas) {
          this.cap.push(kini);
          return;
        }
        await this.tidur(this.cap[0]! + JENDELA_MS - kini);
      }
    });
    this.rantai = giliran.catch(() => undefined);
    return giliran;
  }
}

// ── Live ────────────────────────────────────────────────────────────────────

export interface OpsiLive {
  fetch?: typeof fetch;
  pembatas?: PembatasLaju;
  timeoutMs?: number;
  /** Untuk menandai asal data; live selalu "LIVE". */
}

export function buatSumberLive(opsi: OpsiLive = {}): SumberCuaca {
  const ambil = opsi.fetch ?? fetch;
  const pembatas = opsi.pembatas ?? new PembatasLaju();
  const timeoutMs = opsi.timeoutMs ?? TIMEOUT_MS;

  async function teks(url: string): Promise<string> {
    await pembatas.tunggu();
    const pengendali = new AbortController();
    const pewaktu = setTimeout(() => pengendali.abort(), timeoutMs);
    try {
      const r = await ambil(url, { signal: pengendali.signal, headers: { accept: "application/json, application/xml, text/xml, */*" } });
      if (!r.ok) throw new GalatBmkg("HTTP", `BMKG membalas status ${r.status}`);
      return await r.text();
    } catch (e) {
      if (e instanceof GalatBmkg) throw e;
      if (pengendali.signal.aborted) throw new GalatBmkg("TIMEOUT", "BMKG tidak membalas tepat waktu");
      throw new GalatBmkg("JARINGAN", "BMKG tidak dapat dihubungi");
    } finally {
      clearTimeout(pewaktu);
    }
  }

  const sumber: SumberCuaca = {
    async prakiraan(adm4) {
      if (!POLA_ADM4.test(adm4)) throw new GalatBmkg("FORMAT", "adm4 tidak sah");
      const mentah = await teks(`${SUMBER_BMKG.prakiraan}?adm4=${encodeURIComponent(adm4)}`);
      let json: unknown;
      try {
        json = JSON.parse(mentah);
      } catch {
        throw new GalatBmkg("FORMAT", "Respons prakiraan bukan JSON");
      }
      return normalisasiPrakiraan(json, adm4, "LIVE");
    },
    async daftarNowcast() {
      return parseDaftarNowcast(await teks(SUMBER_BMKG.daftarNowcast));
    },
    async detailNowcast(url) {
      if (!url.startsWith("https://www.bmkg.go.id/alerts/nowcast/")) throw new GalatBmkg("FORMAT", "URL detail bukan milik BMKG");
      return parseCap(await teks(url));
    },
    nowcast: (provinsi) => semuaDetail(sumber, provinsi),
  };
  return sumber;
}

// ── Snapshot ────────────────────────────────────────────────────────────────

export interface OpsiSnapshot {
  /** Folder data/bmkg; default: dicari ke atas dari cwd. */
  dir?: string;
  /** Awalan nama berkas ("" untuk snapshot nyata, "fixture-" untuk fixture uji). */
  awalan?: string;
  baca?: (jalur: string) => Promise<string>;
}

export function cariDirSnapshot(dari: string = process.cwd()): string {
  let d = resolve(dari);
  for (;;) {
    const calon = resolve(d, "data", "bmkg");
    if (existsSync(calon)) return calon;
    const induk = dirname(d);
    if (induk === d) throw new GalatBmkg("SNAPSHOT_TIDAK_ADA", "Folder data/bmkg tidak ditemukan");
    d = induk;
  }
}

export function buatSumberSnapshot(opsi: OpsiSnapshot = {}): SumberCuaca {
  const awalan = opsi.awalan ?? "";
  const baca = opsi.baca ?? ((j: string) => readFile(j, "utf8"));
  const dir = () => opsi.dir ?? cariDirSnapshot();

  async function berkas(nama: string): Promise<string> {
    try {
      return await baca(resolve(dir(), `${awalan}${nama}`));
    } catch (e) {
      if (e instanceof GalatBmkg) throw e;
      throw new GalatBmkg("SNAPSHOT_TIDAK_ADA", "Berkas snapshot BMKG tidak ada");
    }
  }

  const sumber: SumberCuaca = {
    async prakiraan(adm4) {
      if (!POLA_ADM4.test(adm4)) throw new GalatBmkg("FORMAT", "adm4 tidak sah");
      let json: unknown;
      try {
        json = JSON.parse(await berkas(`prakiraan-${adm4}.json`));
      } catch (e) {
        if (e instanceof GalatBmkg) throw e;
        throw new GalatBmkg("FORMAT", "Snapshot prakiraan bukan JSON");
      }
      return normalisasiPrakiraan(json, adm4, "SNAPSHOT");
    },
    async daftarNowcast() {
      return parseDaftarNowcast(await berkas("nowcast-rss.xml"));
    },
    async detailNowcast(url) {
      const m = /\/([A-Za-z0-9]+)_alert\.xml$/.exec(url);
      if (!m) throw new GalatBmkg("FORMAT", "URL detail tidak sah");
      return parseCap(await berkas(`cap-${m[1]}.xml`));
    },
    nowcast: (provinsi) => semuaDetail(sumber, provinsi),
  };
  return sumber;
}

export type { PrakiraanMentah };
