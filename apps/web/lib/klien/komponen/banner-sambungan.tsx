"use client";

import { useEffect, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";

/**
 * Banner sambungan di bawah bilah atas: "offline" bertahan selama terputus, lalu "tersambung kembali"
 * tampil sebentar. Hanya informasi; tidak memblokir tindakan (catatan lapangan tetap masuk antrean).
 */
export function BannerSambungan() {
  const [keadaan, setKeadaan] = useState<"online" | "offline" | "kembali">("online");
  const pewaktu = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!navigator.onLine) setKeadaan("offline");
    const turun = () => {
      if (pewaktu.current) clearTimeout(pewaktu.current);
      setKeadaan("offline");
    };
    const naik = () => {
      setKeadaan("kembali");
      pewaktu.current = setTimeout(() => setKeadaan("online"), 3500);
    };
    window.addEventListener("offline", turun);
    window.addEventListener("online", naik);
    return () => {
      window.removeEventListener("offline", turun);
      window.removeEventListener("online", naik);
      if (pewaktu.current) clearTimeout(pewaktu.current);
    };
  }, []);

  if (keadaan === "online") return null;
  const offline = keadaan === "offline";

  return (
    <div className="sticky top-[4.5rem] z-20 px-3 sm:px-5 lg:top-3">
      <div
        role="status"
        className={`toast-masuk mx-auto mt-2 flex max-w-6xl items-start gap-3 rounded-2xl p-3.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)] ring-1 backdrop-blur-xl ${
          offline ? "bg-tinta text-white ring-white/10" : "bg-status-selesai-latar text-status-selesai ring-status-selesai/20"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${offline ? "bg-white/10" : "bg-white"}`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            {offline ? (
              <>
                <path d="M4.500 9.500a11 11 0 0 1 15 0M7.500 12.800a6.800 6.800 0 0 1 9 0M10.500 16a2.600 2.600 0 0 1 3 0" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" />
                <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" />
              </>
            ) : (
              <path d="m5 12.500 4.500 4.500L19 7" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{offline ? TEKS.NET_OFFLINE_JUDUL : TEKS.NET_KEMBALI}</p>
          {offline ? <p className="mt-0.5 text-xs leading-snug text-white/70">{TEKS.NET_OFFLINE_ISI}</p> : null}
        </div>
      </div>
    </div>
  );
}
