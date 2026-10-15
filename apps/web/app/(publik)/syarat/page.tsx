import { TEKS } from "@serah/kontrak/teks";
import { KerangkaPublik } from "@/lib/klien/komponen/kerangka-publik";
import { IkonLanding } from "@/lib/klien/komponen/ikon-landing";

const DAFTAR_SYARAT = [
  TEKS.SYR_1,
  TEKS.SYR_2,
  TEKS.SYR_3,
  TEKS.SYR_4,
  TEKS.SYR_5,
  TEKS.SYR_6,
] as const;

export default function HalamanSyarat() {
  return (
    <KerangkaPublik>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="hero-masuk flex flex-col gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-aksi-latar">
            <IkonLanding nama="laporan" className="h-7 w-7" />
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-tinta sm:text-5xl [text-wrap:balance]">
            {TEKS.SYR_JUDUL}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-tinta-redup">{TEKS.APP_DESKRIPSI}</p>
        </div>

        <section aria-labelledby="syarat-poin-judul">
          <h2 id="syarat-poin-judul" className="sr-only">
            {TEKS.SYR_JUDUL}
          </h2>
          <ol className="flex flex-col gap-4">
            {DAFTAR_SYARAT.map((syarat, index) => (
              <li
                key={syarat}
                className="muncul group flex items-start gap-4 rounded-3xl border border-garis-halus bg-kertas p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-aksi-garis hover:shadow-[0_16px_40px_rgba(36,87,197,0.10)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-latar text-sm font-semibold text-tinta transition-colors duration-300 group-hover:bg-aksi-latar group-hover:text-aksi">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-relaxed text-tinta sm:text-base">{syarat}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </KerangkaPublik>
  );
}
