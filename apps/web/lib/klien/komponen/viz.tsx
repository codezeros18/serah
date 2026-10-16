"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as PointerEventReact, type ReactNode } from "react";
import type { Aliran } from "@serah/kontrak/enum";
import { InfoTip } from "./info-tip";

/** Warna seri aliran untuk grafik (lembut, SaaS). */
export const WARNA_ALIRAN: Record<Aliran, string> = {
  HIJAU: "#10b981",
  KUNING: "#f59e0b",
  MERAH: "#f43f5e",
  ABU: "#94a3b8",
};

// ---------------------------------------------------------------------------------------------
// Kartu & baris
// ---------------------------------------------------------------------------------------------

/** Kartu dasbor: judul + info opsional + slot kanan. */
export function KartuViz({
  judul,
  info,
  kanan,
  className = "",
  children,
}: {
  judul: string;
  info?: { judul: string; isi: string };
  kanan?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`muncul flex flex-col gap-4 rounded-3xl border border-garis-halus bg-kertas p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] ${className}`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight text-tinta">{judul}</h2>
          {info ? <InfoTip judul={info.judul} isi={info.isi} /> : null}
        </div>
        {kanan}
      </header>
      {children}
    </section>
  );
}

/** Pil perubahan: naik/turun dengan warna baik/buruk. `null` = tidak ada pembanding. */
export function ChipDelta({
  nilai,
  satuan = "%",
  baikJikaNaik = true,
}: {
  nilai: number | null;
  satuan?: string;
  baikJikaNaik?: boolean;
}) {
  if (nilai === null) {
    return <span className="rounded-full bg-latar px-2 py-0.5 text-[11px] font-medium text-tinta-redup">—</span>;
  }
  const naik = nilai > 0;
  const sama = nilai === 0;
  const baik = sama ? null : naik === baikJikaNaik;
  const kelas = sama
    ? "bg-latar text-tinta-redup"
    : baik
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15"
      : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${kelas}`}>
      <span aria-hidden="true">{sama ? "•" : naik ? "▲" : "▼"}</span>
      {Math.abs(nilai).toLocaleString("id-ID")}
      {satuan}
    </span>
  );
}

/** Satu baris metrik: label + perubahan di kiri, nilai berbentuk pil di kanan. */
export function BarisMetrik({
  label,
  delta,
  nilai,
  nada = "netral",
}: {
  label: string;
  delta: ReactNode;
  nilai: string;
  nada?: "baik" | "waspada" | "buruk" | "netral";
}) {
  const kelas = {
    baik: "bg-emerald-50 text-emerald-700",
    waspada: "bg-amber-50 text-amber-700",
    buruk: "bg-rose-50 text-rose-700",
    netral: "bg-latar text-tinta",
  }[nada];
  return (
    <div className="flex items-center justify-between gap-3 border-t border-garis-halus/70 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-tinta">{label}</p>
        <div className="mt-1">{delta}</div>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums ${kelas}`}>{nilai}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Gauge setengah lingkaran
// ---------------------------------------------------------------------------------------------

export type NadaGauge = "baik" | "sedang" | "rendah" | "kosong";

export function nadaDariNilai(nilai: number | null): NadaGauge {
  if (nilai === null) return "kosong";
  if (nilai >= 85) return "baik";
  if (nilai >= 60) return "sedang";
  return "rendah";
}

const WARNA_GAUGE: Record<NadaGauge, [string, string]> = {
  baik: ["#34d399", "#10b981"],
  sedang: ["#fcd34d", "#f59e0b"],
  rendah: ["#fda4af", "#f43f5e"],
  kosong: ["#e2e8f0", "#cbd5e1"],
};

/** Gauge setengah lingkaran 0–100 dengan animasi isi. */
export function Gauge({
  nilai,
  label,
  subteks,
  satuan = "%",
}: {
  nilai: number | null;
  label: string;
  subteks?: ReactNode;
  satuan?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [tampil, setTampil] = useState(0);
  const nada = nadaDariNilai(nilai);
  const [dari, ke] = WARNA_GAUGE[nada];

  useEffect(() => {
    const t = requestAnimationFrame(() => setTampil(nilai ?? 0));
    return () => cancelAnimationFrame(t);
  }, [nilai]);

  return (
    <div
      className="relative rounded-2xl border border-garis-halus/70 bg-gradient-to-b from-white to-latar/60 px-4 pb-4 pt-6"
      role="img"
      aria-label={`${label}: ${nilai === null ? "—" : `${nilai}${satuan}`}`}
    >
      <svg viewBox="0 0 200 112" className="mx-auto w-full max-w-[260px]" aria-hidden="true">
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={dari} />
            <stop offset="100%" stopColor={ke} />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#eef0f4" strokeWidth="14" strokeLinecap="round" pathLength={100} />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={`url(#g-${id})`}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.max(0.01, tampil)} 100`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="-mt-[4.2rem] flex flex-col items-center text-center">
        <p className="text-xs text-tinta-redup">{label}</p>
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-tinta">
          {nilai === null ? "—" : nilai.toLocaleString("id-ID")}
          {nilai === null ? "" : <span className="ml-0.5 text-lg font-medium text-tinta-redup">{satuan}</span>}
        </p>
        {subteks ? <div className="mt-1.5">{subteks}</div> : <div className="h-6" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Bilah segmen + legenda
// ---------------------------------------------------------------------------------------------

export type Segmen = { kunci: string; label: string; nilai: number; warna: string; teksNilai?: string };

export function BilahSegmen({ segmen, tanpaLegenda = false }: { segmen: readonly Segmen[]; tanpaLegenda?: boolean }) {
  const total = segmen.reduce((j, s) => j + s.nilai, 0);
  const [tampil, setTampil] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setTampil(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full" role="img" aria-label={segmen.map((s) => `${s.label} ${s.teksNilai ?? s.nilai}`).join(", ")}>
        {total === 0 ? (
          <span className="h-full w-full rounded-full bg-latar" />
        ) : (
          segmen
            .filter((s) => s.nilai > 0)
            .map((s) => (
              <span
                key={s.kunci}
                className="h-full rounded-full"
                style={{
                  width: tampil ? `${(s.nilai / total) * 100}%` : "0%",
                  background: s.warna,
                  transition: "width 800ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            ))
        )}
      </div>
      {tanpaLegenda ? null : (
        <ul className="flex flex-col gap-2.5">
          {segmen.map((s) => (
            <li key={s.kunci} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.warna }} />
                <span className="truncate text-tinta">{s.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 tabular-nums">
                <span className="font-mono text-sm font-medium text-tinta">{s.teksNilai ?? s.nilai}</span>
                <span className="w-12 text-right text-xs text-tinta-redup">
                  {total === 0 ? "0%" : `${Math.round((s.nilai / total) * 1000) / 10}%`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Donat
// ---------------------------------------------------------------------------------------------

export function Donat({
  segmen,
  tengah,
  subteks,
  ukuran = 168,
}: {
  segmen: readonly Segmen[];
  tengah: string;
  subteks: string;
  ukuran?: number;
}) {
  const total = segmen.reduce((j, s) => j + s.nilai, 0);
  const r = 52;
  const [tampil, setTampil] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setTampil(true));
    return () => cancelAnimationFrame(t);
  }, []);
  let mulai = 0;
  return (
    <div className="relative shrink-0" style={{ width: ukuran, height: ukuran }} role="img" aria-label={`${subteks}: ${tengah}`}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#eef0f4" strokeWidth="16" />
        {total > 0
          ? segmen
              .filter((s) => s.nilai > 0)
              .map((s) => {
                const bagian = (s.nilai / total) * 100;
                const el = (
                  <circle
                    key={s.kunci}
                    cx="70"
                    cy="70"
                    r={r}
                    fill="none"
                    stroke={s.warna}
                    strokeWidth="16"
                    pathLength={100}
                    strokeDasharray={`${tampil ? Math.max(0, bagian - 1.2) : 0} 100`}
                    strokeDashoffset={-mulai}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
                  />
                );
                mulai += bagian;
                return el;
              })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-tinta">{tengah}</p>
        <p className="text-[11px] text-tinta-redup">{subteks}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Grafik area dengan tooltip
// ---------------------------------------------------------------------------------------------

export type TitikGrafik = { label: string; nilai: number; nilai2?: number };

function jalurHalus(p: readonly { x: number; y: number }[]): string {
  const awal = p[0];
  if (!awal) return "";
  let d = `M ${awal.x} ${awal.y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i];
    const b = p[i];
    const c = p[i + 1];
    const e = p[i + 2] ?? c;
    if (!a || !b || !c || !e) continue;
    const c1x = b.x + (c.x - a.x) / 6;
    const lo = Math.min(b.y, c.y);
    const hi = Math.max(b.y, c.y);
    const c1y = Math.min(hi, Math.max(lo, b.y + (c.y - a.y) / 6));
    const c2x = c.x - (e.x - b.x) / 6;
    const c2y = Math.min(hi, Math.max(lo, c.y - (e.y - b.y) / 6));
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${c.x} ${c.y}`;
  }
  return d;
}

export function GrafikArea({
  data,
  format,
  label1,
  label2,
  tinggi = 220,
}: {
  data: readonly TitikGrafik[];
  format: (n: number) => string;
  label1: string;
  label2?: string;
  tinggi?: number;
}) {
  const id = useId().replace(/:/g, "");
  const kotak = useRef<HTMLDivElement>(null);
  const [aktif, setAktif] = useState<number | null>(null);
  const L = 640;
  const T = tinggi;
  const pad = { k: 8, a: 14, kn: 8, b: 26 };

  const { maks, p1, p2 } = useMemo(() => {
    const m = Math.max(1, ...data.map((d) => Math.max(d.nilai, d.nilai2 ?? 0)));
    const lebar = L - pad.k - pad.kn;
    const tg = T - pad.a - pad.b;
    const x = (i: number) => pad.k + (data.length <= 1 ? lebar / 2 : (i / (data.length - 1)) * lebar);
    const y = (v: number) => pad.a + tg - (v / m) * tg;
    return {
      maks: m,
      p1: data.map((d, i) => ({ x: x(i), y: y(d.nilai) })),
      p2: data.map((d, i) => ({ x: x(i), y: y(d.nilai2 ?? 0) })),
    };
  }, [data, T]);

  const garis1 = jalurHalus(p1);
  const garis2 = label2 ? jalurHalus(p2) : "";
  const dasar = T - pad.b;
  const area =
    p1.length > 0 ? `${garis1} L ${p1[p1.length - 1]?.x ?? 0} ${dasar} L ${p1[0]?.x ?? 0} ${dasar} Z` : "";
  const langkahLabel = Math.max(1, Math.ceil(data.length / 8));

  function saatGerak(e: PointerEventReact<HTMLDivElement>) {
    const r = kotak.current?.getBoundingClientRect();
    if (!r || data.length === 0) return;
    const rel = (e.clientX - r.left) / r.width;
    const idx = Math.round(((rel * L - pad.k) / (L - pad.k - pad.kn)) * (data.length - 1));
    setAktif(Math.min(data.length - 1, Math.max(0, idx)));
  }

  const titik = aktif !== null ? p1[aktif] : undefined;
  const d = aktif !== null ? data[aktif] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-tinta-redup">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-aksi" />
          {label1}
        </span>
        {label2 ? (
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-emerald-500" />
            {label2}
          </span>
        ) : null}
      </div>

      <div
        ref={kotak}
        className="relative w-full touch-none select-none rounded-2xl bg-gradient-to-b from-aksi-latar/40 to-white"
        onPointerMove={saatGerak}
        onPointerLeave={() => setAktif(null)}
        role="img"
        aria-label={`${label1}${label2 ? ` / ${label2}` : ""}`}
      >
        <svg viewBox={`0 0 ${L} ${T}`} className="h-auto w-full" aria-hidden="true">
          <defs>
            <linearGradient id={`a-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2457c5" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2457c5" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={pad.k} x2={L - pad.kn} y1={pad.a + (T - pad.a - pad.b) * f} y2={pad.a + (T - pad.a - pad.b) * f} stroke="#e8ecf2" strokeDasharray="3 5" />
          ))}
          <path d={area} fill={`url(#a-${id})`} />
          <path d={garis1} fill="none" stroke="#2457c5" strokeWidth="2.4" strokeLinecap="round" />
          {garis2 ? <path d={garis2} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 0" /> : null}
          {data.map((dt, i) =>
            i % langkahLabel === 0 ? (
              <text key={dt.label} x={p1[i]?.x ?? 0} y={T - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {dt.label}
              </text>
            ) : null,
          )}
          {titik ? (
            <>
              <line x1={titik.x} x2={titik.x} y1={pad.a} y2={dasar} stroke="#2457c5" strokeDasharray="3 4" opacity="0.5" />
              <circle cx={titik.x} cy={titik.y} r="5" fill="#fff" stroke="#2457c5" strokeWidth="2.5" />
            </>
          ) : null}
        </svg>

        {titik && d ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[8.5rem] -translate-x-1/2 rounded-xl bg-tinta px-3 py-2 text-white shadow-[0_12px_32px_rgba(15,23,42,0.3)]"
            style={{
              left: `${Math.min(88, Math.max(12, (titik.x / L) * 100))}%`,
              top: `${Math.max(2, (titik.y / T) * 100 - 30)}%`,
            }}
          >
            <p className="text-[11px] text-white/60">{d.label}</p>
            <p className="font-mono text-sm font-semibold tabular-nums">{format(d.nilai)}</p>
            {label2 && d.nilai2 !== undefined ? (
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs tabular-nums text-emerald-300">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {format(d.nilai2)}
              </p>
            ) : null}
          </div>
        ) : null}
        <span className="sr-only">{format(maks)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Strip KPI
// ---------------------------------------------------------------------------------------------

export type ItemKpi = {
  kunci: string;
  label: string;
  nilai: number | string;
  nada?: "netral" | "waspada" | "buruk" | "baik" | "aksi";
  testId?: string;
};

/** Deretan angka besar bersekat (gaya "Overdue | Pending | Completed"). */
export function StripKpi({ item }: { item: readonly ItemKpi[] }) {
  const warna = {
    netral: "text-tinta",
    waspada: "text-amber-600",
    buruk: "text-rose-600",
    baik: "text-emerald-600",
    aksi: "text-aksi",
  } as const;
  return (
    <div className={`grid gap-y-5 sm:gap-y-0 sm:divide-x sm:divide-garis-halus ${item.length === 3 ? "grid-cols-3" : item.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
      {item.map((k) => (
        <div key={k.kunci} data-testid={k.testId} className="flex flex-col items-center gap-1 px-3 text-center">
          <span className={`text-3xl font-semibold tabular-nums tracking-tight ${warna[k.nada ?? "netral"]}`}>{k.nilai}</span>
          <span className="text-xs leading-snug text-tinta-redup">{k.label}</span>
        </div>
      ))}
    </div>
  );
}
