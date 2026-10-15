"use client";

import { useState } from "react";
import Link from "next/link";
import { LabelDemo } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "@/lib/klien/api";
import { Poppins } from "next/font/google";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";
import { IkonLanding, type NamaIkon } from "@/lib/klien/komponen/ikon-landing";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

interface PanelInfo {
  id: string;
  peran: string;
  url: string;
  title: string;
  lencanaKelas: string;
  nomorUrut: string;
  tugasRingkas: string;
  tipe: "hp" | "desktop";
  deskripsi: string;
  ikon: NamaIkon;
}

const DAFTAR_PANEL: readonly PanelInfo[] = [
  {
    id: "petugas",
    ikon: "tps",
    peran: TEKS.PERAN_PETUGAS,
    url: "/petugas?panel=petugas",
    title: "Panel Petugas",
    lencanaKelas: "border-garis-halus bg-latar text-tinta",
    nomorUrut: "1",
    tugasRingkas: TEKS.T1_JUDUL,
    tipe: "hp",
    deskripsi: "Pekerja Lapangan HP",
  },
  {
    id: "pengangkut",
    ikon: "truk",
    peran: TEKS.PERAN_PENGANGKUT,
    url: "/pengangkut?panel=pengangkut",
    title: "Panel Pengangkut",
    lencanaKelas: "border-garis-halus bg-latar text-tinta",
    nomorUrut: "2",
    tugasRingkas: TEKS.A2_FOTO,
    tipe: "hp",
    deskripsi: "Sopir Truk HP",
  },
  {
    id: "kawasan",
    ikon: "laporan",
    peran: TEKS.PERAN_PENGELOLA,
    url: "/kawasan?panel=pengelola",
    title: "Panel Pengelola",
    lencanaKelas: "border-garis-halus bg-latar text-tinta",
    nomorUrut: "3",
    tugasRingkas: TEKS.K1_JUDUL,
    tipe: "desktop",
    deskripsi: "Pengelola Kawasan Desktop",
  },
  {
    id: "penerima",
    ikon: "timbang",
    peran: TEKS.PERAN_PENERIMA,
    url: "/penerima?panel=penerima",
    title: "Panel Penerima",
    lencanaKelas: "border-garis-halus bg-latar text-tinta",
    nomorUrut: "4",
    tugasRingkas: TEKS.P1_JUDUL,
    tipe: "desktop",
    deskripsi: "Penerima Olahan Desktop",
  },
] as const;

export default function HalamanDemo() {
  const [sedangReset, setSedangReset] = useState(false);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [kunciIframe, setKunciIframe] = useState(0);
  const [sorotanPanel, setSorotanPanel] = useState<string | null>(null);

  async function handleResetDemo() {
    setSedangReset(true);
    setPesanSukses(null);
    setPesanGalat(null);
    try {
      const res = await panggil("POST", "/api/admin/demo/reset", { body: {} });
      if (res.ok) {
        setPesanSukses(TEKS.DEMO_RESET_SELESAI);
        setKunciIframe((k) => k + 1);
      } else {
        setPesanGalat(res.pesan);
      }
    } catch {
      setPesanGalat(TEKS.G_SERVER);
    } finally {
      setSedangReset(false);
    }
  }

  function loncatKePanel(id: string | null) {
    setSorotanPanel(id);
    if (id) {
      const el = document.getElementById(`panel-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  return (
    <div className={`${poppins.className} flex min-h-dvh flex-col bg-kertas text-tinta`}>
      <LabelDemo />

      {/* Header kaca sticky, sama dengan beranda */}
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/55 px-4 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-garis-halus/70 backdrop-blur-xl backdrop-saturate-150">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-center gap-2" aria-label={TEKS.APP_NAMA}>
              <LogoSerah ukuran="sm" />
            </Link>
            <span className="hidden rounded-full border border-aksi-garis bg-aksi-latar px-2.5 py-0.5 text-xs font-medium text-aksi sm:inline-flex">
              Demo 4-Layar Interaktif
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={sedangReset}
              data-testid="tombol-reset-demo"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-tinta px-3.5 text-sm font-medium text-white transition-all duration-200 hover:bg-aksi hover:shadow-[0_6px_16px_rgba(36,87,197,0.30)] disabled:opacity-60"
            >
              {sedangReset ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>{TEKS.UMUM_MUAT}</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">↺</span>
                  <span>{TEKS.DEMO_RESET}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Feedback Banner */}
      {pesanSukses ? (
        <div
          role="status"
          className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-status-selesai/20 bg-status-selesai-latar px-4 py-3 text-sm font-medium text-status-selesai sm:mx-6"
        >
          <span aria-hidden="true">✓</span>
          <span>{pesanSukses}</span>
        </div>
      ) : null}

      {pesanGalat ? (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-2xl border border-peringatan-garis/30 bg-peringatan-latar px-4 py-3 text-sm font-medium text-peringatan sm:mx-6"
        >
          {pesanGalat}
        </div>
      ) : null}

      {/* Switcher cepat */}
      <div className="px-4 pt-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => loncatKePanel(null)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
              sorotanPanel === null
                ? "border-tinta bg-tinta text-white"
                : "border-garis-halus bg-kertas text-tinta hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
            }`}
          >
            Semua Panel (4 Layar)
          </button>
          {DAFTAR_PANEL.map((panel) => (
            <button
              key={panel.id}
              type="button"
              onClick={() => loncatKePanel(panel.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                sorotanPanel === panel.id
                  ? "border-tinta bg-tinta text-white"
                  : "border-garis-halus bg-kertas text-tinta hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
              }`}
            >
              <IkonLanding nama={panel.ikon} className="h-4 w-4" />
              <span>{panel.nomorUrut}.</span>
              <span>{panel.peran}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Panels */}
      <main className="flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {DAFTAR_PANEL.map((panel) => {
              const adalahSorot = sorotanPanel === panel.id;
              return (
                <section
                  key={panel.id}
                  id={`panel-${panel.id}`}
                  className={`muncul flex flex-col gap-4 rounded-3xl border bg-kertas p-5 transition-all duration-300 ${
                    adalahSorot
                      ? "border-aksi shadow-[0_16px_48px_rgba(36,87,197,0.18)]"
                      : "border-garis-halus shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.12)]"
                  }`}
                  aria-label={panel.title}
                >
                  {/* Header Panel dengan Role Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-garis-halus pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-latar">
                        <IkonLanding nama={panel.ikon} className="h-6 w-6" />
                      </span>
                      <h2 className="text-base font-semibold tracking-tight text-tinta sm:text-lg">
                        {panel.peran}
                      </h2>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${panel.lencanaKelas}`}
                      >
                        {panel.tugasRingkas}
                      </span>
                    </div>

                    <a
                      href={panel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-aksi transition-colors hover:bg-aksi-latar"
                    >
                      <span>Buka Tab Baru</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>

                  {/* Device-style Container for iframe */}
                  {panel.tipe === "hp" ? (
                    <div className="mx-auto w-full max-w-[400px] rounded-[40px] border-[6px] border-tinta bg-tinta p-1 shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
                      <div className="flex items-center justify-center py-1">
                        <div className="h-3 w-20 rounded-full bg-white/15" />
                      </div>
                      <div className="overflow-hidden rounded-[30px] bg-kertas">
                        <iframe
                          key={`${panel.id}-${kunciIframe}`}
                          src={panel.url}
                          title={panel.title}
                          className="h-[620px] w-full border-0 bg-latar"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full overflow-hidden rounded-2xl border border-garis-halus bg-kertas shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
                      <div className="flex items-center gap-2 border-b border-garis-halus bg-latar px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-garis" />
                          <span className="h-2.5 w-2.5 rounded-full bg-garis" />
                          <span className="h-2.5 w-2.5 rounded-full bg-garis" />
                        </div>
                        <div className="mx-auto rounded-lg bg-kertas px-3 py-0.5 font-mono text-[11px] text-tinta-redup">
                          serah.id{panel.url.split("?")[0]}
                        </div>
                      </div>
                      <iframe
                        key={`${panel.id}-${kunciIframe}`}
                        src={panel.url}
                        title={panel.title}
                        className="h-[620px] w-full border-0 bg-latar"
                      />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
