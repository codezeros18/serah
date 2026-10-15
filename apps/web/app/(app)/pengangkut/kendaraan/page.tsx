"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Kendaraan } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Dialog, Kartu, Tombol } from "@serah/ui";
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
        <h1 className="text-2xl font-bold">{TEKS.KND_JUDUL}</h1>
        <Tombol onClick={() => setTambahTerbuka(true)}>{TEKS.KND_TAMBAH}</Tombol>
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {daftarKendaraan.map((k) => (
          <Kartu key={k.id} className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xl font-bold">{k.plat}</span>
              <span className="text-xs text-tinta-redup">
                {k.aktif ? TEKS.LGN_STATUS_AKTIF : TEKS.KND_NONAKTIF}
              </span>
            </div>
            {k.aktif ? (
              <Tombol
                varian="sekunder"
                className="text-sm"
                onClick={() => tanganiNonaktif(k.id)}
              >
                {TEKS.KND_NONAKTIF}
              </Tombol>
            ) : null}
          </Kartu>
        ))}
      </div>

      <Dialog
        terbuka={tambahTerbuka}
        judul={TEKS.KND_TAMBAH}
        onTutup={() => setTambahTerbuka(false)}
      >
        <form onSubmit={tanganiTambah} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {TEKS.KND_PLAT}
            <input
              type="text"
              required
              placeholder="B 1234 ABC"
              value={plat}
              onChange={(e) => setPlat(e.target.value)}
              className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 font-mono text-base uppercase text-tinta"
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <Tombol
              varian="sekunder"
              onClick={() => setTambahTerbuka(false)}
              disabled={sedangSimpan}
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol type="submit" disabled={sedangSimpan}>
              {TEKS.UMUM_SIMPAN}
            </Tombol>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
