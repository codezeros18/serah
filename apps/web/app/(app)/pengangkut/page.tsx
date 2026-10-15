"use client";

import Link from "next/link";
import { TEKS, isi } from "@serah/kontrak/teks";
import { AtribusiBMKG, BannerGalat, Kartu, Kosong, LencanaAliran, PanelAturan } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { useMuat } from "@/lib/klien/muat";

const SELANG_MUAT_MS = 30_000;

/** A1 — daftar serah yang menunggu diambil, prioritas angkut di atas. */
export default function LayarA1() {
  const { keadaan, ulang } = useMuat(() => panggil("GET", "/api/ambil"), SELANG_MUAT_MS);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.A1_JUDUL}</h1>
      <p className="text-sm text-tinta-redup">{TEKS.A1_URUTAN}</p>

      {keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {keadaan.status === "galat" ? <BannerGalat pesan={keadaan.pesan} onCoba={() => void ulang()} /> : null}
      {keadaan.status === "siap" && keadaan.data.serah.length === 0 ? <Kosong teks={TEKS.K_KOSONG_AMBIL} /> : null}

      {keadaan.status === "siap"
        ? [...keadaan.data.serah]
            // Prioritas angkut dulu, lalu wadah yang paling lama menunggu (A1_URUTAN).
            .sort((a, b) => Number(Boolean(b.prioritas)) - Number(Boolean(a.prioritas)) || b.umurJamTertua - a.umurJamTertua)
            .map((s) => (
              <Kartu key={s.kode} className="flex flex-col gap-3" data-kode={s.kode}>
                <div>
                  <p className="text-lg font-bold">{s.tps.nama}</p>
                  <p className="text-sm text-tinta-redup">
                    {s.tps.kode} · {s.kawasan.nama}
                  </p>
                  <p className="text-sm text-tinta-redup">{s.kode}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.aliran.map((a) => (
                    <LencanaAliran key={a} aliran={a} pendek />
                  ))}
                </div>
                <p className="text-base">{isi("A1_KARTU_UMUR", { jam: s.umurJamTertua })}</p>
                {s.prioritas ? (
                  <div className="flex flex-col gap-2" data-prioritas={s.prioritas.sumber}>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-peringatan-garis bg-peringatan-latar px-3 py-1 text-base font-semibold text-peringatan">
                      <span aria-hidden="true">▲</span>
                      {TEKS.STATUS_PRIORITAS_ANGKUT}
                    </span>
                    <PanelAturan aksi="PRIORITAS" kode="R10" teks={s.prioritas.teks} />
                    <AtribusiBMKG />
                  </div>
                ) : null}
                <Link
                  href={`/pengangkut/serah/${s.kode}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-kontrol bg-aksi px-5 text-base font-semibold text-aksi-teks"
                >
                  {TEKS.A1_AMBIL}
                </Link>
              </Kartu>
            ))
        : null}
    </div>
  );
}
