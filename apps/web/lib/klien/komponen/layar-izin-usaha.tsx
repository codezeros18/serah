"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import type { Organisasi } from "@serah/kontrak";
import type { StatusIzin } from "@serah/kontrak/enum";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { unggahFoto } from "@/lib/klien/foto";

const TEKS_STATUS_IZIN: Record<StatusIzin, string> = {
  BELUM_DIAJUKAN: TEKS.IZIN_BELUM_DIAJUKAN,
  MENUNGGU: TEKS.IZIN_MENUNGGU,
  TERVERIFIKASI: TEKS.IZIN_TERVERIFIKASI,
  DITOLAK: TEKS.IZIN_DITOLAK,
};

export function LayarIzinUsaha() {
  const [organisasi, setOrganisasi] = useState<Organisasi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  const [nomorIzin, setNomorIzin] = useState("");
  const [fotoDokumenId, setFotoDokumenId] = useState<string | undefined>(undefined);
  const [namaBerkas, setNamaBerkas] = useState<string | null>(null);
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [sedangKirim, setSedangKirim] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    const res = await panggil("GET", "/api/organisasi/saya");
    setMemuat(false);
    if (res.ok) {
      setOrganisasi(res.data.organisasi);
      if (res.data.organisasi.nomorIzin) {
        setNomorIzin(res.data.organisasi.nomorIzin);
      }
    } else {
      setGalat(res.pesan);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function handlePilihBerkas(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNamaBerkas(file.name);
    setSedangUnggah(true);
    setGalat(null);

    const hasil = await unggahFoto(file, "DOKUMEN_IZIN");
    setSedangUnggah(false);
    if (hasil.ok) {
      setFotoDokumenId(hasil.fotoId);
    } else {
      setGalat(hasil.pesan);
    }
  }

  async function handleAjukan() {
    if (nomorIzin.trim().length < 3) return;
    setSedangKirim(true);
    setGalat(null);
    setPesanSukses(null);

    const res = await panggil("POST", "/api/organisasi/izin", {
      body: {
        nomorIzin: nomorIzin.trim(),
        ...(fotoDokumenId ? { fotoDokumenId } : {}),
      },
    });

    setSedangKirim(false);
    if (res.ok) {
      setPesanSukses(TEKS.IZN_DIAJUKAN);
      if (organisasi) {
        setOrganisasi({ ...organisasi, statusIzin: "MENUNGGU", nomorIzin: nomorIzin.trim() });
      }
    } else {
      setGalat(res.pesan);
    }
  }

  const valid = nomorIzin.trim().length >= 3 && !sedangUnggah && !sedangKirim;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.IZN_JUDUL}</h1>
          <p className="text-sm font-medium text-tinta-redup">{TEKS.IZN_PENJELASAN}</p>
        </div>
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {memuat && !organisasi ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {pesanSukses ? (
        <div className="rounded-kartu border border-emerald-200 bg-emerald-50 p-4">
          <p role="status" className="text-sm font-bold text-emerald-800">
            {`✓ ${pesanSukses}`}
          </p>
        </div>
      ) : null}

      {organisasi ? (
        <>
          <Kartu className="flex flex-col gap-3 shadow-xs">
            <span className="text-xs font-semibold text-tinta-redup">{TEKS.KOL_STATUS}</span>
            <div className="flex items-center gap-2">
              <span
                data-testid="status-izin"
                className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
                  organisasi.statusIzin === "TERVERIFIKASI"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : organisasi.statusIzin === "MENUNGGU"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : organisasi.statusIzin === "DITOLAK"
                        ? "border-purple-200 bg-purple-50 text-purple-800"
                        : "border-garis-halus bg-latar text-tinta"
                }`}
              >
                {TEKS_STATUS_IZIN[organisasi.statusIzin]}
              </span>
            </div>
            {organisasi.nomorIzin ? (
              <p className="text-sm pt-1">
                <span className="font-semibold text-tinta-redup">{`${TEKS.IZN_NOMOR}: `}</span>
                <span className="font-mono font-bold text-tinta">{organisasi.nomorIzin}</span>
              </p>
            ) : null}
          </Kartu>

          <Kartu className="flex flex-col gap-4 shadow-xs">
            <h2 className="text-lg font-bold tracking-tight text-tinta">{TEKS.IZN_AJUKAN}</h2>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="izin-nomor" className="text-sm font-semibold text-tinta">
                {TEKS.IZN_NOMOR}
              </label>
              <input
                id="izin-nomor"
                type="text"
                value={nomorIzin}
                onChange={(e) => setNomorIzin(e.target.value)}
                placeholder="503/xxx/2026"
                className="min-h-12 rounded-kontrol border border-garis-halus bg-kertas px-3 text-base text-tinta transition-colors focus:border-aksi focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="izin-dokumen" className="text-sm font-semibold text-tinta">
                {TEKS.IZN_DOKUMEN}
              </label>
              <input
                id="izin-dokumen"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => void handlePilihBerkas(e)}
                className="min-h-12 text-sm text-tinta file:mr-3 file:rounded-kontrol file:border file:border-garis-halus file:bg-kertas file:px-3 file:py-1 file:text-xs file:font-semibold file:text-tinta hover:file:bg-latar"
              />
              {namaBerkas ? (
                <p className="text-xs text-tinta-redup">
                  {namaBerkas} {sedangUnggah ? `(${TEKS.UMUM_MUAT})` : ""}
                </p>
              ) : null}
            </div>

            <div className="flex justify-start pt-2">
              <Tombol onClick={() => void handleAjukan()} disabled={!valid}>
                {TEKS.IZN_AJUKAN}
              </Tombol>
            </div>
          </Kartu>
        </>
      ) : null}
    </div>
  );
}
