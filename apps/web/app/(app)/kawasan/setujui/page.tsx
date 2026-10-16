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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/kawasan"
            className="inline-flex min-h-10 items-center justify-center rounded-kontrol border border-garis-halus bg-kertas px-3 text-sm font-semibold text-tinta transition-colors hover:bg-latar active:scale-[0.98]"
          >
            ← {TEKS.UMUM_KEMBALI}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.K1_MENUNGGU_SETUJU}</h1>
        </div>
        {keadaan.status === "siap" && keadaan.data.serah.length > 0 ? (
          <span className="inline-flex items-center rounded-full border border-status-menunggu/30 bg-status-menunggu-latar px-3 py-0.5 text-sm font-bold tabular-nums text-status-menunggu">
            {keadaan.data.serah.length}
          </span>
        ) : null}
      </div>

      {keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}
      {keadaan.status === "siap" && keadaan.data.serah.length === 0 ? <Kosong teks={TEKS.K_KOSONG_AMBIL} /> : null}
      {keadaan.status === "siap" ? (
        <div className="flex flex-col gap-3">
          {keadaan.data.serah.map((s) => (
            <Link key={s.kode} href={`/kawasan/setujui/${s.kode}`} className="group block">
              <Kartu className="flex flex-col gap-3 transition-all duration-150 group-hover:border-aksi group-hover:shadow-md active:scale-[0.99]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-tinta group-hover:text-aksi transition-colors">
                      {isi("K2_JUDUL", { kode_serah: s.kode })}
                    </p>
                    <p className="text-sm font-medium text-tinta-redup">{s.tps.nama}</p>
                  </div>
                  <span className="inline-flex items-center text-sm font-semibold text-aksi group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-garis-halus/60 pt-2">
                  <LencanaStatus status={s.status} />
                  {s.aliran.map((a) => (
                    <LencanaAliran key={a} aliran={a} pendek />
                  ))}
                </div>
              </Kartu>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
