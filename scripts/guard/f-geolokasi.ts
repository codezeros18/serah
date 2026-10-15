import type { Guard, Temuan } from "./jenis.ts";
import { adalahGuard, adalahKode, bersihkanKode, diperiksa, nomorBaris, temukan } from "./util.ts";

// (f) Nol GPS: dilarang navigator.geolocation & pustaka geolokasi (CLAUDE.md §2.5, §6).

const POLA_API = /\bnavigator\s*\.\s*geolocation\b|\.\s*geolocation\s*\.|\b(?:getCurrentPosition|watchPosition)\s*\(/g;
const POLA_PAKET = /"([^"]*(?:geoloc|geoip|geolib|gps)[^"]*)"\s*:/gi;

export const guardGeolokasi: Guard = {
  kode: "f",
  nama: "geolokasi",
  keterangan: "navigator.geolocation & pustaka geolokasi dilarang",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (adalahGuard(b.jalur)) continue;
      if (adalahKode(b.jalur)) {
        temuan.push(...temukan(b, bersihkanKode(b.isi), POLA_API, () => "akses geolokasi perangkat"));
      } else if (b.jalur.endsWith("package.json")) {
        for (const m of b.isi.matchAll(POLA_PAKET)) {
          temuan.push({ berkas: b.jalur, baris: nomorBaris(b.isi, m.index ?? 0), pesan: `dependensi geolokasi "${m[1]}"` });
        }
      }
    }
    return diperiksa(temuan);
  },
};
