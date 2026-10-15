"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { z } from "zod";
import type { AkunDataSayaKeluaran, AnggotaDaftarKeluaran, Peran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Dialog, Kartu, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { rutePeran } from "@/lib/klien/rute-peran";
import { useSesi } from "@/lib/klien/sesi";
import { unduhBerkas } from "@/lib/klien/unduh";

type DataSaya = z.infer<typeof AkunDataSayaKeluaran>;
type ItemAnggota = z.infer<typeof AnggotaDaftarKeluaran>["anggota"][number];

export default function HalamanAkun() {
  const router = useRouter();
  const { keadaan, muatUlang } = useSesi();

  const [dataSaya, setDataSaya] = useState<DataSaya | null>(null);
  const [daftarAnggota, setDaftarAnggota] = useState<ItemAnggota[]>([]);
  const [ntfEmail, setNtfEmail] = useState(true);
  const [ntfPush, setNtfPush] = useState(false);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Dialog undang anggota
  const [undangTerbuka, setUndangTerbuka] = useState(false);
  const [emailUndang, setEmailUndang] = useState("");
  const [peranUndang, setPeranUndang] = useState<"PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA">("PETUGAS");
  const [sedangUndang, setSedangUndang] = useState(false);

  // Dialog tarik persetujuan
  const [tarikTerbuka, setTarikTerbuka] = useState(false);
  const [sedangTarik, setSedangTarik] = useState(false);

  // Dialog hapus akun
  const [hapusTerbuka, setHapusTerbuka] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState("");
  const [sedangHapus, setSedangHapus] = useState(false);

  const muat = useCallback(async () => {
    setSedangMuat(true);
    setGalat(null);

    const [rData, rNtf, rAnggota] = await Promise.all([
      panggil("GET", "/api/akun/data-saya", {}),
      panggil("GET", "/api/akun/notifikasi", {}),
      panggil("GET", "/api/anggota", {}),
    ]);

    setSedangMuat(false);

    if (rData.ok) {
      setDataSaya(rData.data);
    } else {
      setGalat(rData.pesan);
    }

    if (rNtf.ok && rNtf.data.preferensi[0]) {
      setNtfEmail(rNtf.data.preferensi[0].email);
      setNtfPush(rNtf.data.preferensi[0].push);
    }

    if (rAnggota.ok) {
      setDaftarAnggota(rAnggota.data.anggota);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function gantiOrganisasiPeran(organisasiId: string, peran: Peran) {
    setGalat(null);
    const res = await panggil("POST", "/api/sesi/organisasi", {
      body: { organisasiId, peran },
    });

    if (res.ok) {
      muatUlang();
      router.push(rutePeran(peran));
    } else {
      setGalat(res.pesan);
    }
  }

  async function ubahNotifikasi(email: boolean, push: boolean) {
    setNtfEmail(email);
    setNtfPush(push);
    if (!dataSaya || !keadaan || keadaan.status !== "siap" || !keadaan.sesi.organisasiAktif) return;

    await panggil("PUT", "/api/akun/notifikasi", {
      body: {
        organisasiId: keadaan.sesi.organisasiAktif.id,
        email,
        push,
      },
    });
  }

  async function tanganiUndang(e: FormEvent) {
    e.preventDefault();
    setSedangUndang(true);
    setGalat(null);
    setPesanSukses(null);

    const res = await panggil("POST", "/api/undangan", {
      body: {
        email: emailUndang,
        peran: peranUndang,
      },
    });

    setSedangUndang(false);

    if (res.ok) {
      setUndangTerbuka(false);
      setEmailUndang("");
      setPesanSukses(TEKS.AGT_UNDANGAN_TERKIRIM);
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiNonaktifAnggota(id: string) {
    setGalat(null);
    const res = await panggil("POST", "/api/anggota/[id]/nonaktif", {
      params: { id },
      body: {},
    });

    if (res.ok) {
      await muat();
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiUnduhData() {
    setGalat(null);
    const res = await unduhBerkas("/api/akun/data-saya", { namaCadangan: "data-saya-serah.json" });
    if (!res.ok) setGalat(res.pesan);
  }

  async function tanganiTarikPersetujuan() {
    setSedangTarik(true);
    setGalat(null);
    const res = await panggil("POST", "/api/akun/tarik-persetujuan", { body: {} });
    setSedangTarik(false);

    if (res.ok) {
      router.push("/masuk");
    } else {
      setGalat(res.pesan);
    }
  }

  async function tanganiHapusAkun(e: FormEvent) {
    e.preventDefault();
    if (konfirmasiHapus !== "HAPUS") return;

    setSedangHapus(true);
    setGalat(null);
    const res = await panggil("POST", "/api/akun/hapus", {
      body: { konfirmasi: "HAPUS" },
    });
    setSedangHapus(false);

    if (res.ok) {
      router.push("/masuk");
    } else {
      setGalat(res.pesan);
    }
  }

  const sesi = keadaan.status === "siap" ? keadaan.sesi : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{TEKS.AKUN_JUDUL}</h1>

      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {pesanSukses ? (
        <div className="rounded-kartu border border-garis bg-kertas p-4 text-sm font-semibold">
          {pesanSukses}
        </div>
      ) : null}
      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {/* 1. Organisasi dan peran */}
      <Kartu className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{TEKS.AKUN_ORGANISASI}</h2>

        {sesi ? (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-tinta-redup">Organisasi aktif:</span>
            <span className="font-semibold">{sesi.organisasiAktif?.nama ?? "-"}</span>
            <span className="text-tinta-redup">Peran aktif:</span>
            <span className="font-semibold">{sesi.peran ?? "-"}</span>
          </div>
        ) : null}

        {dataSaya && dataSaya.keanggotaan.length > 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-sm font-semibold">{TEKS.AKUN_GANTI_PERAN}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {dataSaya.keanggotaan
                .filter((k) => k.aktif)
                .map((k) => {
                  const adalahAktif =
                    sesi?.organisasiAktif?.id === k.organisasiId && sesi?.peran === k.peran;
                  return (
                    <button
                      key={`${k.organisasiId}-${k.peran}`}
                      type="button"
                      disabled={adalahAktif}
                      onClick={() => void gantiOrganisasiPeran(k.organisasiId, k.peran)}
                      className={`flex min-h-12 items-center justify-between rounded-kontrol border p-3 text-left text-sm ${
                        adalahAktif
                          ? "border-aksi bg-aksi/10 font-bold"
                          : "border-garis bg-kertas hover:bg-black/5"
                      }`}
                    >
                      <div>
                        <div>{k.organisasiNama}</div>
                        <div className="text-xs text-tinta-redup">{k.peran}</div>
                      </div>
                      {adalahAktif ? (
                        <span className="text-xs font-semibold text-aksi">Aktif</span>
                      ) : null}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : null}
      </Kartu>

      {/* 2. Preferensi Notifikasi */}
      <Kartu className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{TEKS.AKUN_NOTIFIKASI}</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={ntfEmail}
              onChange={(e) => void ubahNotifikasi(e.target.checked, ntfPush)}
              className="h-5 w-5 rounded border-garis"
            />
            {TEKS.AKUN_NTF_EMAIL}
          </label>
          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={ntfPush}
              onChange={(e) => void ubahNotifikasi(ntfEmail, e.target.checked)}
              className="h-5 w-5 rounded border-garis"
            />
            {TEKS.AKUN_NTF_PUSH}
          </label>
        </div>
      </Kartu>

      {/* 3. Anggota Organisasi */}
      {sesi?.organisasiAktif ? (
        <Kartu className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-bold">{TEKS.AGT_JUDUL}</h2>
            <Tombol onClick={() => setUndangTerbuka(true)}>{TEKS.AGT_UNDANG}</Tombol>
          </div>

          <div className="flex flex-col divide-y divide-garis-halus">
            {daftarAnggota.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold">{a.peran}</span>
                  <span className="text-xs text-tinta-redup">
                    {isi("AGT_SEJAK", { tanggal: a.sejak.slice(0, 10) })}
                  </span>
                </div>
                {a.aktif ? (
                  <Tombol
                    varian="sekunder"
                    className="text-xs"
                    onClick={() => void tanganiNonaktifAnggota(a.id)}
                  >
                    {TEKS.AGT_NONAKTIF}
                  </Tombol>
                ) : (
                  <span className="text-xs text-tinta-redup">{TEKS.KND_NONAKTIF}</span>
                )}
              </div>
            ))}
          </div>
        </Kartu>
      ) : null}

      {/* 4. Privasi PDP */}
      <Kartu className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{TEKS.AKUN_PRIVASI}</h2>
        <div className="flex flex-wrap gap-3">
          <Tombol varian="sekunder" onClick={() => void tanganiUnduhData()}>
            {TEKS.AKUN_UNDUH_DATA}
          </Tombol>
          <Tombol varian="sekunder" onClick={() => setTarikTerbuka(true)}>
            {TEKS.AKUN_TARIK}
          </Tombol>
          <Tombol varian="sekunder" onClick={() => setHapusTerbuka(true)}>
            {TEKS.AKUN_HAPUS}
          </Tombol>
        </div>
      </Kartu>

      {/* Dialog Undang Anggota */}
      <Dialog
        terbuka={undangTerbuka}
        judul={TEKS.AGT_UNDANG}
        onTutup={() => setUndangTerbuka(false)}
      >
        <form onSubmit={tanganiUndang} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {TEKS.AGT_EMAIL}
            <input
              type="email"
              required
              value={emailUndang}
              onChange={(e) => setEmailUndang(e.target.value)}
              className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            {TEKS.AGT_PERAN}
            <select
              value={peranUndang}
              onChange={(e) =>
                setPeranUndang(
                  e.target.value as "PETUGAS" | "PENGELOLA" | "PENGANGKUT" | "PENERIMA",
                )
              }
              className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 text-base text-tinta"
            >
              <option value="PETUGAS">PETUGAS</option>
              <option value="PENGELOLA">PENGELOLA</option>
              <option value="PENGANGKUT">PENGANGKUT</option>
              <option value="PENERIMA">PENERIMA</option>
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <Tombol
              varian="sekunder"
              onClick={() => setUndangTerbuka(false)}
              disabled={sedangUndang}
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol type="submit" disabled={sedangUndang}>
              {TEKS.UMUM_KIRIM}
            </Tombol>
          </div>
        </form>
      </Dialog>

      {/* Dialog Tarik Persetujuan */}
      <Dialog
        terbuka={tarikTerbuka}
        judul={TEKS.AKUN_TARIK}
        onTutup={() => setTarikTerbuka(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-tinta">{TEKS.AKUN_TARIK_PERINGATAN}</p>
          <div className="flex justify-end gap-2">
            <Tombol
              varian="sekunder"
              onClick={() => setTarikTerbuka(false)}
              disabled={sedangTarik}
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol onClick={tanganiTarikPersetujuan} disabled={sedangTarik}>
              {TEKS.UMUM_KONFIRMASI}
            </Tombol>
          </div>
        </div>
      </Dialog>

      {/* Dialog Hapus Akun */}
      <Dialog
        terbuka={hapusTerbuka}
        judul={TEKS.AKUN_HAPUS}
        onTutup={() => setHapusTerbuka(false)}
      >
        <form onSubmit={tanganiHapusAkun} className="flex flex-col gap-4">
          <p className="text-sm text-tinta">{TEKS.AKUN_HAPUS_PERINGATAN}</p>
          <input
            type="text"
            required
            placeholder="HAPUS"
            value={konfirmasiHapus}
            onChange={(e) => setKonfirmasiHapus(e.target.value)}
            className="min-h-12 rounded-kontrol border border-garis bg-kertas px-3 font-mono text-base text-tinta"
          />
          <div className="flex justify-end gap-2">
            <Tombol
              varian="sekunder"
              onClick={() => setHapusTerbuka(false)}
              disabled={sedangHapus}
            >
              {TEKS.UMUM_BATAL}
            </Tombol>
            <Tombol
              type="submit"
              disabled={konfirmasiHapus !== "HAPUS" || sedangHapus}
            >
              {TEKS.UMUM_HAPUS}
            </Tombol>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
