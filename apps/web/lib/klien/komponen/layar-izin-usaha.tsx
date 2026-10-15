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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.IZN_JUDUL}</h1>
      <p className="text-base text-tinta-redup">{TEKS.IZN_PENJELASAN}</p>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {memuat && !organisasi ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {pesanSukses ? (
        <p role="status" className="rounded-kontrol bg-status-sukses/10 p-3 text-sm font-semibold text-status-sukses">
          {pesanSukses}
        </p>
      ) : null}

      {organisasi ? (
        <>
          <Kartu className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-tinta-redup">{TEKS.KOL_STATUS}</h2>
            <div className="flex items-center gap-2">
              <span
                data-testid="status-izin"
                className="rounded-kontrol border border-garis bg-latar px-3 py-1 text-sm font-bold text-tinta"
              >
                {TEKS_STATUS_IZIN[organisasi.statusIzin]}
              </span>
            </div>
            {organisasi.nomorIzin ? (
              <p className="text-sm">
                <span className="font-semibold">{`${TEKS.IZN_NOMOR}: `}</span>
                <span className="font-mono">{organisasi.nomorIzin}</span>
              </p>
            ) : null}
          </Kartu>

          <Kartu className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">{TEKS.IZN_AJUKAN}</h2>

            <div className="flex flex-col gap-2">
              <label htmlFor="izin-nomor" className="text-sm font-semibold text-tinta">
                {TEKS.IZN_NOMOR}
              </label>
              <input
                id="izin-nomor"
                type="text"
                value={nomorIzin}
                onChange={(e) => setNomorIzin(e.target.value)}
                placeholder="503/xxx/2026"
                className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="izin-dokumen" className="text-sm font-semibold text-tinta">
                {TEKS.IZN_DOKUMEN}
              </label>
              <input
                id="izin-dokumen"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => void handlePilihBerkas(e)}
                className="min-h-12 text-sm text-tinta"
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
