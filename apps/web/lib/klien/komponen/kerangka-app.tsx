"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import { useEffect, useState, type ReactNode } from "react";
import type { Peran } from "@serah/kontrak/enum";
import { TEKS, type KunciTeks } from "@serah/kontrak/teks";
import { BannerGalat, LabelDemo } from "@serah/ui";
import { MOCK_AKTIF, panggil } from "../api";
import { ProviderSesi, useSesi } from "../sesi";
import { BannerSambungan } from "./banner-sambungan";
import { IkonLanding, type NamaIkon } from "./ikon-landing";
import { IkonNav, type NamaIkonNav } from "./ikon-nav";
import { IndikatorSinkron } from "./indikator-sinkron";
import { LegendaIkon } from "./legenda-ikon";
import { NotifikasiPopover } from "./notifikasi-popover";
import { PencarianSerah } from "./pencarian-serah";
import { LogoSerah } from "./logo-serah";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

type ItemNav = { href: string; kunci: KunciTeks; pendek: KunciTeks; ikon: NamaIkonNav };

/**
 * Navigasi per peran. `utama` = tampil di bilah bawah HP (maks. 5); semuanya tampil di sidebar desktop.
 * Notifikasi di HP dibuka lewat lonceng di bilah atas.
 */
const NAV: Record<Peran, readonly ItemNav[]> = {
  PETUGAS: [
    { href: "/petugas", kunci: "T1_JUDUL", pendek: "NAV_CATAT", ikon: "tps" },
    { href: "/petugas/serah", kunci: "T2_JUDUL", pendek: "NAV_SERAH", ikon: "serah" },
    { href: "/akun", kunci: "AKUN_JUDUL", pendek: "NAV_AKUN", ikon: "akun" },
  ],
  PENGANGKUT: [
    { href: "/pengangkut", kunci: "A1_JUDUL", pendek: "NAV_AMBIL", ikon: "beranda" },
    { href: "/pengangkut/kendaraan", kunci: "KND_JUDUL", pendek: "NAV_KENDARAAN", ikon: "truk" },
    { href: "/pengangkut/laporan", kunci: "LAPORAN_PENGANGKUT", pendek: "NAV_LAPORAN", ikon: "laporan" },
    { href: "/akun", kunci: "AKUN_JUDUL", pendek: "NAV_AKUN", ikon: "akun" },
  ],
  PENGELOLA: [
    { href: "/kawasan", kunci: "K1_JUDUL", pendek: "NAV_BERANDA", ikon: "beranda" },
    { href: "/kawasan/ditolak", kunci: "K3_JUDUL", pendek: "NAV_DITOLAK", ikon: "ditolak" },
    { href: "/kawasan/laporan", kunci: "K4_JUDUL", pendek: "NAV_LAPORAN", ikon: "laporan" },
    { href: "/kawasan/tps", kunci: "TPS_JUDUL", pendek: "NAV_TPS", ikon: "tps" },
    { href: "/akun", kunci: "AKUN_JUDUL", pendek: "NAV_AKUN", ikon: "akun" },
  ],
  PENERIMA: [
    { href: "/penerima", kunci: "P1_JUDUL", pendek: "NAV_TERIMA", ikon: "beranda" },
    { href: "/penerima/laporan", kunci: "P2_JUDUL", pendek: "NAV_LAPORAN", ikon: "laporan" },
    { href: "/akun", kunci: "AKUN_JUDUL", pendek: "NAV_AKUN", ikon: "akun" },
  ],
  ADMIN: [
    { href: "/admin", kunci: "ADM_JUDUL", pendek: "NAV_ADMIN", ikon: "admin" },
    { href: "/akun", kunci: "AKUN_JUDUL", pendek: "NAV_AKUN", ikon: "akun" },
  ],
};

const KUNCI_PERAN: Record<Peran, KunciTeks> = {
  PETUGAS: "PERAN_PETUGAS",
  PENGELOLA: "PERAN_PENGELOLA",
  PENGANGKUT: "PERAN_PENGANGKUT",
  PENERIMA: "PERAN_PENERIMA",
  ADMIN: "PERAN_ADMIN",
};

const IKON_PERAN: Record<Peran, NamaIkon> = {
  PETUGAS: "tps",
  PENGANGKUT: "truk",
  PENGELOLA: "laporan",
  PENERIMA: "timbang",
  ADMIN: "aturan",
};

/** Segmen rute yang hanya boleh dibuka satu peran. */
const PERAN_SEGMEN: Record<string, Peran> = {
  petugas: "PETUGAS",
  pengangkut: "PENGANGKUT",
  kawasan: "PENGELOLA",
  penerima: "PENERIMA",
  admin: "ADMIN",
};

const RUTE_HOME: Record<Peran, string> = {
  PETUGAS: "/petugas",
  PENGELOLA: "/kawasan",
  PENGANGKUT: "/pengangkut",
  PENERIMA: "/penerima",
  ADMIN: "/admin",
};

function Isi({ children }: { children: ReactNode }) {
  const { keadaan, muatUlang } = useSesi();
  const jalur = usePathname();
  const router = useRouter();
  const [adalahPanelDemo, setAdalahPanelDemo] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("panel")) {
      setAdalahPanelDemo(true);
    }
  }, []);

  if (keadaan.status === "memuat") {
    return (
      <div className={`${poppins.className} flex min-h-dvh items-center justify-center bg-kertas p-6`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-aksi border-t-transparent" />
          <p role="status" className="text-sm font-medium text-tinta-redup">
            {TEKS.UMUM_MUAT}
          </p>
        </div>
      </div>
    );
  }
  if (keadaan.status === "galat" && keadaan.habis) {
    // Sesi berakhir (mis. kembali ke halaman setelah keluar): arahkan dengan jelas ke halaman masuk.
    return (
      <div className={`${poppins.className} flex min-h-dvh items-center justify-center bg-gradient-to-b from-latar to-white p-5`}>
        <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-[2rem] bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.10)] ring-1 ring-garis-halus/70">
          <LogoSerah ukuran="md" />
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-aksi-latar text-aksi">
            <IkonNav nama="perisai" className="h-8 w-8" />
          </span>
          <p role="alert" className="text-base font-medium leading-relaxed text-tinta">
            {keadaan.pesan}
          </p>
          <Link
            href="/masuk"
            className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-aksi text-base font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover active:translate-y-0 active:scale-[0.98]"
          >
            {TEKS.MASUK_TOMBOL}
          </Link>
        </div>
      </div>
    );
  }
  if (keadaan.status === "galat") {
    return (
      <div className={`${poppins.className} min-h-dvh bg-kertas p-4`}>
        <BannerGalat pesan={keadaan.pesan} onCoba={muatUlang} />
      </div>
    );
  }

  const { sesi } = keadaan;
  const peran = sesi.peran;
  const wajib = PERAN_SEGMEN[jalur.split("/")[1] ?? ""];
  const boleh = !wajib || wajib === peran;
  const nav = peran ? NAV[peran] : [];
  const navBawah = nav;
  const ruteHome = peran ? RUTE_HOME[peran] : "/";
  const namaPeran = peran ? TEKS[KUNCI_PERAN[peran]] : TEKS.APP_NAMA;
  const ikonPeran: NamaIkon = peran ? IKON_PERAN[peran] : "aturan";

  async function keluar() {
    await panggil("POST", "/api/auth/keluar");
    router.replace("/masuk");
  }

  const adalahAktif = (href: string) =>
    jalur === href ||
    (href !== "/" &&
      jalur.startsWith(`${href}/`) &&
      !nav.some((m) => m.href.length > href.length && jalur.startsWith(m.href)));


  // Halaman fokus (cetak QR): tanpa sidebar, navbar, dan bilah bawah.
  const tanpaShell = jalur.startsWith("/kawasan/tps/cetak");
  if (tanpaShell && boleh) {
    return <div className={`${poppins.className} min-h-dvh bg-kertas text-tinta`}>{children}</div>;
  }

  return (
    <div className={`${poppins.className} min-h-dvh bg-latar text-tinta`}>
      {MOCK_AKTIF && !adalahPanelDemo ? <LabelDemo /> : null}

      {/* Sidebar desktop: rata, menyatu dengan navbar (gaya dasbor) */}
      {!adalahPanelDemo ? (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-garis-halus bg-kertas lg:flex">
          <Link href={ruteHome} aria-label={TEKS.APP_NAMA} className="group flex h-16 shrink-0 items-center border-b border-garis-halus px-5">
            <LogoSerah ukuran="md" />
          </Link>

          <nav aria-label="Navigasi desktop" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
            {nav.map((n) => {
              const aktif = adalahAktif(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                    aktif ? "bg-aksi-latar text-aksi" : "text-tinta-redup hover:bg-latar hover:text-tinta"
                  }`}
                >
                  {aktif ? <span aria-hidden="true" className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-aksi" /> : null}
                  <IkonNav nama={n.ikon} className="h-[18px] w-[18px]" />
                  <span className="truncate">{TEKS[n.pendek]}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-garis-halus p-3">
            <button
              type="button"
              onClick={() => void keluar()}
              className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-tinta-redup transition-colors duration-150 hover:bg-latar hover:text-tinta"
            >
              <IkonNav nama="keluar" className="h-[18px] w-[18px]" />
              <span>{TEKS.UMUM_KELUAR}</span>
            </button>
          </div>
        </aside>
      ) : null}

      <div className={`overflow-x-clip ${adalahPanelDemo ? "" : "lg:pl-[248px]"}`}>
        {/* Navbar desktop: menyatu dengan sidebar, tanpa margin */}
        {!adalahPanelDemo ? (
          <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-garis-halus bg-white/85 px-6 backdrop-blur-xl backdrop-saturate-150 lg:flex">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-latar">
                <IkonLanding nama={ikonPeran} className="h-5 w-5" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-tinta">{namaPeran}</p>
                {sesi.organisasiAktif ? <p className="truncate text-xs text-tinta-redup">{sesi.organisasiAktif.nama}</p> : null}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 justify-center">
              <PencarianSerah />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IndikatorSinkron />
              <LegendaIkon />
              <NotifikasiPopover />
            </div>
          </header>
        ) : null}

        {/* Bilah atas kaca: HP */}
        <header className="sticky top-0 z-30 bg-gradient-to-b from-latar from-70% to-transparent px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 lg:hidden">
          <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 px-3 py-2 shadow-[0_8px_30px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-garis-halus/70 backdrop-blur-xl backdrop-saturate-150">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={ruteHome}
                aria-label={TEKS.APP_NAMA}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-latar transition-colors hover:bg-aksi-latar ${
                  adalahPanelDemo ? "" : "lg:hidden"
                }`}
              >
                <IkonLanding nama={ikonPeran} className="h-6 w-6" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-tinta">{namaPeran}</p>
                {sesi.organisasiAktif ? (
                  <p className="truncate text-xs leading-tight text-tinta-redup">{sesi.organisasiAktif.nama}</p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <IndikatorSinkron />
              <NotifikasiPopover />
              {!adalahPanelDemo ? (
                <button
                  type="button"
                  onClick={() => void keluar()}
                  aria-label={TEKS.UMUM_KELUAR}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-latar text-tinta transition-colors duration-200 hover:bg-aksi-latar hover:text-aksi lg:hidden"
                >
                  <IkonNav nama="keluar" className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <BannerSambungan />

        <main className="mx-auto w-full max-w-[1600px] px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
          {boleh ? children : <BannerGalat pesan={TEKS.G_PERAN_TIDAK_BOLEH} />}
        </main>
      </div>

      {/* Bilah bawah HP: pil gelap mengambang */}
      <nav
        aria-label={TEKS.APP_NAMA}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <ul className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-1 rounded-full bg-tinta p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
          {navBawah.map((n) => {
            const aktif = adalahAktif(n.href);
            return (
              <li key={n.href} className={aktif ? "min-w-0 flex-[2]" : "flex-1"}>
                <Link
                  href={n.href}
                  aria-current={aktif ? "page" : undefined}
                  aria-label={TEKS[n.kunci]}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-full px-3 text-xs font-medium transition-all duration-300 ${
                    aktif ? "bg-white text-tinta" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <IkonNav nama={n.ikon} className="h-5 w-5 shrink-0" />
                  {aktif ? <span className="truncate">{TEKS[n.pendek]}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function KerangkaApp({ children }: { children: ReactNode }) {
  return (
    <ProviderSesi>
      <Isi>{children}</Isi>
    </ProviderSesi>
  );
}
