import { buatSumberLive, buatSumberSnapshot } from "./sumber";
import type { SumberCuaca } from "./tipe";

export { derajatKeE6, poligonCapKeE6 } from "./e6";
export { parseCap, parseDaftarNowcast, provinsiDariJudul } from "./cap";
export { normalisasiPrakiraan } from "./prakiraan";
export { PembatasLaju, buatSumberLive, buatSumberSnapshot, cariDirSnapshot, BATAS_PER_MENIT, TIMEOUT_MS } from "./sumber";
export { GalatBmkg, KUNCI_ATRIBUSI_BMKG, SUMBER_BMKG, type ItemDaftarNowcast, type NowcastMentah, type PrakiraanMentah, type SumberCuaca } from "./tipe";

/** `BMKG_MODE=live|snapshot` (§O.1). */
export function buatSumberCuaca(mode: "live" | "snapshot"): SumberCuaca {
  return mode === "live" ? buatSumberLive() : buatSumberSnapshot();
}
