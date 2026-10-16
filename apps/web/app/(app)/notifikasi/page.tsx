"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { NotifikasiDaftarKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat } from "@serah/ui";
import { Rangka } from "@/lib/klien/komponen/rangka";
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

  const adaBelumDibaca = daftar.some((n) => !n.dibaca);
  const jumlahBelum = daftar.filter((n) => !n.dibaca).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 text-tinta">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.NTF_JUDUL}</h1>
          {adaBelumDibaca ? (
            <span className="rounded-full bg-aksi px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white">
              {jumlahBelum}
            </span>
          ) : null}
        </div>

        {adaBelumDibaca ? (
          <button
            type="button"
            onClick={tandaiSemuaDibaca}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-garis-halus bg-white/80 px-4 text-sm font-medium text-tinta shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <path d="m4 12.500 4 4L16 8m-3 8.500 1 1L21 8" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {TEKS.NTF_BACA_SEMUA}
          </button>
        ) : null}
      </div>

      {/* Izin push */}
      {bisaPush && izinPush !== "granted" ? (
        <div className="flex items-center gap-4 rounded-3xl border border-aksi-garis bg-gradient-to-br from-white to-aksi-latar p-4 shadow-[0_12px_32px_rgba(36,87,197,0.10)]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-aksi shadow-[0_4px_14px_rgba(15,23,42,0.08)]">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
              <path d="M6 16.500V11a6 6 0 1 1 12 0v5.500l1.500 2h-15l1.500-2ZM10 20.500a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={aktifkanNotifikasiPush}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-aksi px-4 text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover"
            >
              {TEKS.NTF_IZIN_PUSH}
            </button>
            {adalahIos ? <p className="mt-2 text-xs leading-relaxed text-tinta-redup">{TEKS.NTF_IZIN_PUSH_IOS}</p> : null}
          </div>
        </div>
      ) : null}

      {/* Filter */}
      <div role="group" aria-label={TEKS.NTF_JUDUL} className="flex gap-2">
        {(
          [
            { nilai: false, teks: TEKS.UMUM_SEMUA },
            { nilai: true, teks: "Belum dibaca" },
          ] as const
        ).map((f) => (
          <button
            key={String(f.nilai)}
            type="button"
            aria-pressed={hanyaBelumDibaca === f.nilai}
            onClick={() => setHanyaBelumDibaca(f.nilai)}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
              hanyaBelumDibaca === f.nilai
                ? "border-tinta bg-tinta text-white shadow-sm"
                : "border-garis-halus bg-kertas text-tinta hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
            }`}
          >
            {f.teks}
          </button>
        ))}
      </div>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {sedangMuat ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{TEKS.UMUM_MUAT}</span>
          <Rangka className="h-20 w-full rounded-3xl" />
          <Rangka className="h-20 w-full rounded-3xl" />
        </div>
      ) : null}

      {!sedangMuat && daftar.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-garis-halus bg-latar/50 px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-garis shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden="true">
              <path d="M6 16.500V11a6 6 0 1 1 12 0v5.500l1.500 2h-15l1.500-2ZM10 20.500a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-base text-tinta-redup">{TEKS.K_KOSONG_NOTIFIKASI}</p>
        </div>
      ) : null}

      {/* Daftar */}
      <ul className="flex flex-col gap-3">
        {daftar.map((n) => {
          const tautan = tautanObjek(n);
          const pesan = susunPesanNotifikasi(n);

          return (
            <li
              key={n.id}
              className={`muncul flex gap-3 rounded-3xl border p-4 transition-all duration-200 hover:-translate-y-0.5 ${
                !n.dibaca
                  ? "border-aksi-garis bg-gradient-to-br from-white to-aksi-latar/50 shadow-[0_8px_24px_rgba(36,87,197,0.10)]"
                  : "border-garis-halus bg-kertas shadow-[0_4px_16px_rgba(15,23,42,0.04)]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  !n.dibaca ? "bg-aksi text-white" : "bg-latar text-tinta-redup"
                }`}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path d="M6 16.500V11a6 6 0 1 1 12 0v5.500l1.500 2h-15l1.500-2ZM10 20.500a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-relaxed text-tinta">{pesan}</p>
                  {!n.dibaca ? (
                    <span className="inline-flex items-center pt-1.5">
                      <span className="sr-only">Belum dibaca</span>
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-aksi" />
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tinta-redup">
                  <span className="font-mono">{n.dibuatPada.slice(0, 16).replace("T", " ")}</span>
                  <div className="flex items-center gap-2">
                    {!n.dibaca ? (
                      <button
                        type="button"
                        onClick={() => void tandaiSatuDibaca(n.id)}
                        className="rounded-lg px-2.5 py-1.5 font-medium text-tinta transition-colors hover:bg-aksi-latar hover:text-aksi"
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
                        className="rounded-lg bg-aksi-latar px-2.5 py-1.5 font-medium text-aksi transition-colors hover:bg-aksi hover:text-white"
                      >
                        {TEKS.UMUM_LIHAT_DETAIL} →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
