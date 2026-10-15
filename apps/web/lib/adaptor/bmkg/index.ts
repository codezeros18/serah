import { buatSumberLive, buatSumberSnapshot } from "./sumber";
import type { SumberCuaca } from "./tipe";

export { derajatKeE6, poligonCapKeE6 } from "./e6";
export { parseCap, parseDaftarNowcast, provinsiDariJudul } from "./cap";
export { normalisasiPrakiraan } from "./prakiraan";
export { PembatasLaju, buatSumberLive, buatSumberSnapshot, cariDirSnapshot, BATAS_PER_MENIT, TIMEOUT_MS } from "./sumber";
export { GalatBmkg, KUNCI_ATRIBUSI_BMKG, SUMBER_BMKG, type ItemDaftarNowcast, type NowcastMentah, type PrakiraanMentah, type SumberCuaca } from "./tipe";

/** `BMKG_MODE=live|snapshot` (§O.1). Bila live gagal, otomatis cadangan snapshot (S27-2). */
export function buatSumberCuaca(mode: "live" | "snapshot"): SumberCuaca {
  if (mode === "snapshot") return buatSumberSnapshot();
  const live = buatSumberLive();
  const snapshot = buatSumberSnapshot();
  return {
    async prakiraan(adm4) {
      try {
        return await live.prakiraan(adm4);
      } catch {
        return await snapshot.prakiraan(adm4);
      }
    },
    async daftarNowcast() {
      try {
        return await live.daftarNowcast();
      } catch {
        return await snapshot.daftarNowcast();
      }
    },
    async detailNowcast(url) {
      try {
        return await live.detailNowcast(url);
      } catch {
        return await snapshot.detailNowcast(url);
      }
    },
    async nowcast(provinsi) {
      try {
        return await live.nowcast(provinsi);
      } catch {
        return await snapshot.nowcast(provinsi);
      }
    },
  };
}
