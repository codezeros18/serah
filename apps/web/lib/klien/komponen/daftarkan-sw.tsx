"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan service worker (cangkang offline). Hanya pada build produksi: di mode dev, cache
 * aset HMR membuat muat-ulang berulang. NEXT_PUBLIC_SW=false mematikannya sama sekali.
 */
export function DaftarkanSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SW === "false") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
