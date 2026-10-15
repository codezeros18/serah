"use client";

import { useEffect, useState } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { antreanBersama } from "../antrean/bersama";

/**
 * Indikator sinkron kecil di bilah atas: muncul hanya saat offline atau ada catatan menunggu.
 * Hanya MEMBACA keadaan (tidak memicu sinkron); sinkron dijalankan oleh pita antrean di layar petugas.
 */
export function IndikatorSinkron() {
  const [online, setOnline] = useState(true);
  const [menunggu, setMenunggu] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const a = antreanBersama();
    const segarkan = () => void a.keadaan().then((k) => setMenunggu(k.menunggu));
    segarkan();
    const berhenti = a.pantau(segarkan);
    const naik = () => setOnline(true);
    const turun = () => setOnline(false);
    window.addEventListener("online", naik);
    window.addEventListener("offline", turun);
    return () => {
      berhenti();
      window.removeEventListener("online", naik);
      window.removeEventListener("offline", turun);
    };
  }, []);

  if (online && menunggu === 0) return null;
  const teks = !online ? TEKS.SYNC_OFFLINE_JUDUL : isi("G_ANTREAN", { jumlah: menunggu });

  return (
    <span
      role="status"
      title={teks}
      className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium ${
        online ? "bg-aksi-latar text-aksi" : "bg-peringatan-latar text-peringatan"
      }`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" className={online ? "animate-pulse" : ""}>
        <path
          d="M7 18.500a4 4 0 0 1-.6-7.950A5.500 5.500 0 0 1 17 9.500a4.500 4.500 0 0 1 .500 9H7Z"
          stroke="currentColor"
          strokeWidth="1.800"
          strokeLinejoin="round"
        />
        {online ? null : <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" />}
      </svg>
      <span className="tabular-nums">{menunggu > 0 ? menunggu : ""}</span>
    </span>
  );
}
