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
    <div role="region" aria-label={keterangan} tabIndex={0} className="overflow-x-auto rounded-kartu border border-garis-halus bg-kertas">
      <table className="w-full border-collapse text-left text-base">
        <caption className="sr-only">{keterangan}</caption>
        <thead>
          <tr className="border-b-2 border-garis bg-latar">
            {kolom.map((k) => (
              <th key={k.kunci} scope="col" className={`px-3 py-2 font-semibold ${k.angka ? "text-right" : ""}`}>
                {k.judul}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={kunciBaris(b)} className="border-b border-garis-halus last:border-0">
              {kolom.map((k) => (
                <td key={k.kunci} className={`px-3 py-2 ${k.angka ? "text-right tabular-nums" : ""}`}>
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
