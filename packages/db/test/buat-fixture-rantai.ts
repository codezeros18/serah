// Membuat packages/db/test/fixture-rantai.json: 3 event + hash acuan dihitung dengan implementasi JS
// yang independen dari SQL (BLUEPRINT §F.3). Test SQL (S01) dan test core/rantai (S02) memakai nilai yang sama.
//   node packages/db/test/buat-fixture-rantai.ts
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function kanonis(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(kanonis).join(",")}]`;
  if (v !== null && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${kanonis(v[k] ?? null)}`)
      .join(",")}}`;
  }
  if (typeof v === "number" && !Number.isInteger(v)) throw new Error("payload wajib integer");
  return JSON.stringify(v);
}

type Masukan = { jenis: string; serahKode: string | null; peran: string | null; payload: Json; diterimaPada: string };

function hashEvent(prev: string, e: Masukan): string {
  const teks = [prev, e.jenis, e.serahKode ?? "-", e.peran ?? "-", kanonis(e.payload), new Date(e.diterimaPada).toISOString()].join("|");
  return createHash("sha256").update(teks, "utf8").digest("hex");
}

const masukan: Masukan[] = [
  {
    jenis: "WADAH_DICATAT",
    serahKode: null,
    peran: "PETUGAS",
    payload: { wadahId: "w1", aliran: "KUNING", beratG: 42500 },
    diterimaPada: "2026-10-15T01:02:03.004Z",
  },
  {
    // Kunci "b" vs "aa": urutan jsonb (panjang dulu) ≠ leksikografis — memastikan SQL tidak memakai jsonb::text.
    jenis: "SERAH_DIBUAT",
    serahKode: "SRH-20261015-0001",
    peran: "PETUGAS",
    payload: { wadahIds: ["w1", "w2"], b: 1, aa: { z: null, "é": 'Kemayoran "timur"', a: true } },
    diterimaPada: "2026-10-15T02:00:00.000Z",
  },
  {
    // Event sistem: peran null → "-".
    jenis: "SERAH_MENGGANTUNG",
    serahKode: "SRH-20261015-0001",
    peran: null,
    payload: { jam: 13 },
    diterimaPada: "2026-10-15T14:00:00.000Z",
  },
];

let prev = "0".repeat(64);
const event = masukan.map((e) => {
  const hash = hashEvent(prev, e);
  const baris = { ...e, payloadKanonis: kanonis(e.payload), prevHash: prev, hash };
  prev = hash;
  return baris;
});

const keluar = {
  keterangan: "hash = SHA-256(prev|jenis|serah_kode atau -|peran atau -|payload_kanonis|diterima_pada ISO UTC ms), hex kecil",
  event,
};
writeFileSync(new URL("./fixture-rantai.json", import.meta.url), JSON.stringify(keluar, null, 2) + "\n");
process.stdout.write(`${event.map((e) => `${e.jenis} ${e.hash}`).join("\n")}\n`);
