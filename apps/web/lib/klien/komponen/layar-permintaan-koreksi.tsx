"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { PermintaanKoreksi } from "@serah/kontrak";
import type { KeputusanPermintaan } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Kosong, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { tanggalJamWib } from "@/lib/klien/periode";

type ItemKoreksi = z.infer<typeof PermintaanKoreksi>;

export function LayarPermintaanKoreksi() {
  const [daftar, setDaftar] = useState<ItemKoreksi[] | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [prosesId, setProsesId] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    const res = await panggil("GET", "/api/permintaan-koreksi");
    setMemuat(false);
    if (res.ok) {
      setDaftar(res.data.permintaan);
    } else {
      setGalat(res.pesan);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function handlePutus(id: string, keputusan: KeputusanPermintaan) {
    setProsesId(id);
    const alasan = keputusan === "DISETUJUI" ? TEKS.PKR_STATUS_DISETUJUI : TEKS.PKR_STATUS_DITOLAK;
    const res = await panggil("POST", "/api/permintaan-koreksi/[id]/putus", {
      params: { id },
      body: { keputusan, alasan },
    });
    setProsesId(null);
    if (res.ok) {
      void muat();
    } else {
      setGalat(res.pesan);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.PKR_JUDUL}</h1>
          <p className="text-sm font-medium text-tinta-redup">{TEKS.PKR_PETUNJUK}</p>
        </div>
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {memuat && !daftar ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {daftar ? (
        daftar.length === 0 ? (
          <Kosong teks={TEKS.K_KOSONG_KOREKSI} />
        ) : (
          <ul className="flex flex-col gap-4" data-testid="daftar-koreksi">
            {daftar.map((item) => {
              const statusTeks =
                item.status === "DIAJUKAN"
                  ? TEKS.PKR_STATUS_DIAJUKAN
                  : item.status === "DISETUJUI"
                    ? TEKS.PKR_STATUS_DISETUJUI
                    : TEKS.PKR_STATUS_DITOLAK;

              return (
                <li key={item.id}>
                  <Kartu
                    className={`flex flex-col gap-4 shadow-xs transition-shadow duration-150 hover:shadow-md ${
                      item.status === "DIAJUKAN"
                        ? "border-l-4 border-l-status-menunggu"
                        : item.status === "DISETUJUI"
                          ? "border-l-4 border-l-status-selesai"
                          : "border-l-4 border-l-status-tolak"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-garis-halus/60 pb-3">
                      <span className="font-mono text-base font-bold text-tinta">{item.kode}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold border uppercase ${
                          item.status === "DIAJUKAN"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : item.status === "DISETUJUI"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-purple-200 bg-purple-50 text-purple-800"
                        }`}
                      >
                        {statusTeks}
                      </span>
                    </div>

                    <div className="rounded-kontrol border border-garis-halus bg-latar/40 p-4">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm sm:text-base">
                        <dt className="font-semibold text-tinta-redup">{TEKS.KOL_STATUS}</dt>
                        <dd className="font-medium text-tinta">{item.targetJenis}</dd>

                        <dt className="font-semibold text-tinta-redup">{TEKS.K1_DICATAT}</dt>
                        <dd className="font-mono font-medium text-tinta tabular-nums">
                          {item.nilaiAsliG !== null
                            ? isi("UMUM_KG", { nilai: formatGramKeKg(item.nilaiAsliG) })
                            : "—"}
                        </dd>

                        <dt className="font-semibold text-tinta-redup">{TEKS.PKR_NILAI_USULAN}</dt>
                        <dd className="font-mono font-extrabold text-aksi tabular-nums">
                          {item.nilaiUsulanG !== null
                            ? isi("UMUM_KG", { nilai: formatGramKeKg(item.nilaiUsulanG) })
                            : "—"}
                        </dd>

                        <dt className="font-semibold text-tinta-redup">{TEKS.UMUM_ALASAN}</dt>
                        <dd className="font-medium text-tinta">{item.alasan}</dd>

                        <dt className="font-semibold text-tinta-redup">{TEKS.KOL_TANGGAL}</dt>
                        <dd className="font-medium text-tinta-redup">{tanggalJamWib(item.dibuatPada)}</dd>

                        {item.putusan ? (
                          <>
                            <dt className="font-semibold text-tinta-redup">{TEKS.KOL_ALASAN}</dt>
                            <dd className="font-medium text-tinta">{`${item.putusan.keputusan}: ${item.putusan.alasan}`}</dd>
                          </>
                        ) : null}
                      </dl>
                    </div>

                    {item.status === "DIAJUKAN" ? (
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-garis-halus/60">
                        <Tombol
                          onClick={() => void handlePutus(item.id, "DISETUJUI")}
                          disabled={prosesId === item.id}
                          className="min-h-10 text-sm"
                        >
                          {TEKS.PKR_SETUJUI}
                        </Tombol>
                        <Tombol
                          varian="sekunder"
                          onClick={() => void handlePutus(item.id, "DITOLAK")}
                          disabled={prosesId === item.id}
                          className="min-h-10 text-sm"
                        >
                          {TEKS.PKR_TOLAK}
                        </Tombol>
                      </div>
                    ) : null}
                  </Kartu>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
