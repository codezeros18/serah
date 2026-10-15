import Link from "next/link";
import { Kartu } from "@serah/ui";
import { TEKS, isi } from "@serah/kontrak/teks";

const POIN_PRIVASI = [
  { judul: TEKS.PRIV_1_JUDUL, teks: isi("PRIV_1_ISI", { email_kontak: "kontak@serah.id" }) },
  { judul: TEKS.PRIV_2_JUDUL, teks: TEKS.PRIV_2_ISI },
  { judul: TEKS.PRIV_3_JUDUL, teks: TEKS.PRIV_3_ISI },
  { judul: TEKS.PRIV_4_JUDUL, teks: TEKS.PRIV_4_ISI },
  { judul: TEKS.PRIV_5_JUDUL, teks: TEKS.PRIV_5_ISI },
  { judul: TEKS.PRIV_6_JUDUL, teks: isi("PRIV_6_ISI", { hari_retensi_foto: "30" }) },
  { judul: TEKS.PRIV_7_JUDUL, teks: isi("PRIV_7_ISI", { email_kontak: "kontak@serah.id" }) },
  { judul: TEKS.PRIV_8_JUDUL, teks: TEKS.PRIV_8_ISI },
  { judul: TEKS.PRIV_9_JUDUL, teks: TEKS.PRIV_9_ISI },
] as const;

export default function HalamanPrivasi() {
  return (
    <div className="flex min-h-dvh flex-col bg-latar">
      {/* Header Navigasi */}
      <header className="border-b border-garis-halus bg-kertas px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-tinta">
            {TEKS.APP_NAMA}
          </Link>
          <nav aria-label="Navigasi Utama" className="flex items-center gap-4 sm:gap-6">
            <Link href="/tentang" className="text-sm font-semibold text-tinta-redup hover:text-tinta">
              {TEKS.TENTANG_JUDUL}
            </Link>
            <Link href="/harga" className="text-sm font-semibold text-tinta-redup hover:text-tinta">
              {TEKS.HRG_JUDUL}
            </Link>
            <Link href="/demo" className="text-sm font-semibold text-tinta-redup hover:text-tinta">
              {TEKS.LANDING_CTA_DEMO}
            </Link>
            <Link
              href="/masuk"
              className="inline-flex min-h-10 items-center justify-center rounded-kontrol border border-garis bg-kertas px-4 py-2 text-sm font-semibold text-tinta hover:bg-latar"
            >
              {TEKS.MASUK_JUDUL}
            </Link>
          </nav>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-tinta sm:text-4xl">
              {TEKS.PRIV_JUDUL}
            </h1>
            <p className="text-sm text-tinta-redup">{TEKS.PRIV_VERSI}</p>
          </div>

          {/* Banner Internal Acuan UU 27/2022 */}
          <div role="note" className="flex flex-col gap-2 rounded-kartu border border-garis bg-latar p-4 shadow-sm">
            <span className="w-fit rounded-kontrol border border-garis bg-kertas px-2.5 py-1 text-xs font-semibold text-tinta">
              UU 27/2022 PDP
            </span>
            <p className="text-sm text-tinta">{TEKS.PRIV_9_ISI}</p>
          </div>

          {/* 9 Poin Kebijakan Privasi */}
          <section className="flex flex-col gap-4" aria-labelledby="privasi-poin-judul">
            <h2 id="privasi-poin-judul" className="sr-only">
              {TEKS.PRIV_JUDUL}
            </h2>
            <ol className="flex flex-col gap-4">
              {POIN_PRIVASI.map((poin, index) => (
                <li key={index}>
                  <Kartu className="flex flex-col gap-2 border border-garis-halus bg-kertas p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-garis bg-latar text-xs font-bold text-tinta">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-bold text-tinta">{poin.judul}</h3>
                    </div>
                    <p className="pl-10 text-base leading-relaxed text-tinta-redup">{poin.teks}</p>
                  </Kartu>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-garis-halus bg-kertas px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-tinta-redup">{TEKS.KAKI_HAK_CIPTA}</p>
          <nav aria-label="Navigasi Kaki" className="flex flex-wrap items-center gap-6 text-sm text-tinta-redup">
            <Link href="/tentang" className="hover:text-tinta">
              {TEKS.TENTANG_JUDUL}
            </Link>
            <Link href="/harga" className="hover:text-tinta">
              {TEKS.HRG_JUDUL}
            </Link>
            <Link href="/privasi" className="hover:text-tinta">
              {TEKS.PRIV_JUDUL}
            </Link>
            <Link href="/syarat" className="hover:text-tinta">
              {TEKS.SYR_JUDUL}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
