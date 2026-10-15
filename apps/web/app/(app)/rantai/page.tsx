"use client";

import { useEffect, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Kosong } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import dynamic from "next/dynamic";
import { Rangka } from "@/lib/klien/komponen/rangka";

const PeriksaRantai = dynamic(() => import("@/lib/klien/komponen/periksa-rantai").then((m) => m.PeriksaRantai), {
  ssr: false,
  loading: () => <Rangka className="h-24 w-full" />,
});
import { Pilih } from "@/lib/klien/komponen/pilih";

type Pilihan = { id: string; nama: string };

/**
 * /rantai: periksa keutuhan rantai catatan per kawasan. Daftar kawasan diambil dari serah yang terlihat oleh
 * peran ini (semua peran), sehingga pengangkut dan penerima memeriksa kawasan yang mereka layani.
 */
export default function LayarRantai() {
  const [kawasan, setKawasan] = useState<Pilihan[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [dipilih, setDipilih] = useState<string>("");

  useEffect(() => {
    let batal = false;
    void panggil("GET", "/api/serah").then((h) => {
      if (batal) return;
      if (!h.ok) {
        setGalat(h.pesan);
        return;
      }
      const peta = new Map<string, Pilihan>();
      for (const s of h.data.serah) peta.set(s.kawasan.id, { id: s.kawasan.id, nama: s.kawasan.nama });
      const daftar = [...peta.values()];
      setKawasan(daftar);
      if (daftar[0]) setDipilih(daftar[0].id);
    });
    return () => {
      batal = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.RANTAI_JUDUL}</h1>
      <p className="text-base">{TEKS.RANTAI_PENJELASAN}</p>
      {galat ? <BannerGalat pesan={galat} /> : null}
      {kawasan === null && !galat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {kawasan && kawasan.length === 0 ? <Kosong teks={TEKS.K_KOSONG_BULAN} /> : null}
      {kawasan && kawasan.length > 0 ? (
        <>
          {kawasan.length > 1 ? (
            <Pilih
              aria-label={TEKS.RANTAI_JUDUL}
              value={dipilih}
              onChange={(e) => setDipilih(e.target.value)}
            >
              {kawasan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </Pilih>
          ) : (
            <p className="text-base font-semibold">{kawasan[0]?.nama}</p>
          )}
          {dipilih ? <PeriksaRantai key={dipilih} kawasanId={dipilih} /> : null}
        </>
      ) : null}
    </div>
  );
}
