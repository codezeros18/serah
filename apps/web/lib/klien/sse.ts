"use client";

import { useEffect, useRef, useState } from "react";
import { MOCK_AKTIF } from "./api";

export type StatusKoneksiSse = "terhubung" | "memuat" | "terputus";

export interface EventLangsungSse {
  tipe: "serah" | "notifikasi" | "ping";
  data: unknown;
}

/**
 * Hook klien untuk mendengarkan stream SSE /api/langsung (S18-1).
 * Menghandle otomatis koneksi ulang saat terputus.
 */
export function useLangsung(onEvent?: (event: EventLangsungSse) => void) {
  const [status, setStatus] = useState<StatusKoneksiSse>("memuat");
  const [terakhir, setTerakhir] = useState<Date | null>(null);
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (MOCK_AKTIF) {
      setStatus("terhubung");
      setTerakhir(new Date());
      return;
    }

    let sumber: EventSource | null = null;
    let waktuTunggu = 1000;
    let timerUlang: ReturnType<typeof setTimeout> | null = null;
    let aktif = true;

    function sambung() {
      if (!aktif) return;
      setStatus("memuat");

      try {
        sumber = new EventSource("/api/langsung");

        sumber.onopen = () => {
          if (!aktif) return;
          setStatus("terhubung");
          setTerakhir(new Date());
          waktuTunggu = 1000;
        };

        sumber.addEventListener("serah", (e) => {
          if (!aktif) return;
          setTerakhir(new Date());
          try {
            const data = JSON.parse(e.data);
            cbRef.current?.({ tipe: "serah", data });
          } catch {
            // Abaikan JSON tidak sah
          }
        });

        sumber.addEventListener("notifikasi", (e) => {
          if (!aktif) return;
          setTerakhir(new Date());
          try {
            const data = JSON.parse(e.data);
            cbRef.current?.({ tipe: "notifikasi", data });
          } catch {
            // Abaikan JSON tidak sah
          }
        });

        sumber.addEventListener("ping", () => {
          if (!aktif) return;
          setTerakhir(new Date());
        });

        sumber.onerror = () => {
          if (!aktif) return;
          setStatus("terputus");
          sumber?.close();
          sumber = null;
          // Rekoneksi dengan jeda eksponensial (maks 10 detik)
          timerUlang = setTimeout(() => {
            waktuTunggu = Math.min(waktuTunggu * 1.5, 10000);
            sambung();
          }, waktuTunggu);
        };
      } catch {
        setStatus("terputus");
      }
    }

    sambung();

    return () => {
      aktif = false;
      if (timerUlang) clearTimeout(timerUlang);
      if (sumber) {
        sumber.close();
        sumber = null;
      }
    };
  }, []);

  return { status, terakhir };
}
