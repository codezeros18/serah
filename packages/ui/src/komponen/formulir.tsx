import type { InputHTMLAttributes } from "react";
import { TEKS } from "@serah/kontrak/teks";

/**
 * Isian berat (kg): keyboard desimal, koma diizinkan. Nilai tetap string mentah;
 * konversi ke gram hanya lewat parseBeratKgKeGram() (core/angka) di pemanggil.
 */
export function IsianBerat({
  id,
  label = TEKS.T1_BERAT_LABEL,
  nilai,
  onUbah,
  salah = false,
  labelTersembunyi = false,
  ...sisa
}: {
  id: string;
  label?: string;
  nilai: string;
  onUbah: (nilai: string) => void;
  salah?: boolean;
  /** Label tetap ada untuk pembaca layar, tidak ditampilkan. */
  labelTersembunyi?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "type" | "inputMode">) {
  const idGalat = `${id}-galat`;
  const { className, ...inputSisa } = sisa;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelTersembunyi ? "sr-only" : "text-sm font-medium text-tinta"}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={nilai}
          onChange={(e) => onUbah(e.target.value)}
          aria-invalid={salah}
          aria-describedby={salah ? idGalat : undefined}
          className={`min-h-16 w-full rounded-2xl border bg-kertas pl-4 pr-14 text-right font-mono text-3xl font-semibold tabular-nums text-tinta shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 placeholder:text-garis hover:border-garis focus:border-aksi focus:outline-none focus:ring-4 focus:ring-aksi/15 ${
            salah ? "border-rose-300 ring-4 ring-rose-100" : "border-garis-halus"
          } ${className ?? ""}`}
          {...inputSisa}
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-tinta-redup">
          kg
        </span>
      </div>
      {salah ? (
        <p id={idGalat} role="alert" className="text-sm font-medium text-rose-700">
          {TEKS.G_BERAT_TIDAK_SAH}
        </p>
      ) : null}
    </div>
  );
}
