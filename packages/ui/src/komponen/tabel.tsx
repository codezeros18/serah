import type { ReactNode } from "react";

export type KolomTabel<T> = {
  kunci: string;
  judul: string;
  sel: (baris: T) => ReactNode;
  /** Angka rata kanan. */
  angka?: boolean;
};

export function Tabel<T>({
  keterangan,
  kolom,
  baris,
  kunciBaris,
}: {
  /** Keterangan tabel untuk pembaca layar. */
  keterangan: string;
  kolom: readonly KolomTabel<T>[];
  baris: readonly T[];
  kunciBaris: (baris: T) => string;
}) {
  return (
    <div
      role="region"
      aria-label={keterangan}
      tabIndex={0}
      className="gulir-halus relative overflow-x-auto rounded-3xl border border-garis-halus bg-kertas shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{keterangan}</caption>
        <thead>
          <tr className="border-b border-garis-halus bg-latar/80">
            {kolom.map((k) => (
              <th
                key={k.kunci}
                scope="col"
                className={`whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-tinta-redup ${
                  k.angka ? "text-right" : ""
                }`}
              >
                {k.judul}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-garis-halus/70">
          {baris.map((b) => (
            <tr key={kunciBaris(b)} className="transition-colors duration-150 hover:bg-aksi-latar/40">
              {kolom.map((k) => (
                <td
                  key={k.kunci}
                  className={`whitespace-nowrap px-4 py-3 text-tinta ${
                    k.angka ? "text-right font-mono font-medium tabular-nums" : ""
                  }`}
                >
                  {k.sel(b)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
