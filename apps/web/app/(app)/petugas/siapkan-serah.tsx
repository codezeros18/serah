"use client";

import { useCallback, useEffect, useState } from "react";
import type { AksiAturan, Aliran, KodeAturan } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, LencanaAliran, PanelAturan } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { IkonLanding } from "@/lib/klien/komponen/ikon-landing";
import { QrTampil } from "@/lib/klien/komponen/qr-tampil";
import { useModalHasil } from "@/lib/klien/komponen/modal-hasil";
import { KartuTps } from "./kartu-tps";
import { PilihTps } from "./pilih-tps";
import { PitaAntrean } from "./pita-antrean";
import { bacaTpsTerpilih, type TpsTerpilih } from "./tps-terpilih";

type Wadah = { id: string; aliran: Aliran; beratG: number | null; jumlahWadah: number | null; umurJam: number };
type Peringatan = { kode: KodeAturan; aksi: AksiAturan; teks: string };
const KODE_PERINGATAN: readonly KodeAturan[] = ["R05", "R06", "R09"];

/** T2 (§L.3): pilih wadah menunggu → buat serah DRAF → QR serah. Butuh sambungan (kode serah dibuat server). */
export function SiapkanSerah() {
  const [tps, setTps] = useState<TpsTerpilih | null>(null);
  const [wadah, setWadah] = useState<Wadah[]>([]);
  const [peringatan, setPeringatan] = useState<Peringatan[]>([]);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const { galat: tampilGalat, modal } = useModalHasil();
  const [dibuat, setDibuat] = useState<{ kode: string; qrToken: string } | null>(null);

  useEffect(() => {
    setTps(bacaTpsTerpilih());
  }, []);

  const muat = useCallback(async () => {
    if (!tps) return;
    const h = await panggil("GET", "/api/tps/[id]/menunggu", { params: { id: tps.id } });
    if (!h.ok) {
      setGalat(h.pesan);
      return;
    }
    setWadah(h.data.wadah);
    setPeringatan(h.data.peringatan.filter((p) => KODE_PERINGATAN.includes(p.kode)));
  }, [tps]);

  useEffect(() => {
    void muat();
  }, [muat]);

  function alih(id: string) {
    setDipilih((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function buat() {
    if (!tps) return;
    setGalat(null);
    if (dipilih.size === 0) {
      setGalat(TEKS.T2_TANPA_PILIHAN);
      return;
    }
    setSibuk(true);
    // Kunci idempotensi dibuat saat tombol ditekan: klik ganda / ulang jaringan = satu serah.
    const h = await panggil("POST", "/api/serah", {
      body: { tpsId: tps.id, wadahIds: [...dipilih] },
      idempotencyKey: crypto.randomUUID(),
    });
    setSibuk(false);
    if (!h.ok) {
      if (h.galat.kode === "ATURAN_DITOLAK" && h.galat.aturan) setGalat(h.galat.aturan.teks);
      else tampilGalat(h.pesan, () => void buat());
      return;
    }
    setDibuat(h.data);
    setDipilih(new Set());
    await muat();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.T2_JUDUL}</h1>
      <PitaAntrean />
      {modal}

      {!tps ? (
        <PilihTps onTerpilih={setTps} />
      ) : dibuat ? (
        <section
          className="muncul flex flex-col items-center gap-5 rounded-[2rem] bg-white/80 p-6 text-center shadow-[0_24px_70px_rgba(36,87,197,0.12)] ring-1 ring-garis-halus/70 backdrop-blur"
          data-testid="serah-dibuat"
        >
          <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
              <path className="gambar-centang" d="m5 12.500 4.500 4.500L19 7" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p role="status" className="text-lg font-semibold text-tinta">
            {isi("T2_DIBUAT", { kode_serah: dibuat.kode })}
          </p>
          <div className="rounded-3xl bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.08)] ring-1 ring-garis-halus">
            <QrTampil isi={dibuat.qrToken} label={TEKS.T2_QR_PETUNJUK} lebarPx={280} />
          </div>
          <p className="rounded-xl bg-latar px-4 py-2 font-mono text-xl font-semibold tracking-widest text-aksi" data-testid="kode-serah">
            {dibuat.kode}
          </p>
          <p className="max-w-xs text-sm text-tinta-redup">{TEKS.T2_QR_PETUNJUK}</p>
          <button
            type="button"
            onClick={() => setDibuat(null)}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl border border-garis-halus bg-kertas text-base font-medium text-tinta transition-all duration-200 hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
          >
            {TEKS.UMUM_TUTUP}
          </button>
        </section>
      ) : (
        <>
          <KartuTps tps={tps} onGanti={() => setTps(null)} />

          {peringatan.map((p) => (
            <PanelAturan key={p.kode} aksi={p.aksi} kode={p.kode} teks={p.teks} />
          ))}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-tinta-redup">
              <span>{TEKS.T2_PILIH}</span>
              {dipilih.size > 0 ? (
                <span className="rounded-full bg-aksi px-2 py-0.5 text-[11px] font-semibold tabular-nums normal-case tracking-normal text-white">
                  {dipilih.size}
                </span>
              ) : null}
            </legend>
            {wadah.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-garis-halus bg-latar/50 px-6 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
                  <IkonLanding nama="tps" className="h-8 w-8" />
                </span>
                <p className="text-sm text-tinta-redup">{TEKS.K_KOSONG_TPS}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5" data-testid="wadah-menunggu">
                {wadah.map((w) => {
                  const dipilihIni = dipilih.has(w.id);
                  return (
                    <li key={w.id}>
                      <label
                        className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-3xl p-3.5 transition-all duration-200 active:scale-[0.99] ${
                          dipilihIni
                            ? "bg-aksi-latar/70 shadow-[0_8px_24px_rgba(36,87,197,0.14)] ring-2 ring-aksi/60"
                            : "bg-white/80 shadow-[0_4px_16px_rgba(15,23,42,0.04)] ring-1 ring-garis-halus/70 hover:-translate-y-0.5 hover:ring-aksi-garis"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="kotak-centang kotak-bulat"
                          checked={dipilihIni}
                          onChange={() => alih(w.id)}
                          data-wadah={w.id}
                        />
                        <LencanaAliran aliran={w.aliran} pendek ikon />
                        <span className="flex-1 font-mono text-base font-semibold tabular-nums text-tinta">
                          {w.beratG !== null
                            ? isi("UMUM_KG", { nilai: formatGramKeKg(w.beratG) })
                            : w.jumlahWadah !== null
                              ? isi("UMUM_WADAH", { jumlah: w.jumlahWadah })
                              : TEKS.UMUM_BERAT_BELUM}
                        </span>
                        <span className="shrink-0 rounded-full bg-latar px-2.5 py-1 text-xs tabular-nums text-tinta-redup">
                          {isi("T2_UMUR", { jam: w.umurJam })}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
          {galat ? <BannerGalat pesan={galat} /> : null}
          <button
            type="button"
            disabled={sibuk}
            onClick={() => void buat()}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-aksi text-base font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {sibuk ? TEKS.UMUM_MUAT : TEKS.T2_BUAT}
          </button>
        </>
      )}
    </div>
  );
}
