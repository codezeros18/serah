"use client";

import Link from "next/link";
import { TEKS, isi } from "@serah/kontrak/teks";
import { AtribusiBMKG, BannerGalat, Kosong, LencanaAliran, PanelAturan } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { useMuat } from "@/lib/klien/muat";

const SELANG_MUAT_MS = 30_000;

/** A1 — daftar serah yang menunggu diambil, prioritas angkut di atas. */
export default function LayarA1() {
  const { keadaan, ulang } = useMuat(() => panggil("GET", "/api/ambil"), SELANG_MUAT_MS);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-black tracking-tight text-tinta">{TEKS.A1_JUDUL}</h1>
        <p className="w-fit rounded-kontrol border border-garis-halus bg-latar px-3 py-1.5 text-xs sm:text-sm font-semibold text-tinta-redup">
          {TEKS.A1_URUTAN}
        </p>
      </div>

      {keadaan.status === "memuat" ? (
        <p role="status" className="p-4 text-base font-semibold text-tinta-redup">
          {TEKS.UMUM_MUAT}
        </p>
      ) : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}
      {keadaan.status === "siap" && keadaan.data.serah.length === 0 ? <Kosong teks={TEKS.K_KOSONG_AMBIL} /> : null}

      {keadaan.status === "siap"
        ? [...keadaan.data.serah]
            // Prioritas angkut dulu, lalu wadah yang paling lama menunggu (A1_URUTAN).
            .sort((a, b) => Number(Boolean(b.prioritas)) - Number(Boolean(a.prioritas)) || b.umurJamTertua - a.umurJamTertua)
            .map((s) => (
              <div
                key={s.kode}
                className={`flex flex-col gap-4 rounded-kartu border-2 p-5 shadow-sm transition-all duration-150 ${
                  s.prioritas
                    ? "border-peringatan-garis bg-peringatan-latar/30 shadow-md ring-2 ring-peringatan-garis/20"
                    : "border-garis bg-kertas hover:border-aksi-garis"
                }`}
                data-kode={s.kode}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-black tracking-tight text-tinta">{s.tps.nama}</p>
                    <p className="text-sm font-semibold text-tinta-redup">
                      {s.tps.kode} · {s.kawasan.nama}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-kontrol border border-garis bg-latar px-3 py-1 font-mono text-sm sm:text-base font-bold text-tinta">
                    {s.kode}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {s.aliran.map((a) => (
                    <LencanaAliran key={a} aliran={a} pendek />
                  ))}
                </div>

                <div className="flex items-center gap-2 text-base font-bold tabular-nums text-tinta">
                  <span aria-hidden="true" className="text-lg text-tinta-redup">
                    ⏱
                  </span>
                  <p>{isi("A1_KARTU_UMUR", { jam: s.umurJamTertua })}</p>
                </div>

                {s.prioritas ? (
                  <div className="flex flex-col gap-2.5 rounded-kartu border-2 border-peringatan-garis bg-peringatan-latar p-3.5" data-prioritas={s.prioritas.sumber}>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-peringatan-garis bg-peringatan-latar px-3.5 py-1 text-base font-black text-peringatan">
                      <span aria-hidden="true">▲</span>
                      {TEKS.STATUS_PRIORITAS_ANGKUT}
                    </span>
                    <PanelAturan aksi="PRIORITAS" kode="R10" teks={s.prioritas.teks} />
                    <AtribusiBMKG />
                  </div>
                ) : null}

                <Link
                  href={`/pengangkut/serah/${s.kode}`}
                  className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-kontrol bg-aksi px-5 text-lg font-bold text-aksi-teks shadow-md transition-all duration-150 hover:bg-aksi-hover active:scale-[0.98]"
                >
                  <span>{TEKS.A1_AMBIL}</span>
                  <span aria-hidden="true" className="text-xl font-black">
                    →
                  </span>
                </Link>
              </div>
            ))
        : null}
    </div>
  );
}
