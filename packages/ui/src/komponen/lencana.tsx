import type { Aliran, StatusSerah } from "@serah/kontrak/enum";
import { TEKS } from "@serah/kontrak/teks";
import { GAYA_STATUS, KELAS_ALIRAN, KUNCI_ALIRAN, KUNCI_ALIRAN_PENDEK, KUNCI_STATUS } from "../aliran";

/** Warna aliran selalu berpasangan dengan label teks. */
export function LencanaAliran({ aliran, pendek = false }: { aliran: Aliran; pendek?: boolean }) {
  const kunci = pendek ? KUNCI_ALIRAN_PENDEK[aliran] : KUNCI_ALIRAN[aliran];
  return (
    <span
      data-aliran={aliran}
      className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-base font-semibold ${KELAS_ALIRAN[aliran]}`}
    >
      <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-current" />
      {TEKS[kunci]}
    </span>
  );
}

/** Status serah. Tidak memakai merah; ikon teks membedakan selain warna. */
export function LencanaStatus({ status }: { status: StatusSerah }) {
  const gaya = GAYA_STATUS[status];
  return (
    <span
      data-status={status}
      className={`inline-flex min-h-8 items-center gap-2 rounded-full border-2 px-3 py-1 text-base font-semibold ${gaya.kelas}`}
    >
      <span aria-hidden="true">{gaya.ikon}</span>
      {TEKS[KUNCI_STATUS[status]]}
    </span>
  );
}
