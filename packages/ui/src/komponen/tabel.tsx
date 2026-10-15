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
      className="overflow-x-auto rounded-kartu border border-garis-halus bg-kertas shadow-xs"
    >
      <table className="w-full border-collapse text-left text-sm sm:text-base">
        <caption className="sr-only">{keterangan}</caption>
        <thead>
          <tr className="border-b border-garis-halus bg-slate-100/70 text-tinta font-bold">
            {kolom.map((k) => (
              <th
                key={k.kunci}
                scope="col"
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-tinta-redup ${
                  k.angka ? "text-right" : ""
                }`}
              >
                {k.judul}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-garis-halus">
          {baris.map((b) => (
            <tr
              key={kunciBaris(b)}
              className="transition-colors hover:bg-aksi-latar/40 duration-150"
            >
              {kolom.map((k) => (
                <td
                  key={k.kunci}
                  className={`px-4 py-3 text-tinta font-medium ${
                    k.angka ? "text-right tabular-nums font-bold font-mono" : ""
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
