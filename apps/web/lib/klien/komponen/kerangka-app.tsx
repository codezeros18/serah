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
import { LogoSerah } from "./logo-serah";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

type ItemNav = { href: string; kunci: KunciTeks; ikon: NamaIkonNav };

/**
 * Navigasi per peran. `utama` = tampil di bilah bawah HP (maks. 5); semuanya tampil di sidebar desktop.
 * Notifikasi di HP dibuka lewat lonceng di bilah atas.
 */
const NAV: Record<Peran, readonly ItemNav[]> = {
  PETUGAS: [
    { href: "/petugas", kunci: "T1_JUDUL", ikon: "tps" },
    { href: "/petugas/serah", kunci: "T2_JUDUL", ikon: "serah" },
    { href: "/notifikasi", kunci: "NTF_JUDUL", ikon: "lonceng" },
    { href: "/akun", kunci: "AKUN_JUDUL", ikon: "akun" },
  ],
  PENGANGKUT: [
    { href: "/pengangkut", kunci: "A1_JUDUL", ikon: "beranda" },
    { href: "/pengangkut/kendaraan", kunci: "KND_JUDUL", ikon: "truk" },
    { href: "/pengangkut/laporan", kunci: "LAPORAN_PENGANGKUT", ikon: "laporan" },
    { href: "/notifikasi", kunci: "NTF_JUDUL", ikon: "lonceng" },
    { href: "/akun", kunci: "AKUN_JUDUL", ikon: "akun" },
  ],
  PENGELOLA: [
    { href: "/kawasan", kunci: "K1_JUDUL", ikon: "beranda" },
    { href: "/kawasan/ditolak", kunci: "K3_JUDUL", ikon: "ditolak" },
    { href: "/kawasan/laporan", kunci: "K4_JUDUL", ikon: "laporan" },
    { href: "/kawasan/tps", kunci: "TPS_JUDUL", ikon: "tps" },
    { href: "/notifikasi", kunci: "NTF_JUDUL", ikon: "lonceng" },
    { href: "/akun", kunci: "AKUN_JUDUL", ikon: "akun" },
  ],
  PENERIMA: [
    { href: "/penerima", kunci: "P1_JUDUL", ikon: "beranda" },
    { href: "/penerima/laporan", kunci: "P2_JUDUL", ikon: "laporan" },
    { href: "/notifikasi", kunci: "NTF_JUDUL", ikon: "lonceng" },
    { href: "/akun", kunci: "AKUN_JUDUL", ikon: "akun" },
  ],
  ADMIN: [
    { href: "/admin", kunci: "ADM_JUDUL", ikon: "admin" },
    { href: "/akun", kunci: "AKUN_JUDUL", ikon: "akun" },
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
  const navBawah = nav.filter((n) => n.href !== "/notifikasi");
  const ruteHome = peran ? RUTE_HOME[peran] : "/";
  const namaPeran = peran ? TEKS[KUNCI_PERAN[peran]] : TEKS.APP_NAMA;
  const ikonPeran: NamaIkon = peran ? IKON_PERAN[peran] : "aturan";

  async function keluar() {
    await panggil("POST", "/api/auth/keluar");
    router.push("/masuk");
  }

  const adalahAktif = (href: string) =>
    jalur === href ||
    (href !== "/" &&
      jalur.startsWith(`${href}/`) &&
      !nav.some((m) => m.href.length > href.length && jalur.startsWith(m.href)));

  const notifAktif = jalur === "/notifikasi";

  return (
    <div className={`${poppins.className} min-h-dvh bg-latar text-tinta`}>
      {MOCK_AKTIF && !adalahPanelDemo ? <LabelDemo /> : null}

      {/* Sidebar desktop (dashboard) */}
      {!adalahPanelDemo ? (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-garis-halus bg-kertas p-4 lg:flex">
          <Link href={ruteHome} aria-label={TEKS.APP_NAMA} className="group px-2 py-2">
            <LogoSerah ukuran="md" />
          </Link>

          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-latar p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
              <IkonLanding nama={ikonPeran} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-tinta">{namaPeran}</p>
              {sesi.organisasiAktif ? (
                <p className="truncate text-xs text-tinta-redup">{sesi.organisasiAktif.nama}</p>
              ) : null}
            </div>
          </div>

          <nav aria-label="Navigasi desktop" className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto">
            {nav.map((n) => {
              const aktif = adalahAktif(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 ${
                    aktif
                      ? "bg-tinta text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
                      : "text-tinta-redup hover:bg-aksi-latar hover:text-aksi"
                  }`}
                >
                  <IkonNav nama={n.ikon} className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                  <span className="truncate">{TEKS[n.kunci]}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => void keluar()}
            className="mt-3 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-tinta-redup transition-colors duration-200 hover:bg-latar hover:text-tinta"
          >
            <IkonNav nama="keluar" className="h-5 w-5" />
            <span>{TEKS.UMUM_KELUAR}</span>
          </button>
        </aside>
      ) : null}

      <div className={adalahPanelDemo ? "" : "lg:pl-[264px]"}>
        {/* Bilah atas kaca: HP dan desktop */}
        <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 px-3 py-2 shadow-[0_8px_30px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-garis-halus/70 backdrop-blur-xl backdrop-saturate-150">
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
              <Link
                href="/notifikasi"
                aria-label={TEKS.NTF_JUDUL}
                aria-current={notifAktif ? "page" : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                  notifAktif ? "bg-tinta text-white" : "bg-latar text-tinta hover:bg-aksi-latar hover:text-aksi"
                }`}
              >
                <IkonNav nama="lonceng" className="h-5 w-5" />
              </Link>
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

        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:pb-12">
          <div className={peran === "PETUGAS" || peran === "PENGANGKUT" ? "mx-auto w-full max-w-2xl" : ""}>
            {boleh ? children : <BannerGalat pesan={TEKS.G_PERAN_TIDAK_BOLEH} />}
          </div>
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
                  {aktif ? <span className="truncate">{TEKS[n.kunci]}</span> : null}
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
