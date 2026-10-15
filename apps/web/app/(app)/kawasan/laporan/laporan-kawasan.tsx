"use client";

import { useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Tab } from "@serah/ui";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";
import { PilihPeriode } from "@/lib/klien/komponen/pilih-periode";
import { TabelLaporan } from "@/lib/klien/komponen/tabel-laporan";
import { TombolBerhak } from "@/lib/klien/komponen/tombol-berhak";
import { periodeSekarangWib } from "@/lib/klien/periode";
import { unduhBerkas } from "@/lib/klien/unduh";

type TabLaporan = "kawasan" | "pengangkut" | "penerima";

/** K4 (§L.3): tiga tab dari satu rute laporan — totalnya selalu sama — + ekspor + Lembar Neraca. */
export function LaporanKawasan() {
  const [periode, setPeriode] = useState(periodeSekarangWib);
  const [aktif, setAktif] = useState<TabLaporan>("kawasan");
  const [pesan, setPesan] = useState<string | null>(null);
  const { kawasan, galat } = useKawasanSaya();

  async function unduhLembar() {
    if (!kawasan) return;
    setPesan(null);
    const h = await unduhBerkas("/api/kawasan/[id]/lembar-neraca", {
      params: { id: kawasan.id },
      kueri: { periode },
      namaCadangan: `lembar-neraca-${periode}.pdf`,
    });
    if (!h.ok) setPesan(h.pesan);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.K4_JUDUL}</h1>
          <p className="text-sm font-medium text-tinta-redup">{TEKS.K4_PENJELASAN}</p>
        </div>
      </div>

      {galat ? <BannerGalat pesan={galat} /> : null}

      <div className="max-w-xs">
        <PilihPeriode nilai={periode} onUbah={setPeriode} />
      </div>

      <Tab
        aktif={aktif}
        onPilih={(k) => setAktif(k as TabLaporan)}
        item={[
          { kunci: "kawasan", judul: TEKS.LAPORAN_KAWASAN, isi: <TabelLaporan pihak="kawasan" periode={periode} /> },
          { kunci: "pengangkut", judul: TEKS.LAPORAN_PENGANGKUT, isi: <TabelLaporan pihak="pengangkut" periode={periode} /> },
          { kunci: "penerima", judul: TEKS.LAPORAN_PENERIMA, isi: <TabelLaporan pihak="penerima" periode={periode} /> },
        ]}
      />

      <section
        className="flex flex-col gap-3 rounded-kartu border border-garis-halus border-l-4 border-l-aksi bg-kertas p-5 shadow-xs"
        aria-labelledby="lembar"
      >
        <div className="flex flex-col gap-1">
          <h2 id="lembar" className="text-lg font-bold tracking-tight text-tinta">
            {TEKS.LEMBAR_NERACA}
          </h2>
          <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.LEMBAR_NERACA_PENJELASAN}</p>
        </div>
        <div className="pt-1">
          <TombolBerhak kunci="lembar_neraca" onLanjut={() => void unduhLembar()}>
            {TEKS.UMUM_UNDUH}
          </TombolBerhak>
        </div>
        {pesan ? <BannerGalat pesan={pesan} /> : null}
      </section>
    </div>
  );
}
