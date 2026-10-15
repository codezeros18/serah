import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bukaAliran, pendengar } from "@/lib/server/sse";
import { asal, data, demo, formFoto, masuk, panggil, pngContoh, type DemoS08 } from "@/lib/server/uji/klien";
import { POST as unggah } from "./foto/route";
import { GET as langsung } from "./langsung/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { POST as setujui } from "./serah/[kode]/setujui/route";
import { POST as buatSerah } from "./serah/route";
import { POST as catatWadah } from "./wadah/route";

// T28 — SSE: transisi di transaksi A → event diterima klien organisasi terkait, tidak oleh organisasi lain.
// Notifikasi hanya ke peran tujuan dalam organisasi. Heartbeat & pembersihan LISTEN saat klien putus.

// Alur pertama memakai tujuh panggilan API + menunggu event hingga 10 dtk: beri ruang di suite yang padat.
vi.setConfig({ testTimeout: 60_000 });

type Event = { event: string; data: { jenis: string; kode: string; versi: number } };
type Aliran = { events: Event[]; header: Headers; batal: () => void; selesai: Promise<void> };

let d: DemoS08;

beforeAll(async () => {
  d = await demo();
});

function urai(teks: string): Event[] {
  return teks
    .split("\n\n")
    .map((blok) => {
      const event = /^event: (.+)$/m.exec(blok)?.[1];
      const isi = /^data: (.+)$/m.exec(blok)?.[1];
      return event && isi ? { event, data: JSON.parse(isi) } : null;
    })
    .filter((x): x is Event => x !== null);
}

async function buka(cookie: string): Promise<Aliran> {
  const ac = new AbortController();
  const r = await (langsung as unknown as (q: Request) => Promise<Response>)(new Request(`${asal()}/api/langsung`, { headers: { cookie }, signal: ac.signal }));
  expect(r.status).toBe(200);
  const aliran: Aliran = { events: [], header: r.headers, batal: () => ac.abort(), selesai: Promise.resolve() };
  const pembaca = r.body!.getReader();
  const dec = new TextDecoder();
  let sisa = "";
  aliran.selesai = (async () => {
    try {
      for (;;) {
        const { done, value } = await pembaca.read();
        if (done) break;
        sisa += dec.decode(value, { stream: true });
        const potong = sisa.lastIndexOf("\n\n");
        if (potong >= 0) {
          aliran.events.push(...urai(sisa.slice(0, potong + 2)));
          sisa = sisa.slice(potong + 2);
        }
      }
    } catch {
      /* dibatalkan */
    }
  })();
  return aliran;
}

async function tunggu(cek: () => boolean, ms = 10_000): Promise<void> {
  const awal = Date.now();
  while (!cek()) {
    if (Date.now() - awal > ms) throw new Error("waktu habis menunggu event SSE");
    await new Promise((r) => setTimeout(r, 25));
  }
}

const untuk = (a: Aliran, kode: string, event?: string) => a.events.filter((e) => e.data.kode === kode && (!event || e.event === event));

describe("T28 — GET /api/langsung", () => {
  it("event serah ke pihak terlibat saja; notifikasi hanya ke peran tujuan; organisasi lain tidak menerima apa pun", async () => {
    const petugas = await masuk("PETUGAS");
    const pengelola = await masuk("PENGELOLA");
    const pengangkut = await masuk("PENGANGKUT");
    const penerima = await masuk("PENERIMA"); // Daur Ulang Contoh Mandiri (tujuan)
    const penerimaLain = await masuk("PENERIMA", d.org.tpst); // berkontrak dengan kawasan, bukan pihak serah ini

    const [aPengelola, aPetugas, aPenerima, aLain] = [await buka(pengelola), await buka(petugas), await buka(penerima), await buka(penerimaLain)];
    expect(aPengelola.header.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(aPengelola.header.get("cache-control")).toBe("no-cache, no-transform");

    try {
      // Transaksi A: buat → ambil (ke penerima tujuan) → setujui.
      const w = data<{ id: string }>(await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, body: { tpsId: d.tps1, aliran: "KUNING", beratG: 3_000, terjadiPada: new Date().toISOString() } }));
      const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: [w.id] } })).kode;
      const fotoId = data<{ fotoId: string }>(
        await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kode) }),
      ).fotoId;
      data(await panggil(ambil, { jalur: "/", cookie: pengangkut, params: { kode }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }));
      data(await panggil(setujui, { jalur: "/", cookie: pengelola, params: { kode }, body: {} }));

      await tunggu(() => untuk(aPengelola, kode, "serah").some((e) => e.data.jenis === "SERAH_DISETUJUI") && untuk(aPenerima, kode, "notifikasi").length > 0);
      // Beri kesempatan event yang (seharusnya tidak) bocor untuk tiba.
      await new Promise((r) => setTimeout(r, 500));

      // Kawasan (pengelola & petugas, organisasi yang sama): semua transisi.
      for (const a of [aPengelola, aPetugas]) {
        expect(untuk(a, kode, "serah").map((e) => e.data.jenis)).toEqual(["SERAH_DIBUAT", "SERAH_DIAMBIL", "SERAH_DISETUJUI"]);
      }
      expect(untuk(aPengelola, kode, "serah").map((e) => e.data.versi)).toEqual([1, 2, 3]);
      // Notifikasi SERAH_MENUNGGU_SETUJU hanya untuk PENGELOLA (petugas di organisasi yang sama tidak).
      expect(untuk(aPengelola, kode, "notifikasi").map((e) => e.data.jenis)).toEqual(["SERAH_MENUNGGU_SETUJU"]);
      expect(untuk(aPetugas, kode, "notifikasi")).toEqual([]);
      // Penerima tujuan: sejak menjadi pihak (AMBIL), plus notifikasi SERAH_DIANGKUT.
      expect(untuk(aPenerima, kode, "serah").map((e) => e.data.jenis)).toEqual(["SERAH_DIAMBIL", "SERAH_DISETUJUI"]);
      expect(untuk(aPenerima, kode, "notifikasi").map((e) => e.data.jenis)).toEqual(["SERAH_DIANGKUT"]);
      // Organisasi lain: tidak ada apa pun tentang serah ini.
      expect(untuk(aLain, kode)).toEqual([]);
      // Payload tanpa data pribadi: hanya {jenis, kode, versi}.
      for (const e of [...aPengelola.events, ...aPenerima.events]) expect(Object.keys(e.data).sort()).toEqual(["jenis", "kode", "versi"]);
    } finally {
      for (const a of [aPengelola, aPetugas, aPenerima, aLain]) a.batal();
      await Promise.all([aPengelola, aPetugas, aPenerima, aLain].map((a) => a.selesai));
    }
  });

  it("klien putus → aliran selesai dan kanal LISTEN dilepas bila tak ada pelanggan lain", async () => {
    const sebelum = pendengar().jumlahKanal();
    const a = await buka(await masuk("PENERIMA", d.org.b3));
    expect(pendengar().jumlahKanal()).toBe(sebelum + 1);
    a.batal();
    await a.selesai;
    await tunggu(() => pendengar().jumlahKanal() === sebelum, 2_000);
  });

  it("heartbeat `ping` berkala; tanpa sesi → 401", async () => {
    const ac = new AbortController();
    const aliran = await bukaAliran({ orgIds: [d.org.kawasan], peran: "PENGELOLA", signal: ac.signal, detakMs: 40 });
    const pembaca = aliran.getReader();
    const dec = new TextDecoder();
    let teks = "";
    const awal = Date.now();
    while (!teks.includes("event: ping") && Date.now() - awal < 2_000) teks += dec.decode((await pembaca.read()).value ?? new Uint8Array());
    expect(teks.startsWith("retry: 5000\n\n")).toBe(true);
    expect(teks).toContain("event: ping\ndata: {}\n\n");
    ac.abort();
    const r = await (langsung as unknown as (q: Request) => Promise<Response>)(new Request(`${asal()}/api/langsung`));
    expect(r.status).toBe(401);
  });
});
