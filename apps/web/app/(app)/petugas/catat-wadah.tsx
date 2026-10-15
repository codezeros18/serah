"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ALIRAN, type AksiAturan, type Aliran, type KodeAturan } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, IsianBerat, KELAS_ALIRAN, KUNCI_ALIRAN, LencanaAliran, PanelAturan, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg, parseBeratKgKeGram } from "@/lib/klien/angka";
import { antreanBersama } from "@/lib/klien/antrean/bersama";
import { useAntrean } from "@/lib/klien/antrean/pakai-antrean";
import { PilihTps } from "./pilih-tps";
import { PitaAntrean } from "./pita-antrean";
import { bacaTpsTerpilih, type TpsTerpilih } from "./tps-terpilih";

type Baris = { kunci: string; aliran: Aliran; beratG: number | null; jumlahWadah: number | null; umurJam: number | null };
type Peringatan = { kode: KodeAturan; aksi: AksiAturan; teks: string };
const KODE_PERINGATAN: readonly KodeAturan[] = ["R05", "R06", "R09"];
const JUMLAH_TERAKHIR = 5;
const POLA_JUMLAH = /^\d{1,4}$/;

/** T1 (§L.3): pindai QR TPS → pilih warna → berat atau jumlah → simpan. Selalu lewat antrean (tahan offline). */
export function CatatWadah() {
  const [tps, setTps] = useState<TpsTerpilih | null>(null);
  const [aliran, setAliran] = useState<Aliran | null>(null);
  const [berat, setBerat] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [beratSalah, setBeratSalah] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<"terkirim" | "lokal" | null>(null);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [peringatan, setPeringatan] = useState<Peringatan[]>([]);
  const { keadaan } = useAntrean();

  useEffect(() => {
    setTps(bacaTpsTerpilih());
  }, []);

  const muatDaftar = useCallback(async () => {
    if (!tps) return;
    const [server, lokal] = await Promise.all([
      panggil("GET", "/api/tps/[id]/menunggu", { params: { id: tps.id } }),
      antreanBersama().daftar(),
    ]);
    const dariServer: Baris[] = server.ok
      ? [...server.data.wadah]
          .sort((a, b) => b.terjadiPada.localeCompare(a.terjadiPada))
          .map((w) => ({ kunci: w.id, aliran: w.aliran, beratG: w.beratG, jumlahWadah: w.jumlahWadah, umurJam: w.umurJam }))
      : [];
    const dariPerangkat: Baris[] = lokal
      .filter((a) => a.jenis === "WADAH_CATAT" && a.status === "MENUNGGU")
      .map((a) => ({ a, p: a.payload as { tpsId?: string; aliran?: Aliran; beratG?: number; jumlahWadah?: number } }))
      .filter(({ p }) => p.tpsId === tps.id && p.aliran !== undefined)
      .map(({ a, p }) => ({ kunci: a.idempotencyKey, aliran: p.aliran as Aliran, beratG: p.beratG ?? null, jumlahWadah: p.jumlahWadah ?? null, umurJam: null }))
      .reverse();
    setBaris([...dariPerangkat, ...dariServer].slice(0, JUMLAH_TERAKHIR));
    if (server.ok) {
      setPeringatan(server.data.peringatan.filter((p) => KODE_PERINGATAN.includes(p.kode)));
    }
  }, [tps]);

  useEffect(() => {
    void muatDaftar();
  }, [muatDaftar, keadaan.menunggu]);

  async function simpan() {
    if (!tps) return;
    setGalat(null);
    setHasil(null);
    setBeratSalah(false);
    if (!aliran) {
      setGalat(TEKS.T1_PILIH_ALIRAN);
      return;
    }
    const adaBerat = berat.trim() !== "";
    const adaJumlah = jumlah.trim() !== "";
    if (!adaBerat && !adaJumlah) {
      setGalat(TEKS.T1_ISI_SALAH_SATU);
      return;
    }
    const beratG = adaBerat ? parseBeratKgKeGram(berat) : null;
    if (adaBerat && beratG === null) {
      setBeratSalah(true);
      return;
    }
    if (adaJumlah && (!POLA_JUMLAH.test(jumlah.trim()) || Number.parseInt(jumlah, 10) < 1)) {
      setGalat(TEKS.G_VALIDASI);
      return;
    }
    // Kunci idempotensi dibuat sekarang (saat tombol ditekan) di Antrean.tambah, bukan saat kirim.
    const payload = {
      tpsId: tps.id,
      aliran,
      ...(beratG !== null ? { beratG } : {}),
      ...(adaJumlah ? { jumlahWadah: Number.parseInt(jumlah, 10) } : {}),
      terjadiPada: new Date().toISOString(),
    };
    await antreanBersama().tambah("WADAH_CATAT", payload);
    const r = navigator.onLine ? await antreanBersama().sinkron() : null;
    setHasil(r && r.sisa === 0 ? "terkirim" : "lokal");
    performance.mark("t1-simpan");
    if (performance.getEntriesByName("t1-qr").length > 0) performance.measure("t1-qr-ke-simpan", "t1-qr", "t1-simpan");
    setBerat("");
    setJumlah("");
    setAliran(null);
    await muatDaftar();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.T1_JUDUL}</h1>
      <PitaAntrean />

      {!tps ? (
        <PilihTps onTerpilih={setTps} />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-kartu border-2 border-garis bg-kertas p-4 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-kontrol border-2 border-aksi-garis bg-aksi-latar font-bold text-aksi">
                TPS
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold text-tinta truncate" data-testid="tps-terpilih">
                  {isi("T1_TPS_TERPILIH", { kode_tps: tps.kode, nama_kawasan: tps.namaKawasan })}
                </p>
              </div>
            </div>
            <Tombol
              varian="sekunder"
              className="min-h-12 border-2 border-garis font-bold shrink-0 active:scale-[0.98] transition-all"
              onClick={() => setTps(null)}
            >
              {TEKS.T1_PINDAI}
            </Tombol>
          </div>

          {peringatan.map((p) => (
            <PanelAturan key={p.kode} aksi={p.aksi} kode={p.kode} teks={p.teks} />
          ))}

          <fieldset className="flex flex-col gap-3">
            <legend className="flex items-center gap-2.5 text-lg font-semibold text-tinta">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-aksi text-sm font-bold text-aksi-teks shadow-xs">
                1
              </span>
              <span>{TEKS.T1_PILIH_ALIRAN}</span>
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {ALIRAN.map((a) => {
                const terpilih = aliran === a;
                return (
                  <button
                    key={a}
                    type="button"
                    data-aliran-pilih={a}
                    aria-pressed={terpilih}
                    onClick={() => setAliran(a)}
                    className={`min-h-16 rounded-kartu px-4 py-3 text-base font-bold transition-all duration-150 active:scale-[0.98] shadow-sm ${KELAS_ALIRAN[a]} ${
                      terpilih ? "outline outline-4 outline-offset-2 outline-fokus" : ""
                    }`}
                  >
                    {TEKS[KUNCI_ALIRAN[a]]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 rounded-kartu border-2 border-garis-halus bg-kertas p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-aksi text-sm font-bold text-aksi-teks shadow-xs">
                2
              </span>
              <span className="text-lg font-semibold text-tinta">{TEKS.T1_BERAT_LABEL}</span>
            </div>

            <IsianBerat
              id="t1-berat"
              nilai={berat}
              onUbah={setBerat}
              salah={beratSalah}
              className="min-h-14 text-2xl font-mono font-bold tabular-nums"
            />

            <div className="flex flex-col gap-1.5 pt-1">
              <label htmlFor="t1-jumlah" className="text-base font-bold text-tinta">
                {TEKS.T1_JUMLAH_LABEL}
              </label>
              <input
                id="t1-jumlah"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                className="min-h-14 rounded-kontrol border-2 border-garis bg-kertas px-4 text-2xl font-mono font-bold tabular-nums text-tinta focus:border-aksi focus:ring-2 focus:ring-aksi/20"
              />
            </div>
          </div>

          {galat ? <BannerGalat pesan={galat} /> : null}
          <Tombol
            onClick={() => void simpan()}
            className="min-h-14 w-full text-lg font-semibold bg-aksi text-aksi-teks hover:bg-aksi-hover shadow-md active:scale-[0.98] transition-all"
          >
            {TEKS.T1_SIMPAN}
          </Tombol>
          {hasil ? (
            <div className="flex items-center gap-3 rounded-kartu border-2 border-status-selesai bg-status-selesai-latar p-4 text-status-selesai shadow-xs">
              <span aria-hidden="true" className="text-2xl font-semibold">
                ✓
              </span>
              <p role="status" data-testid="hasil-simpan" className="text-base font-bold">
                {hasil === "terkirim" ? TEKS.T1_TERSIMPAN : TEKS.T1_TERSIMPAN_LOKAL}
              </p>
            </div>
          ) : null}

          <section className="flex flex-col gap-2.5 pt-2" aria-labelledby="t1-terakhir">
            <h2 id="t1-terakhir" className="text-lg font-semibold text-tinta">
              {TEKS.T1_TERAKHIR}
            </h2>
            {baris.length === 0 ? (
              <p className="text-base font-semibold text-tinta-redup rounded-kartu border border-dashed border-garis p-4 text-center">
                {TEKS.K_KOSONG_TPS}
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5" data-testid="catatan-terakhir">
                {baris.map((b) => (
                  <li
                    key={b.kunci}
                    className="flex min-h-14 flex-wrap items-center gap-3 rounded-kartu border-2 border-garis-halus bg-kertas p-3.5 shadow-xs transition-colors hover:border-garis"
                  >
                    <LencanaAliran aliran={b.aliran} pendek />
                    <span className="font-mono text-lg font-bold tabular-nums text-tinta">
                      {b.beratG !== null
                        ? isi("UMUM_KG", { nilai: formatGramKeKg(b.beratG) })
                        : b.jumlahWadah !== null
                          ? isi("UMUM_WADAH", { jumlah: b.jumlahWadah })
                          : TEKS.UMUM_BERAT_BELUM}
                    </span>
                    <span className="ml-auto rounded-full border border-garis-halus bg-latar px-2.5 py-1 text-xs font-semibold tabular-nums text-tinta-redup">
                      {b.umurJam === null ? TEKS.T1_TERSIMPAN_LOKAL : isi("UMUM_JAM_LALU", { jam: b.umurJam })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link
            href="/petugas/serah"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-kontrol border-2 border-aksi bg-aksi-latar px-5 text-base font-bold text-aksi shadow-xs transition-all hover:bg-aksi hover:text-aksi-teks active:scale-[0.98]"
          >
            <span>{TEKS.T1_KE_SERAH}</span>
            <span aria-hidden="true" className="text-lg font-semibold">
              →
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
