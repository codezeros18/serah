"use client";

import { useState } from "react";
import type { Aliran, TargetKoreksi } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { parseBeratKgKeGram } from "@/lib/klien/angka";
import { Pilih } from "./pilih";

export interface ItemWadahKoreksi {
  id: string;
  aliran: Aliran;
  beratG: number | null;
}

export interface ItemRincianKoreksi {
  id: string;
  aliran: Aliran;
  diterimaFinalG: number;
  ditolakFinalG: number;
}

export interface TombolAjukanKoreksiProps {
  wadah: ItemWadahKoreksi[];
  rincian: ItemRincianKoreksi[];
  onSelesai?: () => void;
}

export function TombolAjukanKoreksi({ wadah, rincian, onSelesai }: TombolAjukanKoreksiProps) {
  const [terbuka, setTerbuka] = useState(false);
  const [targetPilihan, setTargetPilihan] = useState("");
  const [nilaiKgTeks, setNilaiKgTeks] = useState("");
  const [alasan, setAlasan] = useState("");
  const [sedangKirim, setSedangKirim] = useState(false);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);

  // Bentuk opsi target koreksi
  const opsi: Array<{ kunci: string; jenis: TargetKoreksi; id: string; label: string }> = [
    ...wadah.map((w) => ({
      kunci: `WADAH:${w.id}`,
      jenis: "WADAH" as TargetKoreksi,
      id: w.id,
      label: `${TEKS.K1_DICATAT} — ${w.aliran}`,
    })),
    ...rincian.map((r) => ({
      kunci: `RINCIAN_DITERIMA:${r.id}`,
      jenis: "RINCIAN_DITERIMA" as TargetKoreksi,
      id: r.id,
      label: `${TEKS.KOL_BERAT_DITERIMA} — ${r.aliran}`,
    })),
    ...rincian.map((r) => ({
      kunci: `RINCIAN_DITOLAK:${r.id}`,
      jenis: "RINCIAN_DITOLAK" as TargetKoreksi,
      id: r.id,
      label: `${TEKS.KOL_BERAT_DITOLAK} — ${r.aliran}`,
    })),
  ];

  const targetTerpilih = opsi.find((o) => o.kunci === targetPilihan) ?? opsi[0];
  const beratUsulanG = parseBeratKgKeGram(nilaiKgTeks);
  const valid = Boolean(targetTerpilih) && beratUsulanG !== null && alasan.trim().length >= 3;

  async function handleKirim() {
    if (!targetTerpilih || beratUsulanG === null || !valid) return;
    setSedangKirim(true);
    setPesanGalat(null);

    const res = await panggil("POST", "/api/permintaan-koreksi", {
      body: {
        targetJenis: targetTerpilih.jenis,
        targetId: targetTerpilih.id,
        nilaiUsulanG: beratUsulanG,
        alasan: alasan.trim(),
      },
    });

    setSedangKirim(false);

    if (res.ok) {
      setPesanSukses(isi("PKR_DIAJUKAN", { kode: res.data.kode }));
      setNilaiKgTeks("");
      setAlasan("");
      setTimeout(() => {
        setTerbuka(false);
        setPesanSukses(null);
        onSelesai?.();
      }, 1500);
    } else {
      setPesanGalat(res.pesan);
    }
  }

  function handleBuka() {
    setTerbuka(true);
    setPesanSukses(null);
    setPesanGalat(null);
    if (!targetPilihan && opsi[0]) {
      setTargetPilihan(opsi[0].kunci);
    }
  }

  return (
    <>
      <Tombol varian="sekunder" onClick={handleBuka}>
        {TEKS.PKR_AJUKAN}
      </Tombol>

      {terbuka ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-koreksi-judul"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-kartu border-2 border-garis bg-kertas p-6 shadow-xl">
            <h2 id="dialog-koreksi-judul" className="text-xl font-bold text-tinta">
              {TEKS.PKR_AJUKAN}
            </h2>
            <p className="text-sm text-tinta-redup">
              {TEKS.PKR_PETUNJUK}
            </p>

            {pesanSukses ? (
              <p role="status" className="rounded-kontrol bg-status-sukses/10 p-3 text-sm font-semibold text-status-sukses">
                {pesanSukses}
              </p>
            ) : null}

            {pesanGalat ? (
              <p role="alert" className="rounded-kontrol bg-status-bahaya/10 p-3 text-sm font-semibold text-status-bahaya">
                {pesanGalat}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <label htmlFor="koreksi-target" className="text-sm font-semibold text-tinta">
                {TEKS.KOL_STATUS}
              </label>
              <Pilih
                id="koreksi-target"
                value={targetPilihan || (opsi[0]?.kunci ?? "")}
                onChange={(e) => setTargetPilihan(e.target.value)}
              >
                {opsi.map((o) => (
                  <option key={o.kunci} value={o.kunci}>
                    {o.label}
                  </option>
                ))}
              </Pilih>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="koreksi-nilai-usulan" className="text-sm font-semibold text-tinta">
                {TEKS.PKR_NILAI_USULAN}
              </label>
              <input
                id="koreksi-nilai-usulan"
                type="text"
                inputMode="decimal"
                value={nilaiKgTeks}
                onChange={(e) => setNilaiKgTeks(e.target.value)}
                placeholder="42,5"
                className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="koreksi-alasan" className="text-sm font-semibold text-tinta">
                {TEKS.UMUM_ALASAN}
              </label>
              <textarea
                id="koreksi-alasan"
                rows={3}
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                className="rounded-kontrol border border-garis bg-kertas p-3 text-base text-tinta"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Tombol varian="sekunder" onClick={() => setTerbuka(false)} disabled={sedangKirim}>
                {TEKS.UMUM_BATAL}
              </Tombol>
              <Tombol onClick={() => void handleKirim()} disabled={!valid || sedangKirim}>
                {TEKS.UMUM_KIRIM}
              </Tombol>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
