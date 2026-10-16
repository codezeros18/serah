"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { LogoSerah } from "./logo-serah";

const NAV = [
  { href: "/#mvp", teks: TEKS.LANDING_NAV_PRODUK },
  { href: "/#fitur", teks: TEKS.LANDING_NAV_FITUR },
  { href: "/#harga", teks: TEKS.HRG_JUDUL },
  { href: "/#tentang", teks: TEKS.LANDING_NAV_TENTANG },
] as const;

/**
 * Navbar pill kaca yang sticky. Di layar lebar: link di tengah, Demo & Masuk di kanan.
 * Di layar sempit: semuanya masuk hamburger yang membuka ke bawah dengan animasi halus
 * (tinggi dianimasikan lewat grid-template-rows, tanpa mengukur DOM).
 */
export function NavbarGlass() {
  const [buka, setBuka] = useState(false);
  const idMenu = useId();

  useEffect(() => {
    if (!buka) return;
    const tutupDenganEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    const tutupSaatMelebar = () => {
      if (window.innerWidth >= 768) setBuka(false);
    };
    window.addEventListener("keydown", tutupDenganEsc);
    window.addEventListener("resize", tutupSaatMelebar);
    return () => {
      window.removeEventListener("keydown", tutupDenganEsc);
      window.removeEventListener("resize", tutupSaatMelebar);
    };
  }, [buka]);

  const tutup = () => setBuka(false);

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto max-w-6xl rounded-2xl border border-white/70 bg-white/55 shadow-[0_8px_30px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-garis-halus/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Link href="/" aria-label={TEKS.APP_NAMA} className="group" onClick={tutup}>
            <LogoSerah ukuran="sm" />
          </Link>

          <nav
            aria-label="Navigasi utama"
            className="hidden items-center gap-8 text-sm font-medium text-tinta md:flex"
          >
            {NAV.map((n) => (
              <Link
                key={n.teks}
                href={n.href}
                className="relative py-1 transition-colors duration-200 hover:text-aksi after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-aksi after:transition-transform after:duration-300 hover:after:scale-x-100"
              >
                {n.teks}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/demo"
                className="inline-flex min-h-10 items-center rounded-lg bg-latar px-3.5 text-sm font-medium text-tinta transition-colors duration-200 hover:bg-aksi-latar hover:text-aksi"
              >
                {TEKS.LANDING_NAV_PANEL}
              </Link>
              <Link
                href="/masuk"
                className="inline-flex min-h-10 items-center rounded-lg bg-tinta px-3.5 text-sm font-medium text-white transition-all duration-200 hover:bg-aksi hover:shadow-[0_6px_16px_rgba(36,87,197,0.30)]"
              >
                {TEKS.LANDING_NAV_MASUK}
              </Link>
            </div>

            <button
              type="button"
              aria-expanded={buka}
              aria-controls={idMenu}
              aria-label={buka ? "Tutup menu" : "Buka menu"}
              onClick={() => setBuka((b) => !b)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-latar transition-colors duration-200 hover:bg-aksi-latar md:hidden"
            >
              <span
                aria-hidden="true"
                className={`absolute h-0.5 w-5 rounded-full bg-tinta transition-all duration-300 ${
                  buka ? "rotate-45" : "-translate-y-1.5"
                }`}
              />
              <span
                aria-hidden="true"
                className={`absolute h-0.5 w-5 rounded-full bg-tinta transition-all duration-300 ${
                  buka ? "scale-x-0 opacity-0" : ""
                }`}
              />
              <span
                aria-hidden="true"
                className={`absolute h-0.5 w-5 rounded-full bg-tinta transition-all duration-300 ${
                  buka ? "-rotate-45" : "translate-y-1.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Dropdown mobile: tinggi 0fr -> 1fr, isi muncul berurutan */}
        <div
          id={idMenu}
          inert={!buka}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:hidden ${
            buka ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <nav aria-label="Menu seluler" className="flex flex-col gap-1 border-t border-garis-halus/70 p-3">
              {NAV.map((n, i) => (
                <Link
                  key={n.teks}
                  href={n.href}
                  onClick={tutup}
                  style={{ transitionDelay: buka ? `${60 + i * 45}ms` : "0ms" }}
                  className={`rounded-xl px-3 py-3 text-base font-medium text-tinta transition-all duration-300 hover:bg-aksi-latar hover:text-aksi motion-reduce:transition-none ${
                    buka ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                  }`}
                >
                  {n.teks}
                </Link>
              ))}
              <div
                style={{ transitionDelay: buka ? `${60 + NAV.length * 45}ms` : "0ms" }}
                className={`mt-2 grid grid-cols-2 gap-2 transition-all duration-300 motion-reduce:transition-none ${
                  buka ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                }`}
              >
                <Link
                  href="/demo"
                  onClick={tutup}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-latar px-4 text-sm font-medium text-tinta transition-colors hover:bg-aksi-latar hover:text-aksi"
                >
                  {TEKS.LANDING_NAV_PANEL}
                </Link>
                <Link
                  href="/masuk"
                  onClick={tutup}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-tinta px-4 text-sm font-medium text-white transition-colors hover:bg-aksi"
                >
                  {TEKS.LANDING_NAV_MASUK}
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
