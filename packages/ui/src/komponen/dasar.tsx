import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";

const gabung = (...k: Array<string | false | undefined>) => k.filter(Boolean).join(" ");

type VarianTombol = "utama" | "sekunder";

export function Tombol({
  varian = "utama",
  className,
  type = "button",
  ...sisa
}: ButtonHTMLAttributes<HTMLButtonElement> & { varian?: VarianTombol }) {
  return (
    <button
      type={type}
      className={gabung(
        "inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-kontrol px-5 text-base font-bold transition-all duration-150 active:scale-[0.98] select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksi",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        varian === "utama"
          ? "bg-aksi text-white hover:bg-aksi-hover shadow-sm hover:shadow-md"
          : "border border-garis-halus bg-kertas text-tinta hover:bg-aksi-latar/50 hover:border-aksi-garis hover:text-aksi shadow-2xs",
        className,
      )}
      {...sisa}
    />
  );
}

export function Kartu({ className, ...sisa }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={gabung(
        "muncul rounded-kartu border border-garis-halus bg-kertas p-4 sm:p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition-all duration-300",
        className,
      )}
      {...sisa}
    />
  );
}

/** Keadaan kosong. `teks` = salah satu kunci K_KOSONG_* dari TEKS. */
export function Kosong({ teks, aksi }: { teks: string; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-kartu border-2 border-dashed border-garis-halus bg-kertas p-8 text-center">
      <p className="text-base font-medium text-tinta-redup">{teks}</p>
      {aksi}
    </div>
  );
}

/** Banner galat: garis tebal gelap + ikon, bukan merah (merah = aliran B3). */
export function BannerGalat({ pesan, onCoba }: { pesan: string; onCoba?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-garis-halus bg-galat-latar p-3.5 text-base shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-kertas text-lg font-semibold text-tinta"
      >
        !
      </span>
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-tinta">{pesan}</p>
      {onCoba ? (
        <Tombol varian="sekunder" onClick={onCoba} className="min-h-11 rounded-xl px-4 text-sm font-medium">
          {TEKS.UMUM_COBA_LAGI}
        </Tombol>
      ) : null}
    </div>
  );
}

/** Ditampilkan di setiap layar mode demo. */
export function LabelDemo() {
  return (
    <div
      role="note"
      className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 px-4 py-1.5 text-center text-xs font-semibold text-amber-900 tracking-wide flex items-center justify-center gap-2"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
      <span>{TEKS.DEMO_LABEL}</span>
    </div>
  );
}

/** Ditampilkan di setiap layar yang menampilkan cuaca. */
export function AtribusiBMKG() {
  return <p className="text-sm text-tinta-redup">{TEKS.BMKG_ATRIBUSI}</p>;
}
