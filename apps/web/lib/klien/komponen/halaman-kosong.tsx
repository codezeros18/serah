import { Kosong } from "@serah/ui";
import { TEKS, type KunciTeks } from "@serah/kontrak/teks";

/** Kerangka layar yang diisi sprint layar berikutnya (S09–S14). Judul dari TEKS. */
export function HalamanKosong({ judul, kosong }: { judul: KunciTeks; kosong?: KunciTeks }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS[judul]}</h1>
      {kosong ? <Kosong teks={TEKS[kosong]} /> : null}
    </div>
  );
}
