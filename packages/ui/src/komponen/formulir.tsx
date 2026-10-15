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
  ...sisa
}: {
  id: string;
  label?: string;
  nilai: string;
  onUbah: (nilai: string) => void;
  salah?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "type" | "inputMode">) {
  const idGalat = `${id}-galat`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        aria-invalid={salah}
        aria-describedby={salah ? idGalat : undefined}
        className={`min-h-12 rounded-kontrol border-2 bg-kertas px-3 text-xl ${salah ? "border-galat" : "border-garis"}`}
        {...sisa}
      />
      {salah ? (
        <p id={idGalat} className="text-sm font-semibold">
          {TEKS.G_BERAT_TIDAK_SAH}
        </p>
      ) : null}
    </div>
  );
}
