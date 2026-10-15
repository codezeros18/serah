"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LabelDemo } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";
import { panggil } from "@/lib/klien/api";
import { Poppins } from "next/font/google";
import { NavbarGlass } from "@/lib/klien/komponen/navbar-glass";
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

/** Baris tab yang bisa digulir mendatar: panah kiri/kanan + pudar tepi muncul hanya bila ada isi tersembunyi. */
function BarisTab({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [adaKiri, setAdaKiri] = useState(false);
  const [adaKanan, setAdaKanan] = useState(false);

  const periksa = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAdaKiri(el.scrollLeft > 4);
    setAdaKanan(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    periksa();
    const el = ref.current;
    const ro = new ResizeObserver(periksa);
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [periksa]);

  function geser(arah: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: arah * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" });
  }

  const kelasPanah =
    "absolute top-[calc(50%-5px)] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-garis-halus bg-white text-tinta shadow-[0_4px_14px_rgba(15,23,42,0.12)] transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi";

  return (
    <div className="relative">
      <div ref={ref} onScroll={periksa} className="gulir-halus flex gap-2 overflow-x-auto scroll-smooth pb-2.5">
        {children}
      </div>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 ${adaKiri ? "opacity-100" : "opacity-0"}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 ${adaKanan ? "opacity-100" : "opacity-0"}`}
      />
      <button
        type="button"
        aria-label="Geser ke kiri"
        onClick={() => geser(-1)}
        tabIndex={adaKiri ? 0 : -1}
        className={`${kelasPanah} left-0 ${adaKiri ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        aria-label="Geser ke kanan"
        onClick={() => geser(1)}
        tabIndex={adaKanan ? 0 : -1}
        className={`${kelasPanah} right-0 ${adaKanan ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

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

      {/* Navbar yang sama persis dengan beranda (lebar & isi); aksi khusus demo ada di bilah di bawahnya. */}
      <NavbarGlass />

      <div className="px-4 pb-2 pt-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="hero-masuk flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-aksi-garis bg-aksi-latar px-3 py-1 text-xs font-medium text-aksi">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-aksi" aria-hidden="true" />
              {TEKS.LANDING_NAV_DEMO}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-tinta sm:text-3xl">Demo 4-Layar Interaktif</h1>
            <p className="max-w-xl text-sm leading-relaxed text-tinta-redup">{TEKS.DEMO_SUB}</p>
          </div>
          <button
            type="button"
            onClick={handleResetDemo}
            disabled={sedangReset}
            data-testid="tombol-reset-demo"
            className="group inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-3 rounded-2xl border border-garis-halus bg-kertas py-2 pl-2.5 pr-5 text-sm font-medium text-tinta shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi hover:shadow-[0_12px_28px_rgba(36,87,197,0.16)] active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-latar text-aksi transition-colors duration-200 group-hover:bg-white">
              {sedangReset ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  aria-hidden="true"
                  className="transition-transform duration-500 group-hover:-rotate-180"
                >
                  <path
                    d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4h4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span>{sedangReset ? TEKS.UMUM_MUAT : TEKS.DEMO_RESET}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {pesanSukses ? (
        <div
          role="status"
          className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-6xl items-center gap-2 rounded-2xl border border-status-selesai/20 bg-status-selesai-latar px-4 py-3 text-sm font-medium text-status-selesai sm:w-[calc(100%-3rem)]"
        >
          <span aria-hidden="true">✓</span>
          <span>{pesanSukses}</span>
        </div>
      ) : null}

      {pesanGalat ? (
        <div
          role="alert"
          className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-6xl rounded-2xl border border-peringatan-garis/30 bg-peringatan-latar px-4 py-3 text-sm font-medium text-peringatan sm:w-[calc(100%-3rem)]"
        >
          {pesanGalat}
        </div>
      ) : null}

      {/* Switcher cepat: bisa digulir mendatar di layar sempit */}
      <div className="px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <BarisTab>
            <button
              type="button"
              onClick={() => loncatKePanel(null)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                sorotanPanel === null ? "border-tinta bg-tinta text-white shadow-sm" : "border-garis-halus bg-kertas text-tinta hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
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
                  sorotanPanel === panel.id ? "border-tinta bg-tinta text-white shadow-sm" : "border-garis-halus bg-kertas text-tinta hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
                }`}
              >
                <IkonLanding nama={panel.ikon} className="h-4 w-4" />
                <span>{panel.nomorUrut}.</span>
                <span>{panel.peran}</span>
              </button>
            ))}
          </BarisTab>
        </div>
      </div>

      {/* Main Split Panels */}
      <main className="flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
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
                          className="h-[520px] w-full border-0 bg-latar sm:h-[620px]"
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
                        className="h-[520px] w-full border-0 bg-latar sm:h-[620px]"
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
