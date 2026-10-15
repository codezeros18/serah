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
        "inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-kontrol px-5 text-base font-semibold transition-all duration-150 active:scale-[0.98] select-none",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        varian === "utama" ? "bg-aksi text-aksi-teks hover:bg-aksi-hover shadow-sm" : "border-2 border-garis bg-kertas text-tinta hover:bg-latar",
        className,
      )}
      {...sisa}
    />
  );
}

export function Kartu({ className, ...sisa }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={gabung("rounded-kartu border border-garis-halus bg-kertas p-4 shadow-sm", className)}
      {...sisa}
    />
  );
}

/** Keadaan kosong. `teks` = salah satu kunci K_KOSONG_* dari TEKS. */
export function Kosong({ teks, aksi }: { teks: string; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-kartu border border-dashed border-garis bg-kertas p-6 text-center">
      <p className="text-base text-tinta-redup">{teks}</p>
      {aksi}
    </div>
  );
}

/** Banner galat: garis tebal gelap + ikon, bukan merah (merah = aliran B3). */
export function BannerGalat({ pesan, onCoba }: { pesan: string; onCoba?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-kartu border-l-8 border-galat bg-galat-latar p-4 text-base"
    >
      <span aria-hidden="true" className="text-xl font-bold">
        !
      </span>
      <p className="min-w-0 flex-1">{pesan}</p>
      {onCoba ? (
        <Tombol varian="sekunder" onClick={onCoba}>
          {TEKS.UMUM_COBA_LAGI}
        </Tombol>
      ) : null}
    </div>
  );
}

/** Ditampilkan di setiap layar mode demo. */
export function LabelDemo() {
  return (
    <p
      role="note"
      className="border-b-2 border-peringatan-garis bg-peringatan-latar px-4 py-2 text-center text-sm font-semibold text-peringatan"
    >
      {TEKS.DEMO_LABEL}
    </p>
  );
}

/** Ditampilkan di setiap layar yang menampilkan cuaca. */
export function AtribusiBMKG() {
  return <p className="text-sm text-tinta-redup">{TEKS.BMKG_ATRIBUSI}</p>;
}
