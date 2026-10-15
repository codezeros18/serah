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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.T2_JUDUL}</h1>
      <PitaAntrean />

      {!tps ? (
        <PilihTps onTerpilih={setTps} />
      ) : dibuat ? (
        <Kartu className="flex flex-col items-center gap-3 text-center" data-testid="serah-dibuat">
          <p role="status" className="text-lg font-bold">
            {isi("T2_DIBUAT", { kode_serah: dibuat.kode })}
          </p>
          <QrTampil isi={dibuat.qrToken} label={TEKS.T2_QR_PETUNJUK} lebarPx={320} />
          <p className="font-mono text-xl font-bold" data-testid="kode-serah">
            {dibuat.kode}
          </p>
          <p className="text-base">{TEKS.T2_QR_PETUNJUK}</p>
          <Tombol varian="sekunder" onClick={() => setDibuat(null)}>
            {TEKS.UMUM_TUTUP}
          </Tombol>
        </Kartu>
      ) : (
        <>
          <p className="text-base font-semibold">{isi("T1_TPS_TERPILIH", { kode_tps: tps.kode, nama_kawasan: tps.namaKawasan })}</p>
          {peringatan.map((p) => (
            <PanelAturan key={p.kode} aksi={p.aksi} kode={p.kode} teks={p.teks} />
          ))}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-base font-semibold">{TEKS.T2_PILIH}</legend>
            {wadah.length === 0 ? (
              <p className="text-base">{TEKS.K_KOSONG_TPS}</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="wadah-menunggu">
                {wadah.map((w) => (
                  <li key={w.id}>
                    <label className="flex min-h-14 items-center gap-3 rounded-kartu border-2 border-garis p-3">
                      <input type="checkbox" className="h-6 w-6" checked={dipilih.has(w.id)} onChange={() => alih(w.id)} data-wadah={w.id} />
                      <LencanaAliran aliran={w.aliran} pendek />
                      <span className="text-base font-semibold">
                        {w.beratG !== null
                          ? isi("UMUM_KG", { nilai: formatGramKeKg(w.beratG) })
                          : w.jumlahWadah !== null
                            ? isi("UMUM_WADAH", { jumlah: w.jumlahWadah })
                            : TEKS.UMUM_BERAT_BELUM}
                      </span>
                      <span className="ml-auto text-sm">{isi("T2_UMUR", { jam: w.umurJam })}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          {galat ? <BannerGalat pesan={galat} /> : null}
          <Tombol disabled={sibuk} onClick={() => void buat()}>
            {TEKS.T2_BUAT}
          </Tombol>
        </>
      )}
    </div>
  );
}
