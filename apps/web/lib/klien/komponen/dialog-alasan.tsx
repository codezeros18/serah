"use client";

import { useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { Tombol } from "@serah/ui";

export interface DialogAlasanProps {
  terbuka: boolean;
  judul?: string;
  onBatal: () => void;
  onKonfirmasi: (alasan: string) => void;
}

export function DialogAlasan({
  terbuka,
  judul,
  onBatal,
  onKonfirmasi,
}: DialogAlasanProps) {
  const [alasan, setAlasan] = useState("");
  const [sudahCobaSubmit, setSudahCobaSubmit] = useState(false);

  if (!terbuka) return null;

  const valid = alasan.trim().length >= 15;

  function handleSubmit() {
    setSudahCobaSubmit(true);
    if (!valid) return;
    onKonfirmasi(alasan.trim());
    setAlasan("");
    setSudahCobaSubmit(false);
  }

  function handleBatal() {
    setAlasan("");
    setSudahCobaSubmit(false);
    onBatal();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-alasan-judul"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-kartu border-2 border-garis bg-kertas p-6 shadow-xl">
        <h2 id="dialog-alasan-judul" className="text-xl font-bold text-tinta">
          {judul ?? TEKS.ADM_ALASAN}
        </h2>

        <div className="flex flex-col gap-2">
          <label htmlFor="input-alasan-admin" className="text-sm font-semibold text-tinta">
            {TEKS.ADM_ALASAN}
          </label>
          <textarea
            id="input-alasan-admin"
            rows={3}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            className="rounded-kontrol border border-garis p-3 text-sm text-tinta focus:border-fokus focus:outline-none"
            placeholder={TEKS.ADM_ALASAN}
          />
          {(!valid && sudahCobaSubmit) || (alasan.length > 0 && !valid) ? (
            <p className="text-xs font-semibold text-amber-700">
              {TEKS.ADM_ALASAN_PENDEK} ({alasan.trim().length}/15)
            </p>
          ) : (
            <p className="text-xs text-tinta-redup">
              {alasan.trim().length} / 15 karakter
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-garis-halus">
          <Tombol varian="sekunder" onClick={handleBatal}>
            {TEKS.UMUM_BATAL}
          </Tombol>
          <Tombol onClick={handleSubmit} disabled={!valid}>
            {TEKS.UMUM_LANJUT}
          </Tombol>
        </div>
      </div>
    </div>
  );
}
