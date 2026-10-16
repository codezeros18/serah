"use client";

import { useCallback, useEffect, useState } from "react";
import type { AksiAturan, Aliran, KodeAturan } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, LencanaAliran, PanelAturan, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { QrTampil } from "@/lib/klien/komponen/qr-tampil";
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
      setGalat(h.galat.kode === "ATURAN_DITOLAK" && h.galat.aturan ? h.galat.aturan.teks : h.pesan);
      return;
    }
    setDibuat(h.data);
    setDipilih(new Set());
    await muat();
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.T2_JUDUL}</h1>
      <PitaAntrean />

      {!tps ? (
        <PilihTps onTerpilih={setTps} />
      ) : dibuat ? (
        <Kartu
          className="flex flex-col items-center gap-4 rounded-kartu border-2 border-aksi bg-kertas p-6 text-center shadow-md"
          data-testid="serah-dibuat"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-status-selesai bg-status-selesai-latar text-status-selesai">
            <span className="text-2xl font-semibold">✓</span>
          </div>
          <p role="status" className="text-xl font-semibold text-tinta">
            {isi("T2_DIBUAT", { kode_serah: dibuat.kode })}
          </p>
          <div className="rounded-kartu border-2 border-garis bg-white p-3 shadow-inner">
            <QrTampil isi={dibuat.qrToken} label={TEKS.T2_QR_PETUNJUK} lebarPx={280} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p
              className="rounded-kontrol border-2 border-garis bg-latar px-4 py-2 font-mono text-3xl font-semibold tracking-widest text-aksi"
              data-testid="kode-serah"
            >
              {dibuat.kode}
            </p>
          </div>
          <p className="max-w-sm text-base font-semibold text-tinta-redup">{TEKS.T2_QR_PETUNJUK}</p>
          <Tombol
            varian="sekunder"
            className="min-h-14 w-full border-2 border-garis text-base font-bold active:scale-[0.98] transition-all"
            onClick={() => setDibuat(null)}
          >
            {TEKS.UMUM_TUTUP}
          </Tombol>
        </Kartu>
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
              <span>{TEKS.T2_PILIH}</span>
            </legend>
            {wadah.length === 0 ? (
              <p className="rounded-kartu border border-dashed border-garis p-6 text-center text-base font-semibold text-tinta-redup">
                {TEKS.K_KOSONG_TPS}
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5" data-testid="wadah-menunggu">
                {wadah.map((w) => {
                  const dipilihIni = dipilih.has(w.id);
                  return (
                    <li key={w.id}>
                      <label
                        className={`flex min-h-16 cursor-pointer items-center gap-3.5 rounded-kartu border-2 p-3.5 transition-all duration-150 active:scale-[0.99] ${
                          dipilihIni
                            ? "border-aksi bg-aksi-latar shadow-sm ring-2 ring-aksi/30"
                            : "border-garis-halus bg-kertas hover:border-garis"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="kotak-centang kotak-bulat"
                          checked={dipilihIni}
                          onChange={() => alih(w.id)}
                          data-wadah={w.id}
                        />
                        <LencanaAliran aliran={w.aliran} pendek />
                        <span className="font-mono text-lg font-bold tabular-nums text-tinta">
                          {w.beratG !== null
                            ? isi("UMUM_KG", { nilai: formatGramKeKg(w.beratG) })
                            : w.jumlahWadah !== null
                              ? isi("UMUM_WADAH", { jumlah: w.jumlahWadah })
                              : TEKS.UMUM_BERAT_BELUM}
                        </span>
                        <span className="ml-auto rounded-full border border-garis-halus bg-latar px-2.5 py-1 text-xs font-semibold tabular-nums text-tinta-redup">
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
          <Tombol
            disabled={sibuk}
            onClick={() => void buat()}
            className="min-h-14 w-full text-lg font-semibold bg-aksi text-aksi-teks hover:bg-aksi-hover shadow-md active:scale-[0.98] transition-all"
          >
            {sibuk ? TEKS.UMUM_MUAT : TEKS.T2_BUAT}
          </Tombol>
        </>
      )}
    </div>
  );
}
