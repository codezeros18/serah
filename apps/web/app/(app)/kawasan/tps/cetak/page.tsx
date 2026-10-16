"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { Tps } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";
import { GambarAman } from "@/lib/klien/komponen/gambar-aman";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";
import { Rangka } from "@/lib/klien/komponen/rangka";

const kelasTombolIkon =
  "flex h-11 w-11 items-center justify-center rounded-full border border-garis-halus bg-white text-tinta shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi active:scale-95 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-tinta";

function Panah({ arah }: { arah: "kiri" | "kanan" }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d={arah === "kiri" ? "m14.500 6-6 6 6 6" : "m9.500 6 6 6-6 6"} stroke="currentColor" strokeWidth="2.100" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Satu lembar poster QR: fokus pada kode, dicetak satu per halaman. */
function Poster({ tps, kawasanNama }: { tps: Tps; kawasanNama: string | null }) {
  return (
    <article
      aria-label={`${tps.nama} - ${tps.kode}`}
      className="mx-auto flex w-full max-w-[26rem] flex-col items-center gap-6 rounded-[2rem] border border-garis-halus bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.10)] print:max-w-none print:break-after-page print:rounded-none print:border-0 print:p-12 print:shadow-none"
    >
      <LogoSerah ukuran="md" />

      <p className="text-sm text-tinta-redup print:text-base">{TEKS.CETAK_AJAK}</p>

      <div className="rounded-3xl bg-white p-3 ring-1 ring-garis-halus print:ring-0">
        <GambarAman
          src={`/api/tps/${tps.id}/qr?format=svg&v=${tps.qrVersi}`}
          alt={`${tps.nama} - ${tps.kode}`}
          teksKosong={TEKS.QR_TPS_TIDAK_ADA}
          ikon="tps"
          className="h-72 w-72 print:h-[28rem] print:w-[28rem]"
          kelasKosong="h-72 w-72"
        />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight text-tinta print:text-4xl">{tps.nama}</h2>
        <p className="font-mono text-base font-medium tracking-wider text-tinta-redup print:text-xl print:text-black">{tps.kode}</p>
        {kawasanNama ? <p className="text-sm text-tinta-redup print:text-base print:text-black">{kawasanNama}</p> : null}
      </div>
    </article>
  );
}

function KontenCetak() {
  const searchParams = useSearchParams();
  const tpsIdFilter = searchParams.get("id");

  const { kawasan, galat: galatKawasan } = useKawasanSaya();
  const [daftarTps, setDaftarTps] = useState<Tps[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  const muat = useCallback(async () => {
    if (!kawasan) return;
    setSedangMuat(true);
    setGalat(null);
    const r = await panggil("GET", "/api/tps", { kueri: { kawasanId: kawasan.id } });
    setSedangMuat(false);
    if (r.ok) {
      const data = tpsIdFilter ? r.data.tps.filter((t) => t.id === tpsIdFilter) : r.data.tps;
      setDaftarTps(data.filter((t) => t.aktif));
      setIdx(0);
    } else {
      setGalat(r.pesan);
    }
  }, [kawasan, tpsIdFilter]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const total = daftarTps.length;
  const maju = useCallback(() => setIdx((i) => Math.min(total - 1, i + 1)), [total]);
  const mundur = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") maju();
      else if (e.key === "ArrowLeft") mundur();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [maju, mundur]);

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-latar to-white print:min-h-0 print:bg-white">
      {/* Bilah kontrol (tidak ikut tercetak) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-garis-halus bg-white/85 px-4 py-3 backdrop-blur-xl print:hidden sm:px-6">
        <Link
          href="/kawasan/tps"
          aria-label={TEKS.UMUM_KEMBALI}
          className={kelasTombolIkon}
        >
          <Panah arah="kiri" />
        </Link>
        <h1 className="truncate text-base font-semibold tracking-tight text-tinta">{TEKS.TPS_CETAK_QR}</h1>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={total === 0}
          aria-label={TEKS.TPS_CETAK_QR}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-aksi px-4 text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all hover:-translate-y-0.5 hover:bg-aksi-hover disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M7 9V4.500h10V9M7 17H5.500A1.500 1.500 0 0 1 4 15.500v-5A1.500 1.500 0 0 1 5.500 9h13a1.500 1.500 0 0 1 1.500 1.500v5a1.500 1.500 0 0 1-1.500 1.500H17M7 14h10v6H7v-6Z" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">{TEKS.TPS_CETAK_QR}</span>
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center gap-6 px-4 py-8 print:p-0">
        {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
        {galat ? <BannerGalat pesan={galat} /> : null}
        {sedangMuat ? (
          <div role="status" className="w-full max-w-[26rem]">
            <span className="sr-only">{TEKS.UMUM_MUAT}</span>
            <Rangka className="h-[34rem] w-full rounded-[2rem]" />
          </div>
        ) : null}

        {/* Satu poster pada layar (geser dengan panah); semua poster tercetak berurutan */}
        {daftarTps.map((tps, i) => (
          <div key={tps.id} className={`w-full ${i === idx ? "block" : "hidden print:block"}`}>
            <Poster tps={tps} kawasanNama={kawasan?.nama ?? null} />
          </div>
        ))}

        {total > 1 ? (
          <nav aria-label={TEKS.TPS_CETAK_QR} className="flex items-center gap-4 print:hidden">
            <button type="button" onClick={mundur} disabled={idx === 0} aria-label={TEKS.UMUM_KEMBALI} className={kelasTombolIkon}>
              <Panah arah="kiri" />
            </button>
            <div className="flex items-center gap-1.5">
              {daftarTps.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={t.kode}
                  aria-current={i === idx}
                  onClick={() => setIdx(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === idx ? "w-6 bg-aksi" : "w-2 bg-garis hover:bg-aksi-garis"}`}
                />
              ))}
            </div>
            <span className="min-w-12 text-center font-mono text-sm tabular-nums text-tinta-redup">
              {idx + 1} / {total}
            </span>
            <button type="button" onClick={maju} disabled={idx === total - 1} aria-label={TEKS.UMUM_LANJUT} className={kelasTombolIkon}>
              <Panah arah="kanan" />
            </button>
          </nav>
        ) : null}
      </main>
    </div>
  );
}

export default function HalamanCetakTps() {
  return (
    <Suspense fallback={<p role="status">{TEKS.UMUM_MUAT}</p>}>
      <KontenCetak />
    </Suspense>
  );
}
