"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HasilApi } from "./api";

export type KeadaanMuat<T> =
  | { status: "memuat" }
  | { status: "siap"; data: T }
  | { status: "galat"; pesan: string };

/**
 * Memuat data dari satu panggilan API. `selangMs` > 0 → muat ulang berkala (sebelum SSE S18).
 * `muat` boleh berubah tiap render; hook memakai versi terbaru.
 */
export function useMuat<T>(muat: () => Promise<HasilApi<T>>, selangMs = 0) {
  const [keadaan, setKeadaan] = useState<KeadaanMuat<T>>({ status: "memuat" });
  const terbaru = useRef(muat);
  useEffect(() => {
    terbaru.current = muat;
  });

  const ulang = useCallback(async () => {
    const h = await terbaru.current();
    setKeadaan(h.ok ? { status: "siap", data: h.data } : { status: "galat", pesan: h.pesan });
  }, []);

  useEffect(() => {
    void ulang();
    if (selangMs <= 0) return;
    const t = setInterval(() => void ulang(), selangMs);
    return () => clearInterval(t);
  }, [ulang, selangMs]);

  return { keadaan, ulang };
}
