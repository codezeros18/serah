"use client";

import { useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { KELAS_INPUT } from "./kerangka-auth";

/** Kolom kata sandi dengan tombol lihat/sembunyikan, gaya halaman auth. */
export function KolomSandi({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  required = true,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
}) {
  const [lihat, setLihat] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={lihat ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${KELAS_INPUT} pr-12`}
      />
      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        aria-label={lihat ? TEKS.MASUK_SEMBUNYI_SANDI : TEKS.MASUK_LIHAT_SANDI}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-tinta-redup transition-colors hover:bg-latar hover:text-aksi"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
          {lihat ? null : <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
        </svg>
      </button>
    </div>
  );
}
