"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { ekstrakTokenQr, simpanTpsTerpilih, type TpsTerpilih } from "./tps-terpilih";

const PemindaiQr = dynamic(() => import("@/lib/klien/komponen/pemindai-qr").then((m) => m.PemindaiQr), {
  ssr: false,
});

/** Pindai QR TPS → TPS terpilih. Dipakai T1 dan T2. */
export function PilihTps({ onTerpilih }: { onTerpilih: (t: TpsTerpilih) => void }) {
  const [memindai, setMemindai] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function tangani(teks: string) {
    if (sibuk) return;
    const token = ekstrakTokenQr(teks);
    if (!token) {
      setGalat(TEKS.G_QR_TIDAK_DIKENAL);
      return;
    }
    setSibuk(true);
    setGalat(null);
    const h = await panggil("GET", "/api/tps/qr/[token]", { params: { token } });
    setSibuk(false);
    if (!h.ok) {
      setGalat(h.galat.kode === "TIDAK_DITEMUKAN" ? TEKS.G_QR_TIDAK_DIKENAL : h.pesan);
      return;
    }
    performance.mark("t1-qr");
    const t: TpsTerpilih = { id: h.data.tps.id, kode: h.data.tps.kode, nama: h.data.tps.nama, namaKawasan: h.data.kawasan.nama };
    simpanTpsTerpilih(t);
    setMemindai(false);
    onTerpilih(t);
  }

  return (
    <div className="flex flex-col gap-3">
      {galat ? <BannerGalat pesan={galat} /> : null}
      {memindai ? (
        <PemindaiQr petunjuk={TEKS.T1_PINDAI_PETUNJUK} onHasil={(teks) => void tangani(teks)} />
      ) : (
        <Tombol onClick={() => setMemindai(true)}>{TEKS.T1_PINDAI}</Tombol>
      )}
    </div>
  );
}
