"use client";

import { useCallback, useEffect, useState } from "react";
import type { KeadaanAntrean } from "./antrean";
import { antreanBersama } from "./bersama";

const JEDA_ULANG_MS = 15_000;

/** Status antrean + sinkron otomatis saat kembali online, saat dibuka, dan berkala selama ada yang menunggu. */
export function useAntrean() {
  const [keadaan, setKeadaan] = useState<KeadaanAntrean>({ menunggu: 0, ditolak: 0 });
  const [online, setOnline] = useState(true);
  const [baruTerkirim, setBaruTerkirim] = useState(false);

  const segarkan = useCallback(() => {
    void antreanBersama().keadaan().then(setKeadaan);
  }, []);

  const sinkron = useCallback(async () => {
    const r = await antreanBersama().sinkron();
    if (r.diterapkan + r.duplikat > 0 && r.sisa === 0) setBaruTerkirim(true);
    segarkan();
    return r;
  }, [segarkan]);

  useEffect(() => {
    const a = antreanBersama();
    setOnline(navigator.onLine);
    const berhenti = a.pantau(segarkan);
    const naik = () => {
      setOnline(true);
      void sinkron();
    };
    const turun = () => setOnline(false);
    window.addEventListener("online", naik);
    window.addEventListener("offline", turun);
    segarkan();
    if (navigator.onLine) void sinkron();
    const pewaktu = setInterval(() => {
      if (navigator.onLine) void a.keadaan().then((k) => (k.menunggu > 0 ? sinkron() : undefined));
    }, JEDA_ULANG_MS);
    return () => {
      berhenti();
      window.removeEventListener("online", naik);
      window.removeEventListener("offline", turun);
      clearInterval(pewaktu);
    };
  }, [segarkan, sinkron]);

  return { keadaan, online, baruTerkirim, tutupTerkirim: () => setBaruTerkirim(false), sinkron, segarkan };
}
