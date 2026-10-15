"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Peran } from "@serah/kontrak/enum";
import { TEKS, type KunciTeks } from "@serah/kontrak/teks";
import { BannerGalat, LabelDemo, Tombol } from "@serah/ui";
import { MOCK_AKTIF, panggil } from "../api";
import { ProviderSesi, useSesi } from "../sesi";
import { LogoSerah } from "./logo-serah";

type ItemNav = { href: string; kunci: KunciTeks };

const NAV: Record<Peran, readonly ItemNav[]> = {
  PETUGAS: [
    { href: "/petugas", kunci: "T1_JUDUL" },
    { href: "/petugas/serah", kunci: "T2_JUDUL" },
    { href: "/notifikasi", kunci: "NTF_JUDUL" },
    { href: "/akun", kunci: "AKUN_JUDUL" },
  ],
  PENGANGKUT: [
    { href: "/pengangkut", kunci: "A1_JUDUL" },
    { href: "/pengangkut/kendaraan", kunci: "KND_JUDUL" },
    { href: "/pengangkut/laporan", kunci: "LAPORAN_PENGANGKUT" },
    { href: "/notifikasi", kunci: "NTF_JUDUL" },
    { href: "/akun", kunci: "AKUN_JUDUL" },
  ],
  PENGELOLA: [
    { href: "/kawasan", kunci: "K1_JUDUL" },
    { href: "/kawasan/ditolak", kunci: "K3_JUDUL" },
    { href: "/kawasan/laporan", kunci: "K4_JUDUL" },
    { href: "/kawasan/tps", kunci: "TPS_JUDUL" },
    { href: "/notifikasi", kunci: "NTF_JUDUL" },
    { href: "/akun", kunci: "AKUN_JUDUL" },
  ],
  PENERIMA: [
    { href: "/penerima", kunci: "P1_JUDUL" },
    { href: "/penerima/laporan", kunci: "P2_JUDUL" },
    { href: "/notifikasi", kunci: "NTF_JUDUL" },
    { href: "/akun", kunci: "AKUN_JUDUL" },
  ],
  ADMIN: [
    { href: "/admin", kunci: "ADM_JUDUL" },
    { href: "/akun", kunci: "AKUN_JUDUL" },
  ],
};

const KUNCI_PERAN: Record<Peran, KunciTeks> = {
  PETUGAS: "PERAN_PETUGAS",
  PENGELOLA: "PERAN_PENGELOLA",
  PENGANGKUT: "PERAN_PENGANGKUT",
  PENERIMA: "PERAN_PENERIMA",
  ADMIN: "PERAN_ADMIN",
};

/** Segmen rute yang hanya boleh dibuka satu peran. */
const PERAN_SEGMEN: Record<string, Peran> = {
  petugas: "PETUGAS",
  pengangkut: "PENGANGKUT",
  kawasan: "PENGELOLA",
  penerima: "PENERIMA",
  admin: "ADMIN",
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
      <div className="flex min-h-dvh items-center justify-center p-6 text-base">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-aksi border-t-transparent" />
          <p role="status" className="text-sm font-semibold text-tinta-redup">
            {TEKS.UMUM_MUAT}
          </p>
        </div>
      </div>
    );
  }
  if (keadaan.status === "galat") {
    return (
      <div className="p-4">
        <BannerGalat pesan={keadaan.pesan} onCoba={muatUlang} />
      </div>
    );
  }

  const { sesi } = keadaan;
  const peran = sesi.peran;
  const wajib = PERAN_SEGMEN[jalur.split("/")[1] ?? ""];
  const boleh = !wajib || wajib === peran;
  const nav = peran ? NAV[peran] : [];

  async function keluar() {
    await panggil("POST", "/api/auth/keluar");
    router.push("/masuk");
  }

  // Rute utama per peran untuk logo
  const ruteHome = peran
    ? peran === "PETUGAS"
      ? "/petugas"
      : peran === "PENGELOLA"
        ? "/kawasan"
        : peran === "PENGANGKUT"
          ? "/pengangkut"
          : peran === "PENERIMA"
            ? "/penerima"
            : "/admin"
    : "/";

  const peranDesktop = peran === "PENGELOLA" || peran === "PENERIMA" || peran === "ADMIN";
  const batasLebar = peranDesktop ? "max-w-6xl" : "max-w-xl";

  return (
    <div className="min-h-dvh bg-latar text-tinta flex flex-col">
      {/* Accent Line Brand #2457c5 */}
      <div className="h-1 bg-gradient-to-r from-aksi via-blue-500 to-indigo-600 w-full shrink-0" />

      {MOCK_AKTIF && !adalahPanelDemo ? <LabelDemo /> : null}

      {/* App Shell Header */}
      <header className={`sticky top-0 z-30 border-b border-garis-halus bg-kertas/95 backdrop-blur-md px-4 shadow-xs ${adalahPanelDemo ? "py-2" : "py-3"}`}>
        <div className={`mx-auto flex ${batasLebar} items-center justify-between gap-4`}>
          {/* Sisi Kiri: Logo SERAH & Info Pengguna/Organisasi */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {!adalahPanelDemo ? (
              <>
                <Link href={ruteHome} className="shrink-0 group flex items-center gap-2" aria-label={TEKS.APP_NAMA}>
                  <LogoSerah ukuran="sm" denganTeks={true} />
                </Link>
                <div className="h-6 w-px bg-garis-halus hidden sm:block" />
              </>
            ) : null}
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-bold text-tinta">
                  {peran ? TEKS[KUNCI_PERAN[peran]] : TEKS.APP_NAMA}
                </span>
                {peran ? (
                  <span className="rounded-full border border-aksi/20 bg-aksi-latar px-2 py-0.5 text-[10px] font-black text-aksi uppercase tracking-wide">
                    {peran}
                  </span>
                ) : null}
              </div>
              {sesi.organisasiAktif ? (
                <p className="truncate text-[11px] text-tinta-redup font-medium">
                  {sesi.organisasiAktif.nama}
                </p>
              ) : null}
            </div>
          </div>

          {/* Desktop Sub-Nav for Desk Roles */}
          {peranDesktop && nav.length > 0 ? (
            <nav aria-label="Navigasi Desktop" className="hidden lg:flex items-center gap-1">
              {nav.map((n) => {
                const aktif =
                  jalur === n.href ||
                  (n.href !== "/" &&
                    jalur.startsWith(`${n.href}/`) &&
                    !nav.some((m) => m.href.length > n.href.length && jalur.startsWith(m.href)));
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={aktif ? "page" : undefined}
                    className={`px-3 py-1.5 rounded-kontrol text-xs font-bold transition-all ${
                      aktif
                        ? "bg-aksi text-white shadow-2xs"
                        : "text-tinta-redup hover:text-aksi hover:bg-aksi-latar/50"
                    }`}
                  >
                    {TEKS[n.kunci]}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          {/* Sisi Kanan: Notifikasi & Tombol Keluar */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/notifikasi"
              className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-kontrol border px-2.5 py-1 text-xs font-bold transition-all shadow-2xs ${
                jalur === "/notifikasi"
                  ? "border-aksi bg-aksi text-white"
                  : "border-garis-halus bg-kertas text-tinta hover:border-aksi hover:text-aksi hover:bg-aksi-latar/40"
              }`}
              aria-label={TEKS.NTF_JUDUL}
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true">🔔</span>
                <span className="hidden sm:inline">{TEKS.NTF_JUDUL}</span>
              </span>
            </Link>

            {!adalahPanelDemo ? (
              <Tombol
                varian="sekunder"
                onClick={() => void keluar()}
                className="min-h-9 px-3.5 py-1 text-xs font-bold"
              >
                {TEKS.UMUM_KELUAR}
              </Tombol>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`mx-auto w-full ${batasLebar} flex-1 p-4 sm:p-6 ${peranDesktop ? "pb-12" : "pb-28 sm:pb-32"}`}>
        {boleh ? children : <BannerGalat pesan={TEKS.G_PERAN_TIDAK_BOLEH} />}
      </main>

      {/* Fixed Bottom Navigation Bar (Hidden on desktop for desktop roles) */}
      <nav
        aria-label={TEKS.APP_NAMA}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-garis-halus bg-kertas/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.06)] ${
          peranDesktop ? "lg:hidden" : ""
        }`}
      >
        <ul className={`mx-auto flex ${batasLebar} items-center justify-around px-2`}>
          {nav.map((n) => {
            const aktif =
              jalur === n.href ||
              (n.href !== "/" &&
                jalur.startsWith(`${n.href}/`) &&
                !nav.some((m) => m.href.length > n.href.length && jalur.startsWith(m.href)));
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1 text-center transition-all ${
                    aktif
                      ? "text-aksi font-bold border-t-2 border-aksi bg-aksi-latar/40"
                      : "text-tinta-redup hover:text-aksi hover:bg-latar/50 font-medium border-t-2 border-transparent"
                  }`}
                >
                  <span className="text-xs sm:text-sm tracking-tight truncate max-w-[120px]">
                    {TEKS[n.kunci]}
                  </span>
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
