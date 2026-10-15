"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-latar text-tinta">
      {MOCK_AKTIF ? <LabelDemo /> : null}

      {/* App Shell Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-garis-halus bg-kertas/95 backdrop-blur px-4 py-2.5 shadow-xs">
        {/* Sisi Kiri: Logo SERAH & Info Pengguna/Organisasi */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href={ruteHome} className="shrink-0 group" aria-label={TEKS.APP_NAMA}>
            <LogoSerah ukuran="sm" denganTeks={false} />
          </Link>
          <div className="min-w-0 flex-1 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-extrabold text-tinta">
                {peran ? TEKS[KUNCI_PERAN[peran]] : TEKS.APP_NAMA}
              </span>
              {peran ? (
                <span className="hidden sm:inline-block rounded-full border border-aksi/25 bg-aksi-latar px-2 py-0.2 text-[10px] font-black text-aksi uppercase">
                  {peran}
                </span>
              ) : null}
            </div>
            {sesi.organisasiAktif ? (
              <p className="truncate text-xs text-tinta-redup font-medium">
                {sesi.organisasiAktif.nama}
              </p>
            ) : null}
          </div>
        </div>

        {/* Sisi Kanan: Notifikasi & Tombol Keluar */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/notifikasi"
            className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-kontrol border px-3 py-1.5 text-xs font-bold transition-all ${
              jalur === "/notifikasi"
                ? "border-aksi bg-aksi text-aksi-teks"
                : "border-garis-halus bg-kertas text-tinta hover:border-aksi hover:text-aksi hover:bg-aksi-latar/40"
            }`}
            aria-label={TEKS.NTF_JUDUL}
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">🔔</span>
              <span className="hidden sm:inline">{TEKS.NTF_JUDUL}</span>
            </span>
          </Link>

          <Tombol
            varian="sekunder"
            onClick={() => void keluar()}
            className="min-h-10 px-3 py-1.5 text-xs font-bold"
          >
            {TEKS.UMUM_KELUAR}
          </Tombol>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 pb-24">
        {boleh ? children : <BannerGalat pesan={TEKS.G_PERAN_TIDAK_BOLEH} />}
      </main>

      {/* Fixed Bottom Navigation Bar */}
      <nav
        aria-label={TEKS.APP_NAMA}
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-garis bg-kertas/95 backdrop-blur shadow-lg"
      >
        <ul className="mx-auto flex max-w-3xl">
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
                  className={`flex min-h-14 items-center justify-center px-1 text-center text-sm transition-all ${
                    aktif
                      ? "border-t-4 border-aksi text-aksi bg-aksi-latar/40 font-bold"
                      : "border-t-4 border-transparent text-tinta hover:text-aksi hover:bg-latar/50 font-medium"
                  }`}
                >
                  {TEKS[n.kunci]}
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
