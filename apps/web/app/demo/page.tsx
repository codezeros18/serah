"use client";

import { useState } from "react";
import Link from "next/link";
import { LabelDemo, Tombol } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "@/lib/klien/api";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

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
}

const DAFTAR_PANEL: readonly PanelInfo[] = [
  {
    id: "petugas",
    peran: TEKS.PERAN_PETUGAS,
    url: "/petugas?panel=petugas",
    title: "Panel Petugas",
    lencanaKelas: "border-emerald-600 bg-emerald-50 text-emerald-800",
    nomorUrut: "1",
    tugasRingkas: TEKS.T1_JUDUL,
    tipe: "hp",
    deskripsi: "Pekerja Lapangan HP",
  },
  {
    id: "pengangkut",
    peran: TEKS.PERAN_PENGANGKUT,
    url: "/pengangkut?panel=pengangkut",
    title: "Panel Pengangkut",
    lencanaKelas: "border-aksi bg-aksi-latar text-aksi",
    nomorUrut: "2",
    tugasRingkas: TEKS.A2_FOTO,
    tipe: "hp",
    deskripsi: "Sopir Truk HP",
  },
  {
    id: "kawasan",
    peran: TEKS.PERAN_PENGELOLA,
    url: "/kawasan?panel=pengelola",
    title: "Panel Pengelola",
    lencanaKelas: "border-purple-600 bg-purple-50 text-purple-800",
    nomorUrut: "3",
    tugasRingkas: TEKS.K1_JUDUL,
    tipe: "desktop",
    deskripsi: "Pengelola Kawasan Desktop",
  },
  {
    id: "penerima",
    peran: TEKS.PERAN_PENERIMA,
    url: "/penerima?panel=penerima",
    title: "Panel Penerima",
    lencanaKelas: "border-amber-600 bg-amber-50 text-amber-800",
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
    <div className="flex min-h-dvh flex-col bg-latar text-tinta">
      <LabelDemo />

      {/* Header Interaktif Demo */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-garis-halus bg-kertas/95 backdrop-blur px-4 py-3 sm:px-6 shadow-xs">
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2" aria-label={TEKS.APP_NAMA}>
            <LogoSerah ukuran="sm" />
          </Link>
          <span className="rounded-full border border-aksi/25 bg-aksi-latar px-2.5 py-0.5 text-xs font-bold text-aksi shadow-2xs">
            Demo 4-Layar Interaktif
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Tombol
            varian="sekunder"
            onClick={handleResetDemo}
            disabled={sedangReset}
            data-testid="tombol-reset-demo"
            className="min-h-10 px-4 py-2 text-xs font-bold shadow-2xs hover:border-aksi hover:text-aksi"
          >
            {sedangReset ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>{TEKS.UMUM_MUAT}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true">↺</span>
                <span>{TEKS.DEMO_RESET}</span>
              </span>
            )}
          </Tombol>
        </div>
      </header>

      {/* Feedback Banner */}
      {pesanSukses ? (
        <div
          role="status"
          className="mx-4 mt-3 rounded-kartu border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-xs sm:mx-6 flex items-center gap-2"
        >
          <span className="text-emerald-700 font-bold" aria-hidden="true">✓</span>
          <span>{pesanSukses}</span>
        </div>
      ) : null}

      {pesanGalat ? (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-kartu border border-peringatan-garis bg-peringatan-latar px-4 py-3 text-sm font-semibold text-peringatan shadow-xs sm:mx-6"
        >
          {pesanGalat}
        </div>
      ) : null}

      {/* Navigasi Tab / Switcher Cepat */}
      <div className="border-b border-garis-halus bg-kertas px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loncatKePanel(null)}
              className={`rounded-kontrol px-3 py-1.5 text-xs font-bold transition-all ${
                sorotanPanel === null
                  ? "bg-aksi text-aksi-teks shadow-2xs"
                  : "border border-garis-halus bg-latar text-tinta hover:bg-kertas"
              }`}
            >
              Semua Panel (4 Layar)
            </button>
            {DAFTAR_PANEL.map((panel) => (
              <button
                key={panel.id}
                type="button"
                onClick={() => loncatKePanel(panel.id)}
                className={`flex items-center gap-1.5 rounded-kontrol px-3 py-1.5 text-xs font-bold transition-all ${
                  sorotanPanel === panel.id
                    ? "bg-aksi text-aksi-teks shadow-2xs"
                    : "border border-garis-halus bg-latar text-tinta hover:bg-kertas"
                }`}
              >
                <span>{panel.nomorUrut}.</span>
                <span>{panel.peran}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split Panels */}
      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {DAFTAR_PANEL.map((panel) => {
              const adalahSorot = sorotanPanel === panel.id;
              return (
                <section
                  key={panel.id}
                  id={`panel-${panel.id}`}
                  className={`flex flex-col gap-3 rounded-kartu border bg-kertas p-4 shadow-sm transition-all duration-200 ${
                    adalahSorot
                      ? "border-aksi ring-2 ring-aksi/20 shadow-md"
                      : "border-garis-halus hover:border-garis"
                  }`}
                  aria-label={panel.title}
                >
                  {/* Header Panel dengan Role Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-garis-halus pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aksi text-white text-xs font-black">
                        {panel.nomorUrut}
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-tinta">
                        {panel.peran}
                      </h2>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${panel.lencanaKelas}`}
                      >
                        {panel.tugasRingkas}
                      </span>
                    </div>

                    <a
                      href={panel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-aksi hover:underline"
                    >
                      <span>Buka Tab Baru</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>

                  {/* Device-style Container for iframe */}
                  {panel.tipe === "hp" ? (
                    <div className="mx-auto w-full max-w-[400px] rounded-[32px] border-[6px] border-slate-900 bg-slate-900 p-1 shadow-2xl">
                      <div className="flex items-center justify-center py-1">
                        <div className="h-3 w-20 rounded-full bg-slate-800" />
                      </div>
                      <div className="overflow-hidden rounded-[24px] bg-latar">
                        <iframe
                          key={`${panel.id}-${kunciIframe}`}
                          src={panel.url}
                          title={panel.title}
                          className="h-[620px] w-full border-0 bg-latar"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full overflow-hidden rounded-xl border border-garis bg-kertas shadow-lg">
                      <div className="flex items-center gap-2 border-b border-garis-halus bg-slate-100 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        </div>
                        <div className="mx-auto rounded-md bg-kertas px-3 py-0.5 font-mono text-[11px] text-tinta-redup shadow-2xs">
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
