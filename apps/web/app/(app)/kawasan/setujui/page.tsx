"use client";

import Link from "next/link";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Kosong, LencanaAliran, LencanaStatus } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { useMuat } from "@/lib/klien/muat";

/** Daftar serah yang menunggu persetujuan pengelola (pintu masuk ke K2). */
export default function DaftarSetujui() {
  const { keadaan, ulang } = useMuat(() => panggil("GET", "/api/serah", { kueri: { status: "MENUNGGU_SETUJU" } }), 30_000);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.K1_MENUNGGU_SETUJU}</h1>
      {keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}
      {keadaan.status === "siap" && keadaan.data.serah.length === 0 ? <Kosong teks={TEKS.K_KOSONG_AMBIL} /> : null}
      {keadaan.status === "siap"
        ? keadaan.data.serah.map((s) => (
            <Link key={s.kode} href={`/kawasan/setujui/${s.kode}`} className="block">
              <Kartu className="flex flex-col gap-2">
                <p className="text-lg font-bold">{isi("K2_JUDUL", { kode_serah: s.kode })}</p>
                <p className="text-sm text-tinta-redup">{s.tps.nama}</p>
                <div className="flex flex-wrap gap-2">
                  <LencanaStatus status={s.status} />
                  {s.aliran.map((a) => (
                    <LencanaAliran key={a} aliran={a} pendek />
                  ))}
                </div>
              </Kartu>
            </Link>
          ))
        : null}
    </div>
  );
}
