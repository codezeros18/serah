"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { NotifikasiDaftarKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Kosong, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { cekIosSafari, cekPushDidukung, daftarkanPush } from "@/lib/klien/push";
import { useLangsung } from "@/lib/klien/sse";

type ItemNotifikasi = z.infer<typeof NotifikasiDaftarKeluaran>["notifikasi"][number];

function susunPesanNotifikasi(n: ItemNotifikasi): string {
  switch (n.jenis) {
    case "SERAH_MENUNGGU_SETUJU":
      return isi("NTF_SERAH_MENUNGGU_SETUJU", { kode: n.objekKode });
    case "SERAH_DIANGKUT":
      return isi("NTF_SERAH_DIANGKUT", {
        kode: n.objekKode,
        penerima: String(n.data.penerima ?? ""),
      });
    case "SERAH_DITUTUP":
      return isi("NTF_SERAH_DITUTUP", {
        kode: n.objekKode,
        status: String(n.data.status ?? ""),
      });
    case "SERAH_MENGGANTUNG":
      return isi("NTF_SERAH_MENGGANTUNG", {
        kode: n.objekKode,
        jam: Number(n.data.jam ?? 0),
      });
    case "PRIORITAS_ANGKUT":
      return isi("NTF_PRIORITAS_ANGKUT", {
        kode_tps: String(n.data.kode_tps ?? n.objekKode),
      });
    case "WADAH_LEWAT_BATAS":
      return isi("NTF_WADAH_LEWAT_BATAS", {
        kode_tps: String(n.data.kode_tps ?? n.objekKode),
      });
    case "CATATAN_HARIAN_BELUM":
      return isi("NTF_CATATAN_HARIAN_BELUM", {
        kode_tps: String(n.data.kode_tps ?? n.objekKode),
      });
    case "KONTRAK_PERLU_KONFIRMASI":
      return isi("NTF_KONTRAK_PERLU_KONFIRMASI", {
        nama_kawasan: String(n.data.nama_kawasan ?? ""),
      });
    case "PERMINTAAN_KOREKSI":
      return isi("NTF_PERMINTAAN_KOREKSI", { kode: n.objekKode });
    case "IZIN_DIPUTUS":
      return isi("NTF_IZIN_DIPUTUS", { status: String(n.data.status ?? "") });
    case "TAGIHAN_TERBIT":
      return isi("NTF_TAGIHAN_TERBIT", {
        nomor: n.objekKode,
        jumlah: Number(n.data.jumlah ?? 0),
      });
    case "UJI_COBA_BERAKHIR":
      return isi("NTF_UJI_COBA_BERAKHIR", {
        tanggal: String(n.data.tanggal ?? ""),
      });
    default:
      return n.objekKode;
  }
}

function tautanObjek(n: ItemNotifikasi): string | null {
  if (n.objekKode.startsWith("SRH-")) {
    return `/serah/${n.objekKode}`;
  }
  if (n.jenis === "KONTRAK_PERLU_KONFIRMASI") {
    return "/kawasan/kontrak";
  }
  if (
    n.jenis === "PRIORITAS_ANGKUT" ||
    n.jenis === "WADAH_LEWAT_BATAS" ||
    n.jenis === "CATATAN_HARIAN_BELUM"
  ) {
    return "/kawasan/tps";
  }
  return null;
}

export default function HalamanNotifikasi() {
  const [daftar, setDaftar] = useState<ItemNotifikasi[]>([]);
  const [hanyaBelumDibaca, setHanyaBelumDibaca] = useState(false);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [bisaPush, setBisaPush] = useState(false);
  const [adalahIos, setAdalahIos] = useState(false);
  const [izinPush, setIzinPush] = useState<NotificationPermission>("default");

  const muat = useCallback(async () => {
    setSedangMuat(true);
    setGalat(null);

    const res = await panggil("GET", "/api/notifikasi", {
      kueri: hanyaBelumDibaca ? { belumDibaca: "true" } : {},
    });

    setSedangMuat(false);

    if (res.ok) {
      setDaftar(res.data.notifikasi);
    } else {
      setGalat(res.pesan);
    }
  }, [hanyaBelumDibaca]);

  useEffect(() => {
    void muat();
  }, [muat]);

  // Hook SSE live sync (S18-1)
  useLangsung(
    useCallback((event) => {
      if (event.tipe === "notifikasi" || event.tipe === "serah") {
        void muat();
      }
    }, [muat]),
  );

  useEffect(() => {
    setBisaPush(cekPushDidukung());
    setAdalahIos(cekIosSafari());
    if (typeof window !== "undefined" && "Notification" in window) {
      setIzinPush(Notification.permission);
    }
  }, []);

  async function tandaiSemuaDibaca() {
    setGalat(null);
    const res = await panggil("POST", "/api/notifikasi/baca-semua", { body: {} });
    if (res.ok) {
      setDaftar((prev) => prev.map((n) => ({ ...n, dibaca: true })));
    } else {
      setGalat(res.pesan);
    }
  }

  async function tandaiSatuDibaca(id: string) {
    await panggil("POST", "/api/notifikasi/[id]/baca", {
      params: { id },
      body: {},
    });
    setDaftar((prev) => prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)));
  }

  async function aktifkanNotifikasiPush() {
    const sukses = await daftarkanPush();
    if (sukses) {
      setIzinPush("granted");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{TEKS.NTF_JUDUL}</h1>
        {daftar.some((n) => !n.dibaca) ? (
          <Tombol varian="sekunder" onClick={tandaiSemuaDibaca}>
            {TEKS.NTF_BACA_SEMUA}
          </Tombol>
        ) : null}
      </div>

      {bisaPush && izinPush !== "granted" ? (
        <Kartu className="flex flex-col gap-3 border-aksi/20 bg-aksi/5">
          <p className="text-sm text-tinta">{TEKS.NTF_IZIN_PUSH}</p>
          {adalahIos ? (
            <p className="text-xs text-tinta-redup">{TEKS.NTF_IZIN_PUSH_IOS}</p>
          ) : null}
          <div>
            <Tombol onClick={aktifkanNotifikasiPush}>{TEKS.NTF_IZIN_PUSH}</Tombol>
          </div>
        </Kartu>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setHanyaBelumDibaca(false)}
          className={`rounded-kontrol px-4 py-2 text-sm font-semibold ${
            !hanyaBelumDibaca
              ? "bg-aksi text-aksi-teks"
              : "border border-garis bg-kertas text-tinta"
          }`}
        >
          {TEKS.UMUM_SEMUA}
        </button>
        <button
          type="button"
          onClick={() => setHanyaBelumDibaca(true)}
          className={`rounded-kontrol px-4 py-2 text-sm font-semibold ${
            hanyaBelumDibaca
              ? "bg-aksi text-aksi-teks"
              : "border border-garis bg-kertas text-tinta"
          }`}
        >
          Belum dibaca
        </button>
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {!sedangMuat && daftar.length === 0 ? (
        <Kosong teks={TEKS.K_KOSONG_NOTIFIKASI} />
      ) : null}

      <div className="flex flex-col gap-3">
        {daftar.map((n) => {
          const tautan = tautanObjek(n);
          const pesan = susunPesanNotifikasi(n);

          return (
            <Kartu
              key={n.id}
              className={`flex flex-col gap-2 transition-colors ${
                !n.dibaca ? "border-l-4 border-l-aksi bg-aksi/5" : "border-garis-halus bg-kertas"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-base text-tinta font-medium">{pesan}</p>
                {!n.dibaca ? (
                  <span className="inline-flex items-center">
                    <span className="sr-only">Belum dibaca</span>
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-aksi" />
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-4 pt-2 text-xs text-tinta-redup">
                <span>{n.dibuatPada.slice(0, 16).replace("T", " ")}</span>
                <div className="flex items-center gap-3">
                  {!n.dibaca ? (
                    <button
                      type="button"
                      onClick={() => void tandaiSatuDibaca(n.id)}
                      className="font-semibold underline hover:text-tinta"
                    >
                      Tandai dibaca
                    </button>
                  ) : null}
                  {tautan ? (
                    <Link
                      href={tautan}
                      onClick={() => {
                        if (!n.dibaca) void tandaiSatuDibaca(n.id);
                      }}
                      className="font-semibold text-aksi underline"
                    >
                      {TEKS.UMUM_LIHAT_DETAIL}
                    </Link>
                  ) : null}
                </div>
              </div>
            </Kartu>
          );
        })}
      </div>
    </div>
  );
}
