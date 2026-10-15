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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.PKR_JUDUL}</h1>
      <p className="text-base text-tinta-redup">{TEKS.PKR_PETUNJUK}</p>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {memuat && !daftar ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {daftar ? (
        daftar.length === 0 ? (
          <Kosong teks={TEKS.K_KOSONG_KOREKSI} />
        ) : (
          <ul className="flex flex-col gap-3" data-testid="daftar-koreksi">
            {daftar.map((item) => {
              const statusTeks =
                item.status === "DIAJUKAN"
                  ? TEKS.PKR_STATUS_DIAJUKAN
                  : item.status === "DISETUJUI"
                    ? TEKS.PKR_STATUS_DISETUJUI
                    : TEKS.PKR_STATUS_DITOLAK;

              return (
                <li key={item.id}>
                  <Kartu className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-garis pb-2">
                      <span className="font-mono text-base font-bold">{item.kode}</span>
                      <span className="rounded-kontrol border border-garis bg-latar px-2 py-1 text-xs font-semibold uppercase text-tinta">
                        {statusTeks}
                      </span>
                    </div>

                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="font-semibold">{TEKS.KOL_STATUS}</dt>
                      <dd>{item.targetJenis}</dd>

                      <dt className="font-semibold">{TEKS.K1_DICATAT}</dt>
                      <dd>
                        {item.nilaiAsliG !== null
                          ? isi("UMUM_KG", { nilai: formatGramKeKg(item.nilaiAsliG) })
                          : "—"}
                      </dd>

                      <dt className="font-semibold">{TEKS.PKR_NILAI_USULAN}</dt>
                      <dd className="font-bold text-aksi">
                        {item.nilaiUsulanG !== null
                          ? isi("UMUM_KG", { nilai: formatGramKeKg(item.nilaiUsulanG) })
                          : "—"}
                      </dd>

                      <dt className="font-semibold">{TEKS.UMUM_ALASAN}</dt>
                      <dd>{item.alasan}</dd>

                      <dt className="font-semibold">{TEKS.KOL_TANGGAL}</dt>
                      <dd>{tanggalJamWib(item.dibuatPada)}</dd>

                      {item.putusan ? (
                        <>
                          <dt className="font-semibold">{TEKS.KOL_ALASAN}</dt>
                          <dd>{`${item.putusan.keputusan}: ${item.putusan.alasan}`}</dd>
                        </>
                      ) : null}
                    </dl>

                    {item.status === "DIAJUKAN" ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Tombol
                          onClick={() => void handlePutus(item.id, "DISETUJUI")}
                          disabled={prosesId === item.id}
                        >
                          {TEKS.PKR_SETUJUI}
                        </Tombol>
                        <Tombol
                          varian="sekunder"
                          onClick={() => void handlePutus(item.id, "DITOLAK")}
                          disabled={prosesId === item.id}
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
