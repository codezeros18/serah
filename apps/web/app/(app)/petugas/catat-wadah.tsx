"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ALIRAN, type AksiAturan, type Aliran, type KodeAturan } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, IsianBerat, KELAS_ALIRAN_LEMBUT, KUNCI_ALIRAN, KUNCI_ALIRAN_PENDEK, LencanaAliran, PanelAturan } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg, parseBeratKgKeGram } from "@/lib/klien/angka";
import { antreanBersama } from "@/lib/klien/antrean/bersama";
import { useAntrean } from "@/lib/klien/antrean/pakai-antrean";
import { InfoTip } from "@/lib/klien/komponen/info-tip";
import { BilahSegmen, WARNA_ALIRAN } from "@/lib/klien/komponen/viz";
import { IkonLanding } from "@/lib/klien/komponen/ikon-landing";
import { useModalHasil } from "@/lib/klien/komponen/modal-hasil";
import { KartuTps } from "./kartu-tps";
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
  const [, setHasil] = useState<"terkirim" | "lokal" | null>(null);
  const { tampil, modal } = useModalHasil();
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
    const terkirim = Boolean(r && r.sisa === 0);
    setHasil(terkirim ? "terkirim" : "lokal");
    tampil(
      terkirim
        ? { jenis: "sukses", pesan: TEKS.T1_TERSIMPAN, testId: "hasil-simpan" }
        : { jenis: "offline", judul: TEKS.HASIL_TERSIMPAN_LOKAL, pesan: TEKS.T1_TERSIMPAN_LOKAL, testId: "hasil-simpan", otomatisMs: 2600 },
    );
    performance.mark("t1-simpan");
    if (performance.getEntriesByName("t1-qr").length > 0) performance.measure("t1-qr-ke-simpan", "t1-qr", "t1-simpan");
    setBerat("");
    setJumlah("");
    setAliran(null);
    await muatDaftar();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.T1_JUDUL}</h1>
        <InfoTip judul={TEKS.T1_JUDUL} isi={TEKS.INFO_T1} />
      </div>
      <PitaAntrean />
      {modal}

      {!tps ? (
        <PilihTps onTerpilih={setTps} />
      ) : (
        <>
          <KartuTps tps={tps} onGanti={() => setTps(null)} />

          {peringatan.map((p) => (
            <PanelAturan key={p.kode} aksi={p.aksi} kode={p.kode} teks={p.teks} />
          ))}

          {/* Warna wadah */}
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-tinta-redup">{TEKS.T1_PILIH_ALIRAN}</legend>
            <div className="grid grid-cols-2 gap-3">
              {ALIRAN.map((a) => {
                const terpilih = aliran === a;
                return (
                  <button
                    key={a}
                    type="button"
                    data-aliran-pilih={a}
                    aria-pressed={terpilih}
                    aria-label={TEKS[KUNCI_ALIRAN[a]]}
                    onClick={() => setAliran(a)}
                    className={`relative flex min-h-24 flex-col items-start justify-between gap-3 rounded-3xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] ${KELAS_ALIRAN_LEMBUT[a]} ${
                      terpilih ? "shadow-[0_12px_30px_rgba(36,87,197,0.18)] ring-2 ring-aksi" : "shadow-sm"
                    }`}
                  >
                    <LencanaAliran aliran={a} ikon />
                    <span className="text-sm font-semibold leading-tight" aria-hidden="true">
                      {TEKS[KUNCI_ALIRAN_PENDEK[a]]}
                    </span>
                    {terpilih ? (
                      <span aria-hidden="true" className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-aksi text-white">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                          <path d="m5 12.500 4.500 4.500L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Berat / jumlah */}
          <section className="flex flex-col gap-4 rounded-3xl bg-white/80 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] ring-1 ring-garis-halus/70 backdrop-blur" aria-label={TEKS.T1_BERAT_LABEL}>
            <IsianBerat id="t1-berat" nilai={berat} onUbah={setBerat} salah={beratSalah} />

            <div className="flex items-center gap-3 text-xs text-tinta-redup" aria-hidden="true">
              <span className="h-px flex-1 bg-garis-halus" />
              <span>{TEKS.T1_JUMLAH_LABEL}</span>
              <span className="h-px flex-1 bg-garis-halus" />
            </div>

            <div className="flex items-stretch gap-2">
              <button
                type="button"
                aria-label={TEKS.UMUM_KURANGI}
                onClick={() => setJumlah(String(Math.max(0, (Number.parseInt(jumlah, 10) || 0) - 1) || ""))}
                className="flex min-h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-latar text-2xl font-semibold text-tinta transition-all duration-150 hover:bg-aksi-latar hover:text-aksi active:scale-95"
              >
                −
              </button>
              <input
                id="t1-jumlah"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={TEKS.T1_JUMLAH_LABEL}
                placeholder="0"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                className="min-h-14 min-w-0 flex-1 rounded-2xl border border-garis-halus bg-kertas px-4 text-center font-mono text-2xl font-semibold tabular-nums text-tinta transition-all placeholder:text-garis hover:border-garis focus:border-aksi focus:outline-none focus:ring-4 focus:ring-aksi/15"
              />
              <button
                type="button"
                aria-label={TEKS.UMUM_TAMBAH}
                onClick={() => setJumlah(String((Number.parseInt(jumlah, 10) || 0) + 1))}
                className="flex min-h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-aksi text-2xl font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-150 hover:bg-aksi-hover active:scale-95"
              >
                +
              </button>
            </div>
          </section>

          {galat ? <BannerGalat pesan={galat} /> : null}
          <button
            type="button"
            onClick={() => void simpan()}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-aksi text-base font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover active:translate-y-0 active:scale-[0.98]"
          >
            {TEKS.T1_SIMPAN}
          </button>

          {/* Catatan hari ini */}
          <section className="flex flex-col gap-3 pt-2" aria-labelledby="t1-terakhir">
            <h2 id="t1-terakhir" className="text-xs font-semibold uppercase tracking-[0.12em] text-tinta-redup">
              {TEKS.T1_TERAKHIR}
            </h2>
            {baris.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-garis-halus bg-latar/50 p-5 text-center text-sm text-tinta-redup">
                {TEKS.K_KOSONG_TPS}
              </p>
            ) : (
              <>
                <BilahSegmen
                  tanpaLegenda
                  segmen={ALIRAN.map((a) => ({
                    kunci: a,
                    label: TEKS[KUNCI_ALIRAN[a]],
                    nilai: baris.filter((b) => b.aliran === a).reduce((j, b) => j + (b.beratG ?? 0), 0),
                    warna: WARNA_ALIRAN[a],
                  }))}
                />
                <ul className="overflow-hidden rounded-3xl bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] ring-1 ring-garis-halus/70 backdrop-blur" data-testid="catatan-terakhir">
                  {baris.map((b) => (
                    <li key={b.kunci} className="flex min-h-14 items-center gap-3 border-b border-garis-halus/60 px-3.5 py-2.5 last:border-b-0">
                      <LencanaAliran aliran={b.aliran} pendek ikon />
                      <span className="flex-1 font-mono text-base font-semibold tabular-nums text-tinta">
                        {b.beratG !== null
                          ? isi("UMUM_KG", { nilai: formatGramKeKg(b.beratG) })
                          : b.jumlahWadah !== null
                            ? isi("UMUM_WADAH", { jumlah: b.jumlahWadah })
                            : TEKS.UMUM_BERAT_BELUM}
                      </span>
                      <span className="shrink-0 rounded-full bg-latar px-2.5 py-1 text-xs tabular-nums text-tinta-redup">
                        {b.umurJam === null ? TEKS.T1_TERSIMPAN_LOKAL : isi("UMUM_JAM_LALU", { jam: b.umurJam })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <Link
            href="/petugas/serah"
            className="group flex min-h-16 items-center gap-3 rounded-3xl bg-gradient-to-br from-white to-aksi-latar/70 px-4 shadow-[0_8px_30px_rgba(36,87,197,0.10)] ring-1 ring-aksi-garis transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(36,87,197,0.18)] active:scale-[0.99]"
          >
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
              <IkonLanding nama="truk" className="h-6 w-6" />
            </span>
            <span className="flex-1 text-base font-semibold text-aksi">{TEKS.T1_KE_SERAH}</span>
            <span aria-hidden="true" className="text-xl text-aksi transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
