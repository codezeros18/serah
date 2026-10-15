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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.P1_JUDUL}</h1>
      <Tombol onClick={() => setPindai((v) => !v)}>{TEKS.P1_PINDAI}</Tombol>
      {pindai ? <PemindaiQr petunjuk={TEKS.P1_PINDAI} onHasil={hasilPindai} /> : null}
      {galat ? <BannerGalat pesan={galat} /> : null}

      {masuk.keadaan.status === "memuat" ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {masuk.keadaan.status === "galat" ? <BannerGalat pesan={masuk.keadaan.pesan} onCoba={() => void masuk.ulang()} /> : null}
      {masuk.keadaan.status === "siap" && masuk.keadaan.data.serah.length === 0 ? <Kosong teks={TEKS.K_KOSONG_MASUK} /> : null}
      {masuk.keadaan.status === "siap"
        ? masuk.keadaan.data.serah.map((s) => (
            <Link key={s.kode} href={`/penerima/serah/${s.kode}`} className="block">
              <Kartu className="flex flex-col gap-2" data-kode={s.kode}>
                <p className="text-lg font-bold">{isi("P1_TUTUP_JUDUL", { kode_serah: s.kode })}</p>
                <p className="text-sm text-tinta-redup">{isi("P1_MUATAN", { nama_kawasan: s.kawasan.nama })}</p>
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
