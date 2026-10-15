import Link from "next/link";
import { Kartu } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";
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
        {/* Bagian Hero dengan Atmospheric Accent */}
        <section
          className="relative overflow-hidden border-b border-garis-halus bg-kertas px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="hero-judul"
          style={{
            background:
              "radial-gradient(100% 60% at 50% 0%, rgba(36, 87, 197, 0.07) 0%, rgba(255, 255, 255, 0) 100%), #ffffff",
          }}
        >
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
            {/* SERAH Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-aksi/25 bg-aksi-latar px-3.5 py-1 text-xs font-bold text-aksi shadow-xs">
              <span className="h-2 w-2 rounded-full bg-aksi animate-pulse" aria-hidden="true" />
              <span>{TEKS.APP_NAMA} · {TEKS.APP_TAGLINE}</span>
            </div>

            {/* Headline dengan text-wrap: balance */}
            <h1
              id="hero-judul"
              className="text-4xl font-black tracking-tight text-tinta sm:text-5xl lg:text-6xl [text-wrap:balance]"
            >
              {TEKS.LANDING_JUDUL}
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl text-lg leading-relaxed text-tinta-redup sm:text-xl [text-wrap:balance]">
              {TEKS.LANDING_SUB}
            </p>

            {/* Tombol Aksi Utama */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
              <Link
                href="/mulai"
                className="inline-flex min-h-12 items-center justify-center rounded-kontrol bg-aksi px-7 py-3 text-base font-bold text-aksi-teks shadow-sm hover:bg-aksi-hover hover:shadow-md transition-all active:scale-[0.98]"
              >
                {TEKS.LANDING_CTA}
              </Link>
              <Link
                href="/demo"
                className="inline-flex min-h-12 items-center justify-center rounded-kontrol border-2 border-garis bg-kertas px-6 py-3 text-base font-bold text-tinta shadow-xs hover:bg-latar hover:border-tinta transition-all active:scale-[0.98]"
              >
                {TEKS.LANDING_CTA_DEMO}
              </Link>
              <Link
                href="/harga"
                className="inline-flex min-h-12 items-center justify-center px-4 py-3 text-sm font-semibold text-tinta-redup hover:text-aksi hover:underline transition-colors"
              >
                {TEKS.HRG_JUDUL} →
              </Link>
            </div>

            {/* Ilustrasi Konsep Tiga Pihak Satu Serah */}
            <div className="mt-8 w-full max-w-3xl rounded-kartu border border-garis-halus bg-latar/60 p-5 shadow-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-left">
                <div className="flex flex-col gap-1 rounded-kontrol border border-garis-halus bg-kertas p-3.5 shadow-2xs">
                  <span className="text-[11px] font-bold tracking-wider text-aksi uppercase">
                    {TEKS.PERAN_PENGELOLA}
                  </span>
                  <p className="text-xs font-semibold text-tinta">
                    {TEKS.K1_JUDUL}
                  </p>
                  <p className="text-[11px] text-tinta-redup">
                    {TEKS.T1_PILIH_ALIRAN}
                  </p>
                </div>
                <div className="flex flex-col gap-1 rounded-kontrol border border-garis-halus bg-kertas p-3.5 shadow-2xs">
                  <span className="text-[11px] font-bold tracking-wider text-aksi uppercase">
                    {TEKS.PERAN_PENGANGKUT}
                  </span>
                  <p className="text-xs font-semibold text-tinta">
                    {TEKS.A2_FOTO}
                  </p>
                  <p className="text-[11px] text-tinta-redup">
                    {TEKS.KND_JUDUL}
                  </p>
                </div>
                <div className="flex flex-col gap-1 rounded-kontrol border border-garis-halus bg-kertas p-3.5 shadow-2xs">
                  <span className="text-[11px] font-bold tracking-wider text-aksi uppercase">
                    {TEKS.PERAN_PENERIMA}
                  </span>
                  <p className="text-xs font-semibold text-tinta">
                    {TEKS.P1_FOTO_TIKET}
                  </p>
                  <p className="text-[11px] text-tinta-redup">
                    {TEKS.P1_DITUTUP}
                  </p>
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
