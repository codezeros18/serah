import { TEKS, isi } from "@serah/kontrak/teks";
import { KerangkaPublik } from "@/lib/klien/komponen/kerangka-publik";
import { IkonLanding } from "@/lib/klien/komponen/ikon-landing";

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
    <KerangkaPublik>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="hero-masuk flex flex-col gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-aksi-latar">
            <IkonLanding nama="aturan" className="h-7 w-7" />
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-tinta sm:text-5xl [text-wrap:balance]">
            {TEKS.PRIV_JUDUL}
          </h1>
          <p className="text-sm text-tinta-redup">{TEKS.PRIV_VERSI}</p>
        </div>

        {/* Banner acuan UU 27/2022 */}
        <div
          role="note"
          className="muncul flex flex-col gap-3 rounded-3xl border border-aksi-garis bg-aksi-latar/60 p-6"
        >
          <span className="w-fit rounded-lg border border-aksi-garis bg-kertas px-3 py-1 text-xs font-medium text-aksi">
            UU 27/2022 PDP
          </span>
          <p className="text-sm leading-relaxed text-tinta">{TEKS.PRIV_9_ISI}</p>
        </div>

        <section aria-labelledby="privasi-poin-judul">
          <h2 id="privasi-poin-judul" className="sr-only">
            {TEKS.PRIV_JUDUL}
          </h2>
          <ol className="flex flex-col gap-4">
            {POIN_PRIVASI.map((poin, index) => (
              <li
                key={poin.judul}
                className="muncul group flex flex-col gap-3 rounded-3xl border border-garis-halus bg-kertas p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.10)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-latar text-sm font-semibold text-tinta transition-colors duration-300 group-hover:bg-aksi-latar group-hover:text-aksi">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight text-tinta">{poin.judul}</h3>
                </div>
                <p className="text-sm leading-relaxed text-tinta-redup sm:pl-12 sm:text-base">{poin.teks}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </KerangkaPublik>
  );
}
