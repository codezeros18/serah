import Link from "next/link";
import { Kartu } from "@serah/ui";
import { TEKS, isi } from "@serah/kontrak/teks";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

const FITUR_SOROTAN = [
  {
    judul: TEKS.LANDING_L1_JUDUL,
    isi: TEKS.LANDING_L1_ISI,
    tag: "TPS & Wadah Warna",
  },
  {
    judul: TEKS.LANDING_L2_JUDUL,
    isi: TEKS.LANDING_L2_ISI,
    tag: "Penutupan & Timbang",
  },
  {
    judul: TEKS.LANDING_L3_JUDUL,
    isi: TEKS.LANDING_L3_ISI,
    tag: "Pergub DKI 102/2021",
  },
  {
    judul: TEKS.LANDING_L4_JUDUL,
    isi: TEKS.LANDING_L4_ISI,
    tag: "Umpan Balik Pemilahan",
  },
  {
    judul: TEKS.LANDING_L5_JUDUL,
    isi: TEKS.LANDING_L5_ISI,
    tag: "Integrasi BMKG",
  },
] as const;

export default function HalamanLanding() {
  return (
    <div className="flex min-h-dvh flex-col bg-latar text-tinta">
      {/* Header Navigasi Publik */}
      <header className="sticky top-0 z-30 border-b border-garis-halus bg-kertas/95 backdrop-blur px-4 py-3 sm:px-6 shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="group flex items-center gap-2" aria-label={TEKS.APP_NAMA}>
            <LogoSerah ukuran="sm" />
          </Link>
          <nav aria-label="Navigasi Utama" className="flex items-center gap-4 sm:gap-7">
            <Link
              href="/tentang"
              className="text-sm font-semibold text-tinta-redup hover:text-aksi transition-colors"
            >
              {TEKS.TENTANG_JUDUL}
            </Link>
            <Link
              href="/harga"
              className="text-sm font-semibold text-tinta-redup hover:text-aksi transition-colors"
            >
              {TEKS.HRG_JUDUL}
            </Link>
            <Link
              href="/demo"
              className="text-sm font-semibold text-tinta-redup hover:text-aksi transition-colors"
            >
              {TEKS.LANDING_CTA_DEMO}
            </Link>
            <Link
              href="/masuk"
              className="inline-flex min-h-10 items-center justify-center rounded-kontrol border border-garis bg-kertas px-4 py-2 text-sm font-bold text-tinta hover:border-aksi hover:text-aksi hover:bg-aksi-latar/40 transition-all shadow-xs"
            >
              {TEKS.MASUK_JUDUL}
            </Link>
          </nav>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1">
        {/* Bagian Hero dengan Atmospheric Accent & Visual Pipeline */}
        <section
          className="relative overflow-hidden border-b border-garis-halus px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="hero-judul"
          style={{
            background:
              "radial-gradient(120% 80% at 50% -10%, rgba(36, 87, 197, 0.16) 0%, rgba(36, 87, 197, 0.03) 55%, #f8fafc 100%)",
          }}
        >
          {/* Subtle Decorative Background Circles */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-aksi/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
            {/* SERAH Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-aksi/30 bg-aksi-latar px-4 py-1.5 text-xs font-bold text-aksi shadow-xs">
              <span className="h-2 w-2 rounded-full bg-aksi animate-pulse" aria-hidden="true" />
              <span>{TEKS.APP_NAMA} · {TEKS.APP_TAGLINE}</span>
            </div>

            {/* Headline dengan text-wrap: balance */}
            <h1
              id="hero-judul"
              className="text-4xl font-black tracking-tight text-tinta sm:text-6xl lg:text-7xl [text-wrap:balance]"
            >
              Satu serah,{" "}
              <span className="text-aksi drop-shadow-xs">tiga laporan.</span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl text-lg leading-relaxed text-tinta-redup sm:text-xl [text-wrap:balance]">
              {TEKS.APP_DESKRIPSI}
            </p>

            {/* Tombol Aksi Utama */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                href="/mulai"
                className="inline-flex min-h-12 items-center justify-center rounded-kontrol bg-aksi px-8 py-3.5 text-base font-bold text-white shadow-md shadow-aksi/25 hover:bg-aksi-hover hover:shadow-lg hover:shadow-aksi/35 hover:-translate-y-0.5 transition-all active:scale-[0.98]"
              >
                {TEKS.LANDING_CTA}
              </Link>
              <Link
                href="/demo"
                className="inline-flex min-h-12 items-center justify-center rounded-kontrol border-2 border-garis bg-kertas px-7 py-3.5 text-base font-bold text-tinta shadow-xs hover:border-aksi hover:text-aksi hover:bg-aksi-latar/40 hover:-translate-y-0.5 transition-all active:scale-[0.98]"
              >
                <span className="mr-2">▶</span> {TEKS.LANDING_CTA_DEMO}
              </Link>
              <Link
                href="/harga"
                className="inline-flex min-h-12 items-center justify-center px-5 py-3.5 text-sm font-bold text-tinta-redup hover:text-aksi hover:underline transition-colors"
              >
                {TEKS.HRG_JUDUL} →
              </Link>
            </div>

            {/* Visual Pipeline Tiga Pihak Satu Serah */}
            <div className="mt-8 w-full max-w-4xl rounded-2xl border border-garis-halus bg-kertas p-5 sm:p-7 shadow-xl shadow-slate-200/50 text-left">
              <div className="flex items-center justify-between border-b border-garis-halus pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-tinta tracking-wide uppercase">
                    Alur Verifikasi Rantai Serah
                  </span>
                </div>
                <span className="rounded-full border border-aksi/20 bg-aksi-latar px-2.5 py-0.5 text-[11px] font-black text-aksi">
                  Pergub DKI 102/2021
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Tahap 1: TPS Kawasan */}
                <div className="flex flex-col gap-3 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/20 p-4 transition-all hover:border-emerald-500 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                      1
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                      {TEKS.PERAN_PENGELOLA}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-tinta">{TEKS.K1_JUDUL}</h4>
                    <p className="text-xs text-tinta-redup mt-0.5">{TEKS.T1_PILIH_ALIRAN}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-auto pt-2">
                    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-700 text-white">
                      Hijau
                    </span>
                    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-400 text-slate-900">
                      Kuning
                    </span>
                    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-700 text-white">
                      Merah
                    </span>
                    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-600 text-white">
                      Abu
                    </span>
                  </div>
                </div>

                {/* Tahap 2: Pengangkut */}
                <div className="flex flex-col gap-3 rounded-xl border-2 border-aksi/30 bg-aksi-latar/30 p-4 transition-all hover:border-aksi hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-aksi text-xs font-black text-white">
                      2
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-aksi uppercase">
                      {TEKS.PERAN_PENGANGKUT}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-tinta">{TEKS.A2_FOTO}</h4>
                    <p className="text-xs text-tinta-redup mt-0.5">{TEKS.KND_JUDUL}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <span className="rounded border border-garis bg-kertas px-2 py-0.5 font-mono text-[11px] font-bold text-tinta">
                      B 9012 SER
                    </span>
                    <span className="text-[11px] font-bold text-aksi">
                      Pindai QR ✓
                    </span>
                  </div>
                </div>

                {/* Tahap 3: Penerima Olahan */}
                <div className="flex flex-col gap-3 rounded-xl border-2 border-indigo-500/30 bg-indigo-50/20 p-4 transition-all hover:border-indigo-500 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                      3
                    </span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">
                      {TEKS.PERAN_PENERIMA}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-tinta">{TEKS.P1_FOTO_TIKET}</h4>
                    <p className="text-xs text-tinta-redup mt-0.5">{isi("P1_DITUTUP", { kode_serah: "SRH-0001" })}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                      Timbang Bersama
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700">
                      BAST Digital ✓
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5 Sorotan Fitur */}
        <section className="px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="fitur-judul">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h2 id="fitur-judul" className="text-3xl font-extrabold tracking-tight text-tinta sm:text-4xl">
                {TEKS.LANDING_JUDUL}
              </h2>
              <p className="mt-2 text-base text-tinta-redup max-w-xl mx-auto">
                {TEKS.APP_DESKRIPSI}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FITUR_SOROTAN.map((fitur, i) => (
                <Kartu
                  key={i}
                  className="group flex flex-col justify-between gap-4 border border-garis-halus bg-kertas p-6 shadow-sm hover:border-aksi-garis hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-aksi/30 bg-aksi-latar text-sm font-black text-aksi shadow-2xs group-hover:scale-105 transition-transform">
                        {i + 1}
                      </span>
                      <span className="rounded-kontrol border border-garis-halus bg-latar px-2.5 py-0.5 text-[11px] font-semibold text-tinta-redup">
                        {fitur.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-tinta group-hover:text-aksi transition-colors">
                      {fitur.judul}
                    </h3>
                    <p className="text-sm leading-relaxed text-tinta-redup">{fitur.isi}</p>
                  </div>
                </Kartu>
              ))}
            </div>
          </div>
        </section>

        {/* Dasar Regulasi & Batasan */}
        <section
          className="border-t border-garis-halus bg-kertas px-4 py-14 sm:px-6"
          aria-labelledby="regulasi-judul"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
            <div className="inline-flex items-center justify-center">
              <span className="rounded-full border border-garis bg-latar px-3 py-1 text-xs font-semibold text-tinta">
                Peraturan Gubernur DKI Jakarta
              </span>
            </div>
            <h2 id="regulasi-judul" className="text-base font-bold text-tinta sm:text-lg">
              {TEKS.LANDING_DASAR}
            </h2>
            <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.LANDING_BUKAN_PORTAL}</p>
          </div>
        </section>
      </main>

      {/* Footer Bersih & Berwibawa */}
      <footer className="border-t border-garis-halus bg-kertas px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <LogoSerah ukuran="sm" />
            <span className="text-xs text-tinta-redup">| {TEKS.KAKI_HAK_CIPTA}</span>
          </div>
          <nav aria-label="Navigasi Kaki" className="flex flex-wrap items-center gap-6 text-sm font-medium text-tinta-redup">
            <Link href="/tentang" className="hover:text-aksi transition-colors">
              {TEKS.TENTANG_JUDUL}
            </Link>
            <Link href="/harga" className="hover:text-aksi transition-colors">
              {TEKS.HRG_JUDUL}
            </Link>
            <Link href="/privasi" className="hover:text-aksi transition-colors">
              {TEKS.PRIV_JUDUL}
            </Link>
            <Link href="/syarat" className="hover:text-aksi transition-colors">
              {TEKS.SYR_JUDUL}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
