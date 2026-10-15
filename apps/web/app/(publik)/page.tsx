import Link from "next/link";
import { Poppins } from "next/font/google";
import { TEKS } from "@serah/kontrak/teks";
import { AtribusiBMKG } from "@serah/ui";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";
import { NavbarGlass } from "@/lib/klien/komponen/navbar-glass";
import { IkonLanding, LencanaIkon, type NamaIkon } from "@/lib/klien/komponen/ikon-landing";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const FITUR: { ikon: NamaIkon; judul: string; isi: string }[] = [
  { ikon: "tps", judul: TEKS.LANDING_L1_JUDUL, isi: TEKS.LANDING_L1_ISI },
  { ikon: "centang", judul: TEKS.LANDING_L2_JUDUL, isi: TEKS.LANDING_L2_ISI },
  { ikon: "aturan", judul: TEKS.LANDING_L3_JUDUL, isi: TEKS.LANDING_L3_ISI },
  { ikon: "daur", judul: TEKS.LANDING_L4_JUDUL, isi: TEKS.LANDING_L4_ISI },
  { ikon: "hujan", judul: TEKS.LANDING_L5_JUDUL, isi: TEKS.LANDING_L5_ISI },
];

const KAWASAN: { ikon: NamaIkon; teks: string }[] = [
  { ikon: "pasar", teks: TEKS.LANDING_KAWASAN_1 },
  { ikon: "makan", teks: TEKS.LANDING_KAWASAN_2 },
  { ikon: "kuliner", teks: TEKS.LANDING_KAWASAN_3 },
  { ikon: "apartemen", teks: TEKS.LANDING_KAWASAN_4 },
];

const MVP_KECIL: { ikon: NamaIkon; judul: string; isi: string }[] = [
  { ikon: "aturan", judul: TEKS.LANDING_MVP_B_JUDUL, isi: TEKS.LANDING_MVP_B_ISI },
  { ikon: "hujan", judul: TEKS.LANDING_MVP_C_JUDUL, isi: TEKS.LANDING_MVP_C_ISI },
  { ikon: "rantai", judul: TEKS.LANDING_MVP_D_JUDUL, isi: TEKS.LANDING_MVP_D_ISI },
  { ikon: "daur", judul: TEKS.LANDING_MVP_E_JUDUL, isi: TEKS.LANDING_MVP_E_ISI },
];

const BATASAN = [
  TEKS.TENTANG_BATASAN_1,
  TEKS.TENTANG_BATASAN_2,
  TEKS.TENTANG_BATASAN_3,
  TEKS.TENTANG_BATASAN_4,
  TEKS.TENTANG_BATASAN_5,
  TEKS.TENTANG_BATASAN_6,
  TEKS.TENTANG_BATASAN_7,
  TEKS.TENTANG_BATASAN_8,
  TEKS.TENTANG_BATASAN_9,
  TEKS.TENTANG_BATASAN_10,
] as const;

const PAKET: {
  nama: string;
  catatan: string;
  harga: string;
  pihak: string;
  isi: string;
  poin: readonly string[];
  href: string;
  cta: string;
  utama: boolean;
}[] = [
  {
    nama: "Gratis",
    catatan: "Evaluasi",
    harga: "Rp 0",
    pihak: TEKS.PERAN_PENGELOLA,
    isi: TEKS.HRG_SELALU_GRATIS,
    poin: [TEKS.T1_JUDUL, TEKS.T2_JUDUL, TEKS.K1_JUDUL, TEKS.EKSPOR_CSV],
    href: "/daftar",
    cta: TEKS.DAFTAR_JUDUL,
    utama: false,
  },
  {
    nama: "Mandiri",
    catatan: "14 hari bebas biaya",
    harga: TEKS.HRG_KAWASAN,
    pihak: TEKS.PERAN_PENGELOLA,
    isi: TEKS.HRG_KAWASAN_DETAIL,
    poin: [TEKS.EKSPOR_PDF, TEKS.AI_LABEL, TEKS.ATURAN_JUDUL_PRIORITAS, TEKS.K3_JUDUL, TEKS.AGT_JUDUL],
    href: "/mulai",
    cta: TEKS.LANDING_CTA,
    utama: true,
  },
  {
    nama: "Mitra",
    catatan: "Selalu bebas biaya",
    harga: "Rp 0",
    pihak: `${TEKS.PERAN_PENGANGKUT} & ${TEKS.PERAN_PENERIMA}`,
    isi: TEKS.HRG_MITRA,
    poin: [`${TEKS.A2_PINDAI} & ${TEKS.P1_PINDAI}`, TEKS.P1_FOTO_TIKET, TEKS.TGA_JUDUL, TEKS.IZN_JUDUL],
    href: "/daftar",
    cta: TEKS.DAFTAR_JUDUL,
    utama: false,
  },
];

/** Lingkaran konsentris latar hero, dengan beberapa busur biru seperti referensi. */
function CincinLatar() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 950"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {[260, 380, 500, 640, 780].map((r) => (
        <circle key={r} cx="720" cy="500" r={r} stroke="#e8edf4" strokeWidth="1.2" />
      ))}
      <path d="M 380 392 A 380 380 0 0 0 340 520" stroke="#2457c5" strokeWidth="1.2" opacity="0.55" />
      <path d="M 1040 330 A 500 500 0 0 1 1100 500" stroke="#2457c5" strokeWidth="1.2" opacity="0.55" />
      <path d="M 250 640 A 640 640 0 0 0 330 760" stroke="#2457c5" strokeWidth="1.2" opacity="0.55" />
    </svg>
  );
}

function KartuPresence({
  ikon,
  judul,
  meta,
  className = "",
}: {
  ikon: NamaIkon;
  judul: string;
  meta: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-garis-halus bg-kertas px-4 py-3 text-left shadow-[0_8px_24px_rgba(36,87,197,0.10)] transition-all duration-300 hover:-translate-y-0.5 hover:border-aksi-garis hover:shadow-[0_14px_32px_rgba(36,87,197,0.18)] ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-latar">
        <IkonLanding nama={ikon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-tinta">{judul}</p>
        <p className="truncate text-xs text-tinta-redup">{meta}</p>
      </div>
    </div>
  );
}

/** Mockup kecil tiga laporan yang berubah bersamaan dari satu serah. */
function MockupTigaLaporan() {
  const baris = [
    { ikon: "tps" as const, nama: TEKS.LANDING_PIHAK_KAWASAN, warna: "bg-emerald-500" },
    { ikon: "truk" as const, nama: TEKS.LANDING_PIHAK_PENGANGKUT, warna: "bg-aksi" },
    { ikon: "timbang" as const, nama: TEKS.LANDING_PIHAK_PENERIMA, warna: "bg-indigo-500" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-garis-halus bg-latar p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-tinta">SRH-0142</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-selesai-latar px-2.5 py-1 text-[11px] font-semibold text-status-selesai">
          <IkonLanding nama="centang" className="h-3.5 w-3.5" />
          {TEKS.LANDING_PRESENCE_1_META}
        </span>
      </div>
      {baris.map((b) => (
        <div key={b.nama} className="flex items-center gap-3 rounded-xl border border-garis-halus bg-kertas px-3 py-2.5 transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar/40">
          <IkonLanding nama={b.ikon} className="h-7 w-7 shrink-0" />
          <span className="flex-1 text-sm font-medium text-tinta">{b.nama}</span>
          <span className={`h-2 w-2 rounded-full ${b.warna}`} aria-hidden="true" />
          <span className="font-mono text-sm font-semibold text-tinta">1.240 kg</span>
        </div>
      ))}
    </div>
  );
}

const TOMBOL_HITAM =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-tinta px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi hover:shadow-[0_10px_24px_rgba(36,87,197,0.30)] active:translate-y-0 active:scale-[0.98]";
const TOMBOL_TEPI =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-garis-halus bg-kertas px-5 py-2.5 text-sm font-medium text-tinta transition-all duration-200 hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi active:translate-y-0 active:scale-[0.98]";

export default function HalamanLanding() {
  return (
    <div className={`${poppins.className} min-h-dvh bg-kertas text-tinta`}>
      <div className="mx-auto max-w-[1440px]">
        {/* Navbar kaca sticky + hamburger di layar sempit */}
        <NavbarGlass />

        {/* Hero */}
        <section
          className="relative overflow-hidden bg-kertas"
          aria-labelledby="hero-judul"
        >
          <CincinLatar />


          {/* Ikon mengorbit (dekoratif, hanya layar lebar) */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden xl:block">
            <LencanaIkon nama="qr" className="left-[calc(50%-470px)] top-[18%]" />
            <LencanaIkon nama="kamera" className="left-[calc(50%-560px)] top-[38%]" />
            <LencanaIkon nama="timbang" className="left-[calc(50%-340px)] top-[54%]" />
            <LencanaIkon nama="tps" className="left-[calc(50%-610px)] top-[60%]" ukuran={64} />
            <LencanaIkon nama="hujan" className="left-[calc(50%-310px)] top-[74%]" ukuran={56} />
            <LencanaIkon nama="laporan" className="right-[calc(50%-470px)] top-[18%]" />
            <LencanaIkon nama="truk" className="right-[calc(50%-560px)] top-[38%]" />
            <LencanaIkon nama="rantai" className="right-[calc(50%-340px)] top-[54%]" />
            <LencanaIkon nama="aturan" className="right-[calc(50%-610px)] top-[60%]" ukuran={64} />
            <LencanaIkon nama="daur" className="right-[calc(50%-310px)] top-[74%]" ukuran={56} />
          </div>

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 pb-14 pt-10 text-center sm:pt-16">
            <div className="hero-masuk flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-tinta-redup">
              <span className="inline-flex items-center gap-1.5">
                <IkonLanding nama="aturan" className="h-4 w-4" />
                {TEKS.LANDING_LENCANA_PERGUB}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IkonLanding nama="hujan" className="h-4 w-4" />
                {TEKS.LANDING_LENCANA_BMKG}
              </span>
            </div>

            <h1
              id="hero-judul"
              className="hero-masuk mt-5 text-[2.5rem] font-semibold leading-[1.1] tracking-[-0.03em] text-tinta sm:text-6xl [text-wrap:balance]"
            >
              {TEKS.LANDING_JUDUL}
            </h1>
            <p className="hero-masuk mt-5 max-w-xl text-base leading-relaxed text-tinta-redup sm:text-lg [text-wrap:balance]">
              {TEKS.LANDING_SUB}
            </p>

            <div className="hero-masuk mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/mulai" className={TOMBOL_HITAM}>
                {TEKS.LANDING_CTA}
              </Link>
              <Link href="/demo" className={TOMBOL_TEPI}>
                {TEKS.LANDING_CTA_DEMO}
              </Link>
            </div>

            {/* Tumpukan kartu aktivitas, seperti referensi */}
            <div className="hero-masuk relative mt-14 w-full max-w-md">
              <KartuPresence
                ikon="centang"
                judul={TEKS.LANDING_PRESENCE_1_JUDUL}
                meta={TEKS.LANDING_PRESENCE_1_META}
                className="relative z-30"
              />
              <KartuPresence
                ikon="laporan"
                judul={TEKS.LANDING_PRESENCE_2_JUDUL}
                meta={TEKS.LANDING_PRESENCE_2_META}
                className="relative z-20 -mt-1 mx-4"
              />
              <KartuPresence
                ikon="rantai"
                judul={TEKS.LANDING_PRESENCE_3_JUDUL}
                meta={TEKS.LANDING_PRESENCE_3_META}
                className="relative z-10 -mt-1 mx-8 opacity-80"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-10 -bottom-10 -top-6 -z-10 bg-[radial-gradient(closest-side,rgba(36,87,197,0.18),transparent)]"
              />
            </div>
          </div>

          {/* Jenis kawasan */}
          <div className="relative z-10 border-t border-garis-halus/70 px-5 pb-10 pt-8">
            <p className="text-center text-sm text-tinta-redup">{TEKS.LANDING_PERCAYA}</p>
            <ul className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {KAWASAN.map((k) => (
                <li key={k.teks} className="muncul flex items-center gap-2.5 text-lg font-medium text-tinta-redup transition-colors duration-200 hover:text-aksi">
                  <IkonLanding nama={k.ikon} className="h-7 w-7" />
                  {k.teks}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <main>
          {/* MVP: yang paling menonjol dari SERAH */}
          <section id="mvp" className="scroll-mt-24 px-2 py-16 sm:px-6 sm:py-24" aria-labelledby="mvp-judul">
            <div className="mx-auto max-w-6xl">
              <div className="muncul mx-auto max-w-2xl text-center">
                <span className="inline-flex rounded-full border border-aksi-garis bg-aksi-latar px-3 py-1 text-xs font-medium text-aksi">
                  {TEKS.LANDING_MVP_LABEL}
                </span>
                <h2
                  id="mvp-judul"
                  className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-tinta sm:text-4xl [text-wrap:balance]"
                >
                  {TEKS.LANDING_MVP_JUDUL}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-tinta-redup">{TEKS.LANDING_MVP_SUB}</p>
              </div>

              <div className="mt-12 grid gap-4 lg:grid-cols-5">
                {/* Sorotan utama */}
                <article className="muncul group transition-all duration-300 hover:-translate-y-1 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)] flex flex-col gap-6 rounded-3xl border border-garis-halus bg-kertas p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-8 lg:col-span-3">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-aksi">
                      {TEKS.LANDING_MVP_A_LABEL}
                    </span>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-tinta">
                      {TEKS.LANDING_MVP_A_JUDUL}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-tinta-redup">{TEKS.LANDING_MVP_A_ISI}</p>
                  </div>
                  <MockupTigaLaporan />
                  <ol className="grid gap-3 sm:grid-cols-3">
                    {[
                      { ikon: "tps" as const, teks: TEKS.LANDING_MVP_A_POIN_1 },
                      { ikon: "qr" as const, teks: TEKS.LANDING_MVP_A_POIN_2 },
                      { ikon: "timbang" as const, teks: TEKS.LANDING_MVP_A_POIN_3 },
                    ].map((p, i) => (
                      <li key={p.teks} className="flex flex-col gap-2 rounded-2xl bg-latar p-4 transition-colors duration-200 hover:bg-aksi-latar">
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tinta text-xs font-semibold text-white">
                            {i + 1}
                          </span>
                          <IkonLanding nama={p.ikon} className="h-7 w-7" />
                        </span>
                        <span className="text-sm leading-snug text-tinta">{p.teks}</span>
                      </li>
                    ))}
                  </ol>
                </article>

                {/* Empat pendukung */}
                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
                  {MVP_KECIL.map((m) => (
                    <article
                      key={m.judul}
                      className="muncul group transition-all duration-300 hover:-translate-y-1 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)] flex flex-col gap-3 rounded-3xl border border-garis-halus bg-kertas p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-latar transition-colors duration-300 group-hover:bg-aksi-latar">
                        <IkonLanding nama={m.ikon} className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
                      </span>
                      <h3 className="text-base font-semibold text-tinta">{m.judul}</h3>
                      <p className="text-sm leading-relaxed text-tinta-redup">{m.isi}</p>
                    </article>
                  ))}
                </div>

                {/* Ajakan demo */}
                <article className="muncul group transition-all duration-300 hover:-translate-y-1 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)] flex flex-col items-start justify-between gap-5 rounded-3xl bg-tinta p-6 text-white sm:flex-row sm:items-center sm:p-8 lg:col-span-5">
                  <div>
                    <h3 className="text-xl font-semibold">{TEKS.LANDING_MVP_DEMO_JUDUL}</h3>
                    <p className="mt-1 text-sm text-white/70">{TEKS.LANDING_MVP_DEMO_ISI}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/demo"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-tinta transition hover:bg-latar"
                    >
                      {TEKS.LANDING_NAV_DEMO}
                    </Link>
                    <a
                      href="#tentang"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      {TEKS.LANDING_CTA_ALUR}
                    </a>
                  </div>
                </article>
              </div>
            </div>
          </section>

          {/* Lima sorotan fitur */}
          <section id="fitur" className="scroll-mt-24 px-2 pb-16 sm:px-6 sm:pb-24" aria-labelledby="fitur-judul">
            <div className="mx-auto max-w-6xl">
              <h2
                id="fitur-judul"
                className="muncul mb-10 text-center text-3xl font-semibold tracking-[-0.025em] text-tinta sm:text-4xl"
              >
                {TEKS.LANDING_NAV_FITUR}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {FITUR.map((f) => (
                  <article
                    key={f.judul}
                    className="muncul group transition-all duration-300 hover:-translate-y-1 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)] flex flex-col gap-3 rounded-3xl border border-garis-halus bg-kertas p-6 transition hover:border-aksi-garis hover:shadow-[0_8px_30px_rgba(36,87,197,0.08)]"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-latar transition-colors duration-300 group-hover:bg-aksi-latar">
                      <IkonLanding nama={f.ikon} className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
                    </span>
                    <h3 className="text-lg font-semibold text-tinta">{f.judul}</h3>
                    <p className="text-sm leading-relaxed text-tinta-redup">{f.isi}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Harga */}
          <section id="harga" className="scroll-mt-24 px-2 pb-16 sm:px-6 sm:pb-24" aria-labelledby="harga-judul">
            <div className="mx-auto max-w-6xl">
              <div className="muncul mx-auto max-w-2xl text-center">
                <h2
                  id="harga-judul"
                  className="text-3xl font-semibold tracking-[-0.025em] text-tinta sm:text-4xl"
                >
                  {TEKS.HRG_JUDUL}
                </h2>
                <p className="mt-4 text-base text-tinta-redup [text-wrap:balance]">{TEKS.HRG_SELALU_GRATIS}</p>
              </div>
              <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-3">
                {PAKET.map((p) => (
                  <article
                    key={p.nama}
                    className={`muncul group transition-all duration-300 hover:-translate-y-1 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)] relative flex flex-col justify-between gap-6 rounded-3xl bg-kertas p-6 ${
                      p.utama
                        ? "border-2 border-aksi shadow-[0_12px_40px_rgba(36,87,197,0.14)]"
                        : "border border-garis-halus"
                    }`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded-lg px-3 py-1 text-xs font-medium ${
                            p.utama ? "bg-aksi-latar text-aksi" : "bg-latar text-tinta"
                          }`}
                        >
                          {p.nama}
                        </span>
                        <span className="text-xs text-tinta-redup">{p.catatan}</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-semibold leading-tight tracking-tight text-tinta">{p.harga}</h3>
                        <p className="mt-1 text-xs text-tinta-redup">{p.pihak}</p>
                      </div>
                      <p className="text-sm leading-relaxed text-tinta-redup">{p.isi}</p>
                      <ul className="flex flex-col gap-2.5 border-t border-garis-halus pt-4 text-sm text-tinta">
                        {p.poin.map((t) => (
                          <li key={t} className="flex items-center gap-2.5">
                            <IkonLanding nama="centang" className="h-4 w-4 shrink-0" />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link href={p.href} className={p.utama ? TOMBOL_HITAM : TOMBOL_TEPI}>
                      {p.cta}
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Tentang: batasan, AI, atribusi cuaca */}
          <section id="tentang" className="scroll-mt-24 px-2 pb-16 sm:px-6 sm:pb-24" aria-labelledby="tentang-judul">
            <div className="mx-auto max-w-6xl">
              <div className="muncul mx-auto max-w-2xl text-center">
                <h2
                  id="tentang-judul"
                  className="text-3xl font-semibold tracking-[-0.025em] text-tinta sm:text-4xl"
                >
                  {TEKS.TENTANG_JUDUL}
                </h2>
                <p className="mt-4 text-base text-tinta-redup">{TEKS.APP_DESKRIPSI}</p>
              </div>

              <div className="mt-12 grid gap-4 lg:grid-cols-5">
                <article className="muncul group transition-all duration-300 hover:-translate-y-1 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)] rounded-3xl border border-garis-halus bg-kertas p-6 sm:p-8 lg:col-span-3">
                  <h3 className="text-xl font-semibold text-tinta">{TEKS.TENTANG_BATASAN_JUDUL}</h3>
                  <ol className="mt-5 flex flex-col gap-3">
                    {BATASAN.map((b, i) => (
                      <li key={b} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-latar text-xs font-semibold text-tinta">
                          {i + 1}
                        </span>
                        <span className="text-sm leading-relaxed text-tinta">{b}</span>
                      </li>
                    ))}
                  </ol>
                </article>

                <div className="flex flex-col gap-4 lg:col-span-2">
                  <article className="muncul group transition-all duration-300 hover:-translate-y-1 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)] rounded-3xl border border-garis-halus bg-kertas p-6">
                    <span className="inline-flex rounded-lg bg-aksi-latar px-2.5 py-1 text-xs font-medium text-aksi">
                      Anthropic Claude
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-tinta">{TEKS.AI_LABEL}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-tinta-redup">{TEKS.TENTANG_AI}</p>
                  </article>
                  <article className="muncul group transition-all duration-300 hover:-translate-y-1 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)] rounded-3xl border border-garis-halus bg-kertas p-6">
                    <span className="inline-flex items-center gap-2 rounded-lg bg-latar px-2.5 py-1 text-xs font-medium text-tinta">
                      <IkonLanding nama="hujan" className="h-4 w-4" />
                      BMKG
                    </span>
                    <div className="mt-3 text-sm">
                      <AtribusiBMKG />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-tinta-redup">{TEKS.R10_CATATAN}</p>
                  </article>
                </div>
              </div>
            </div>
          </section>

          {/* Dasar regulasi & batasan */}
          <section
            className="mx-2 rounded-[28px] border border-garis-halus bg-kertas px-5 py-12 text-center sm:mx-5"
            aria-labelledby="regulasi-judul"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              <h2 id="regulasi-judul" className="text-base font-semibold text-tinta sm:text-lg">
                {TEKS.LANDING_DASAR}
              </h2>
              <p className="text-sm leading-relaxed text-tinta-redup">{TEKS.LANDING_BUKAN_PORTAL}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link href="/mulai" className={TOMBOL_HITAM}>
                  {TEKS.LANDING_CTA}
                </Link>
                <a href="#harga" className={TOMBOL_TEPI}>
                  {TEKS.HRG_JUDUL}
                </a>
              </div>
            </div>
          </section>
        </main>

        <footer className="px-2 py-10 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <LogoSerah ukuran="sm" />
              <span className="text-xs text-tinta-redup">{TEKS.KAKI_HAK_CIPTA}</span>
            </div>
            <nav
              aria-label="Navigasi kaki"
              className="flex flex-wrap items-center gap-6 text-sm text-tinta-redup"
            >
              <a href="#tentang" className="transition-colors duration-200 hover:text-aksi">
                {TEKS.LANDING_NAV_TENTANG}
              </a>
              <a href="#harga" className="transition-colors duration-200 hover:text-aksi">
                {TEKS.HRG_JUDUL}
              </a>
              <Link href="/privasi" className="transition-colors duration-200 hover:text-aksi">
                {TEKS.PRIV_JUDUL}
              </Link>
              <Link href="/syarat" className="transition-colors duration-200 hover:text-aksi">
                {TEKS.SYR_JUDUL}
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
