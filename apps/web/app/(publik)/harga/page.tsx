import Link from "next/link";
import { TEKS } from "@serah/kontrak/teks";
import { Kartu } from "@serah/ui";

export default function HalamanHarga() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col bg-latar">
      <header className="flex items-center justify-between border-b border-garis-halus bg-kertas px-4 py-3">
        <Link href="/" className="text-base font-bold text-tinta">
          {TEKS.APP_NAMA}
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/masuk"
            className="inline-flex min-h-10 items-center justify-center rounded-kontrol border border-garis bg-kertas px-4 py-2 text-sm font-semibold text-tinta"
          >
            {TEKS.MASUK_JUDUL}
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 p-6 md:p-12">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-tinta md:text-4xl">
            {TEKS.HRG_JUDUL}
          </h1>
          <p className="mx-auto max-w-2xl text-base text-tinta-redup">
            {TEKS.HRG_SELALU_GRATIS}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Kartu Kawasan */}
          <Kartu className="flex flex-col justify-between gap-6 border-2 border-aksi bg-kertas p-6 shadow-sm">
            <div className="flex flex-col gap-4">
              <span className="inline-block w-fit rounded-kontrol bg-aksi/10 px-3 py-1 text-xs font-bold text-aksi">
                {TEKS.PERAN_PENGELOLA}
              </span>
              <h2 className="text-2xl font-bold text-tinta">
                {TEKS.HRG_KAWASAN}
              </h2>
              <p className="text-sm text-tinta-redup">
                {TEKS.HRG_KAWASAN_DETAIL}
              </p>
            </div>
            <div>
              <Link
                href="/mulai"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-kontrol bg-aksi px-6 py-3 text-center text-base font-bold text-aksi-teks hover:bg-aksi/90"
              >
                {TEKS.MULAI_JUDUL}
              </Link>
            </div>
          </Kartu>

          {/* Kartu Mitra Pengangkut & Penerima */}
          <Kartu className="flex flex-col justify-between gap-6 border border-garis-halus bg-kertas p-6 shadow-sm">
            <div className="flex flex-col gap-4">
              <span className="inline-block w-fit rounded-kontrol bg-latar px-3 py-1 text-xs font-bold text-tinta">
                {TEKS.PERAN_PENGANGKUT} &amp; {TEKS.PERAN_PENERIMA}
              </span>
              <h2 className="text-2xl font-bold text-tinta">
                {TEKS.HRG_MITRA}
              </h2>
              <p className="text-sm text-tinta-redup">
                {TEKS.HRG_SELALU_GRATIS}
              </p>
            </div>
            <div>
              <Link
                href="/daftar"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-kontrol border-2 border-aksi bg-kertas px-6 py-3 text-center text-base font-bold text-aksi hover:bg-aksi/5"
              >
                {TEKS.DAFTAR_JUDUL}
              </Link>
            </div>
          </Kartu>
        </div>

        <div className="rounded-kartu border border-garis-halus bg-kertas p-6 text-center">
          <p className="text-sm text-tinta-redup">
            {TEKS.HRG_SELALU_GRATIS}
          </p>
        </div>
      </main>
    </div>
  );
}
