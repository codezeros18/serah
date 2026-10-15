"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Kendaraan } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Dialog, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";

export default function HalamanKendaraan() {
  const [daftarKendaraan, setDaftarKendaraan] = useState<Kendaraan[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [plat, setPlat] = useState("");
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const muat = useCallback(async () => {
    setSedangMuat(true);
    setGalat(null);
    const r = await panggil("GET", "/api/kendaraan", {});
    setSedangMuat(false);
    if (r.ok) {
      setDaftarKendaraan(r.data.kendaraan);
    } else {
      setGalat(r.pesan);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function tanganiTambah(e: FormEvent) {
    e.preventDefault();
    setSedangSimpan(true);
    setGalat(null);

    const res = await panggil("POST", "/api/kendaraan", {
      body: { plat: plat.trim().toUpperCase() },
    });

    setSedangSimpan(false);

    if (res.ok) {
      setTambahTerbuka(false);
      setPlat("");
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiNonaktif(id: string) {
    setGalat(null);
    const res = await panggil("POST", "/api/kendaraan/[id]/nonaktif", {
      params: { id },
      body: {},
    });

    if (res.ok) {
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-black tracking-tight text-tinta">{TEKS.KND_JUDUL}</h1>
        <Tombol
          onClick={() => setTambahTerbuka(true)}
          className="min-h-12 bg-aksi text-aksi-teks hover:bg-aksi-hover font-bold px-5 active:scale-[0.98] transition-all shadow-sm"
        >
          {TEKS.KND_TAMBAH}
        </Tombol>
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {daftarKendaraan.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between gap-4 rounded-kartu border-2 border-garis-halus bg-kertas p-4 sm:p-5 shadow-xs transition-colors hover:border-garis"
          >
            <div className="flex flex-col gap-2">
              <div className="inline-flex w-fit items-center rounded-kontrol border-2 border-garis bg-latar px-3.5 py-1.5 shadow-inner">
                <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-tinta">{k.plat}</span>
              </div>
              <div>
                {k.aktif ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-status-selesai bg-status-selesai-latar px-3 py-0.5 text-xs font-bold text-status-selesai">
                    <span className="h-2 w-2 rounded-full bg-status-selesai" />
                    {TEKS.LGN_STATUS_AKTIF}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-garis bg-latar px-3 py-0.5 text-xs font-bold text-tinta-redup">
                    <span className="h-2 w-2 rounded-full bg-garis" />
                    {TEKS.KND_NONAKTIF}
                  </span>
                )}
              </div>
            </div>
            {k.aktif ? (
              <Tombol
                varian="sekunder"
                className="min-h-12 border-2 border-garis font-bold hover:bg-latar active:scale-[0.98] transition-all text-sm shrink-0"
                onClick={() => tanganiNonaktif(k.id)}
              >
                {TEKS.KND_NONAKTIF}
              </Tombol>
            ) : null}
          </div>
        ))}
      </div>

      <Dialog
        terbuka={tambahTerbuka}
        judul={TEKS.KND_TAMBAH}
        onTutup={() => setTambahTerbuka(false)}
      >
        <form onSubmit={tanganiTambah} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-base font-bold text-tinta">
            {TEKS.KND_PLAT}
            <input
              type="text"
              required
              placeholder="B 1234 ABC"
              value={plat}
              onChange={(e) => setPlat(e.target.value)}
              className="min-h-14 rounded-kontrol border-2 border-garis bg-kertas px-4 font-mono text-xl sm:text-2xl font-bold uppercase tracking-wider text-tinta focus:border-aksi focus:ring-2 focus:ring-aksi/20"
            />
          </label>

          <div className="mt-3 flex justify-end gap-3">
            <Tombol
              varian="sekunder"
              className="min-h-12 border-2 border-garis font-bold active:scale-[0.98] transition-all"
              onClick={() => setTambahTerbuka(false)}
              disabled={sedangSimpan}
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol
              type="submit"
              className="min-h-12 bg-aksi text-aksi-teks hover:bg-aksi-hover font-bold active:scale-[0.98] transition-all shadow-sm"
              disabled={sedangSimpan}
            >
              {TEKS.UMUM_SIMPAN}
            </Tombol>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
