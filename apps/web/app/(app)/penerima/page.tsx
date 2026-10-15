"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Kosong, LencanaAliran, LencanaStatus, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { PemindaiQr } from "@/lib/klien/komponen/pemindai-qr";
import { useMuat } from "@/lib/klien/muat";

const POLA_KODE_SERAH = /^SRH-\d{8}-\d{4}$/;

/** P1 — daftar serah yang menuju penerima; pindai QR serah membuka layar tutup. */
export default function LayarP1() {
  const router = useRouter();
  const [pindai, setPindai] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const masuk = useMuat(async () => {
    const [angkut, gantung] = await Promise.all([
      panggil("GET", "/api/serah", { kueri: { status: "DIANGKUT" } }),
      panggil("GET", "/api/serah", { kueri: { status: "MENGGANTUNG" } }),
    ]);
    if (!angkut.ok) return angkut;
    if (!gantung.ok) return gantung;
    return { ok: true as const, data: { serah: [...gantung.data.serah, ...angkut.data.serah] } };
  }, 30_000);

  const hasilPindai = useCallback(
    (teks: string) => {
      const kode = teks.trim();
      if (POLA_KODE_SERAH.test(kode)) router.push(`/penerima/serah/${kode}`);
      else setGalat(TEKS.G_QR_TIDAK_DIKENAL);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.P1_JUDUL}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Tombol onClick={() => setPindai((v) => !v)} className="min-h-10 text-sm">
            {TEKS.P1_PINDAI}
          </Tombol>
        </div>
      </div>

      {pindai ? (
        <div className="overflow-hidden rounded-kartu border border-garis-halus bg-kertas p-4 shadow-sm">
          <PemindaiQr petunjuk={TEKS.P1_PINDAI} onHasil={hasilPindai} />
        </div>
      ) : null}

      {galat ? <BannerGalat pesan={galat} /> : null}

      {masuk.keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {masuk.keadaan.status === "galat" ? <BannerGalat pesan={masuk.keadaan.pesan} onCoba={() => void masuk.ulang()} /> : null}
      {masuk.keadaan.status === "siap" && masuk.keadaan.data.serah.length === 0 ? <Kosong teks={TEKS.K_KOSONG_MASUK} /> : null}
      {masuk.keadaan.status === "siap" ? (
        <div className="flex flex-col gap-3">
          {masuk.keadaan.data.serah.map((s) => (
            <Link key={s.kode} href={`/penerima/serah/${s.kode}`} className="group block">
              <Kartu
                className={`flex flex-col gap-3 transition-all duration-150 group-hover:border-aksi group-hover:shadow-md active:scale-[0.99] ${
                  s.status === "MENGGANTUNG"
                    ? "border-l-4 border-l-status-menunggu bg-status-menunggu-latar/15"
                    : "border-l-4 border-l-status-angkut bg-aksi-latar/15"
                }`}
                data-kode={s.kode}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-tinta transition-colors group-hover:text-aksi">
                      {isi("P1_TUTUP_JUDUL", { kode_serah: s.kode })}
                    </p>
                    <p className="text-sm font-medium text-tinta-redup">
                      {isi("P1_MUATAN", { nama_kawasan: s.kawasan.nama })}
                    </p>
                  </div>
                  <span className="inline-flex items-center text-sm font-semibold text-aksi transition-transform group-hover:translate-x-0.5">
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
