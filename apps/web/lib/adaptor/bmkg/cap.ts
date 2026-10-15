import { XMLParser } from "fast-xml-parser";
import { poligonCapKeE6 } from "./e6";
import { GalatBmkg, type ItemDaftarNowcast, type NowcastMentah } from "./tipe";

// RSS daftar & CAP 1.2 nowcast BMKG (BLUEPRINT §O.2). Struktur diverifikasi dari respons nyata 15 Okt 2026:
//   RSS: rss.channel.item[] { title:"Hujan Lebat disertai Petir di <Provinsi>", link:".../CKR20261015003_alert.xml" }
//   CAP: alert.identifier, alert.info { event, effective, expires, headline, description, area { areaDesc, polygon[] } }
//   polygon = "lat,lon lat,lon …" (3 desimal, titik penutup = titik awal); satu `<area>` memuat banyak `<polygon>`.

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false, // semua nilai tetap string: koordinat tidak pernah menjadi Number
  trimValues: true,
  isArray: (nama) => nama === "item" || nama === "polygon" || nama === "area" || nama === "info",
});

const adalahObjek = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const teks = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function parseXml(xml: string): Record<string, unknown> {
  try {
    const hasil: unknown = parser.parse(xml);
    if (!adalahObjek(hasil)) throw new Error("bukan objek");
    return hasil;
  } catch {
    throw new GalatBmkg("FORMAT", "XML BMKG tidak dapat dibaca");
  }
}

export function provinsiDariJudul(judul: string): string | null {
  const i = judul.lastIndexOf(" di ");
  const p = i >= 0 ? judul.slice(i + 4).trim() : "";
  return p.length > 0 ? p : null;
}

export function kodeDariUrl(url: string): string {
  const m = /\/([^/]+)_alert\.xml$/.exec(url);
  return m?.[1] ?? url;
}

export function parseDaftarNowcast(xml: string): ItemDaftarNowcast[] {
  const akar = parseXml(xml);
  const rss = akar.rss;
  const channel = adalahObjek(rss) ? rss.channel : undefined;
  if (!adalahObjek(channel)) throw new GalatBmkg("FORMAT", "RSS nowcast tidak berbentuk dikenal");
  const item = Array.isArray(channel.item) ? channel.item : [];
  const keluar: ItemDaftarNowcast[] = [];
  for (const it of item) {
    if (!adalahObjek(it)) continue;
    const url = teks(it.link);
    const judul = teks(it.title);
    if (!url || !judul) continue;
    keluar.push({ url, kode: kodeDariUrl(url), judul, provinsi: provinsiDariJudul(judul) });
  }
  return keluar;
}

/** Waktu CAP berformat ISO dengan offset ("2026-10-15T12:06:00+07:00"); tanpa offset ditolak. */
function waktuCap(v: unknown): Date {
  const t = teks(v);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(t)) throw new GalatBmkg("FORMAT", "Waktu CAP tidak sah");
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) throw new GalatBmkg("FORMAT", "Waktu CAP tidak sah");
  return d;
}

export function parseCap(xml: string): NowcastMentah {
  const akar = parseXml(xml);
  const alert = akar.alert;
  if (!adalahObjek(alert)) throw new GalatBmkg("FORMAT", "CAP tidak memuat alert");
  const identifierCap = teks(alert.identifier);
  const info = Array.isArray(alert.info) ? alert.info.find(adalahObjek) : undefined;
  if (!identifierCap || !info) throw new GalatBmkg("FORMAT", "CAP tidak memuat identifier/info");

  const poligonE6 = [];
  let provinsi = "";
  for (const area of Array.isArray(info.area) ? info.area : []) {
    if (!adalahObjek(area)) continue;
    if (!provinsi) provinsi = teks(area.areaDesc);
    for (const p of Array.isArray(area.polygon) ? area.polygon : []) {
      const cincin = poligonCapKeE6(teks(p));
      if (cincin.length >= 3) poligonE6.push(cincin);
    }
  }

  const headline = teks(info.headline);
  return {
    identifierCap,
    provinsi: provinsi || provinsiDariJudul(headline) || "",
    event: teks(info.event),
    headline,
    deskripsi: teks(info.description),
    effective: waktuCap(info.effective),
    expires: waktuCap(info.expires),
    poligonE6,
  };
}
