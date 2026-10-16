"use client";

import { useState } from "react";
import type { PihakLaporan } from "@serah/kontrak/enum";
import type { KunciTeks } from "@serah/kontrak/teks";
import { TEKS } from "@serah/kontrak/teks";
import { periodeSekarangWib } from "../periode";
import { PilihPeriode } from "./pilih-periode";
import { TabelLaporan } from "./tabel-laporan";

/** Laporan satu pihak (P2 penerima, laporan pengangkut): judul + periode + tabel + total + ekspor. */
export function LaporanSatuPihak({ pihak, judul }: { pihak: PihakLaporan; judul: KunciTeks }) {
  const [periode, setPeriode] = useState(periodeSekarangWib);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS[judul]}</h1>
      <PilihPeriode nilai={periode} onUbah={setPeriode} />
      <TabelLaporan pihak={pihak} periode={periode} />
    </div>
  );
}
