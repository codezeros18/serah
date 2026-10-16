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
  const [kodeKetik, setKodeKetik] = useState("");

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
        <div className="flex flex-col gap-3 rounded-kartu border-2 border-aksi bg-kertas p-4 shadow-md">
          <PemindaiQr petunjuk={TEKS.T1_PINDAI_PETUNJUK} onHasil={(teks) => void tangani(teks)} />
          <Tombol
            varian="sekunder"
            className="min-h-12 w-full border-2 border-garis font-bold active:scale-[0.98] transition-all"
            onClick={() => setMemindai(false)}
          >
            {TEKS.UMUM_BATAL}
          </Tombol>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-kartu border-2 border-dashed border-aksi bg-aksi-latar/40 p-6 text-center shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-aksi-garis bg-aksi-latar text-aksi shadow-inner">
            <svg
              className="h-8 w-8 text-aksi"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2m-10 0H5a2 2 0 01-2-2v-2M9 9h6v6H9V9z"
              />
            </svg>
          </div>
          <p className="max-w-xs text-sm font-semibold text-tinta-redup">
            {TEKS.T1_PINDAI_PETUNJUK}
          </p>
          <Tombol
            className="min-h-14 w-full text-lg font-bold shadow-md active:scale-[0.98] transition-all"
            onClick={() => setMemindai(true)}
          >
            {TEKS.T1_PINDAI}
          </Tombol>
          <form
            className="flex w-full flex-col gap-2 border-t border-garis-halus pt-4 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              void tangani(kodeKetik);
            }}
          >
            <label htmlFor="ketik-qr" className="text-sm font-semibold text-tinta">
              {TEKS.T1_KETIK_QR}
            </label>
            <input
              id="ketik-qr"
              type="text"
              autoComplete="off"
              value={kodeKetik}
              onChange={(e) => setKodeKetik(e.target.value)}
              placeholder={TEKS.T1_KETIK_QR_PLACEHOLDER}
              className="h-12 w-full rounded-kontrol border-2 border-garis bg-white px-3 font-mono text-base"
            />
            <Tombol type="submit" varian="sekunder" className="min-h-12 w-full font-bold" disabled={sibuk || kodeKetik.trim() === ""}>
              {TEKS.T1_KETIK_QR_LANJUT}
            </Tombol>
          </form>
        </div>
      )}
    </div>
  );
}
