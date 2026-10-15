"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { Peran } from "@serah/kontrak/enum";
import { TEKS, type KunciTeks } from "@serah/kontrak/teks";
import { BannerGalat, LabelDemo, Tombol } from "@serah/ui";
import { MOCK_AKTIF, panggil } from "../api";
import { ProviderSesi, useSesi } from "../sesi";

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
      <p role="status" className="p-6 text-base">
        {TEKS.UMUM_MUAT}
      </p>
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-latar">
      {MOCK_AKTIF ? <LabelDemo /> : null}
      <header className="flex items-center gap-3 border-b border-garis-halus bg-kertas px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{peran ? TEKS[KUNCI_PERAN[peran]] : TEKS.APP_NAMA}</p>
          {sesi.organisasiAktif ? <p className="truncate text-sm text-tinta-redup">{sesi.organisasiAktif.nama}</p> : null}
        </div>
        <Link href="/notifikasi" className="inline-flex min-h-12 items-center rounded-kontrol px-3 text-base font-semibold underline">
          {TEKS.NTF_JUDUL}
        </Link>
        <Tombol varian="sekunder" onClick={() => void keluar()}>
          {TEKS.UMUM_KELUAR}
        </Tombol>
      </header>
      <main className="flex-1 p-4 pb-24">
        {boleh ? children : <BannerGalat pesan={TEKS.G_PERAN_TIDAK_BOLEH} />}
      </main>
      <nav
        aria-label={TEKS.APP_NAMA}
        className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-garis bg-kertas"
      >
        <ul className="mx-auto flex max-w-3xl">
          {nav.map((n) => {
            const aktif = jalur === n.href || (n.href !== "/" && jalur.startsWith(`${n.href}/`) && !nav.some((m) => m.href.length > n.href.length && jalur.startsWith(m.href)));
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`flex min-h-14 items-center justify-center px-1 text-center text-sm font-semibold ${
                    aktif ? "border-t-4 border-aksi text-aksi" : "border-t-4 border-transparent text-tinta"
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
