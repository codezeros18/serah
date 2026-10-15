"use client";

import { useState } from "react";
import Link from "next/link";
import { LabelDemo, Tombol } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "@/lib/klien/api";

interface PanelInfo {
  id: string;
  peran: string;
  url: string;
  title: string;
}

const DAFTAR_PANEL: readonly PanelInfo[] = [
  {
    id: "petugas",
    peran: TEKS.PERAN_PETUGAS,
    url: "/petugas?panel=petugas",
    title: "Panel Petugas",
  },
  {
    id: "pengangkut",
    peran: TEKS.PERAN_PENGANGKUT,
    url: "/pengangkut?panel=pengangkut",
    title: "Panel Pengangkut",
  },
  {
    id: "kawasan",
    peran: TEKS.PERAN_PENGELOLA,
    url: "/kawasan?panel=pengelola",
    title: "Panel Pengelola",
  },
  {
    id: "penerima",
    peran: TEKS.PERAN_PENERIMA,
    url: "/penerima?panel=penerima",
    title: "Panel Penerima",
  },
] as const;

export default function HalamanDemo() {
  const [sedangReset, setSedangReset] = useState(false);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [kunciIframe, setKunciIframe] = useState(0);

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

  return (
    <div className="flex min-h-dvh flex-col bg-latar">
      <LabelDemo />

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-garis-halus bg-kertas px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold text-tinta">
            {TEKS.APP_NAMA}
          </Link>
          <span className="rounded-kontrol border border-garis bg-latar px-2 py-0.5 text-xs font-semibold text-tinta">
            Demo Mode
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Tombol
            varian="sekunder"
            onClick={handleResetDemo}
            disabled={sedangReset}
            data-testid="tombol-reset-demo"
          >
            {sedangReset ? TEKS.UMUM_MUAT : TEKS.DEMO_RESET}
          </Tombol>
        </div>
      </header>

      {pesanSukses ? (
        <div
          role="status"
          className="mx-4 mt-3 rounded-kartu border border-garis-halus bg-kertas px-4 py-3 text-sm font-semibold text-tinta shadow-sm sm:mx-6"
        >
          {pesanSukses}
        </div>
      ) : null}

      {pesanGalat ? (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-kartu border border-peringatan-garis bg-peringatan-latar px-4 py-3 text-sm font-semibold text-peringatan shadow-sm sm:mx-6"
        >
          {pesanGalat}
        </div>
      ) : null}

      <main className="flex-1 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {DAFTAR_PANEL.map((panel) => (
            <section
              key={panel.id}
              className="flex flex-col gap-2 rounded-kartu border border-garis-halus bg-kertas p-4 shadow-sm"
              aria-label={panel.title}
            >
              <div className="flex items-center justify-between border-b border-garis-halus pb-2">
                <h2 className="text-lg font-bold text-tinta">{panel.peran}</h2>
                <a
                  href={panel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-tinta-redup hover:underline"
                >
                  {panel.url}
                </a>
              </div>
              <iframe
                key={`${panel.id}-${kunciIframe}`}
                src={panel.url}
                title={panel.title}
                className="h-[600px] min-h-[500px] w-full rounded-kartu border border-garis bg-latar"
              />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
