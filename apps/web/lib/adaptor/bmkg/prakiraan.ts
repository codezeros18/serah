import type { ModeData } from "@serah/kontrak";
import { GalatBmkg, type PrakiraanMentah, type SlotMentah } from "./tipe";

// Normalisasi JSON prakiraan BMKG (diverifikasi dari respons nyata 15 Okt 2026):
//   { lokasi, data: [ { lokasi, cuaca: [ [slot, …] /* hari 1 */, [slot, …], [slot, …] ] } ] }
//   slot: { datetime:"2026-10-15T05:00:00Z", utc_datetime:"2026-10-15 05:00:00", weather_desc, weather_desc_en,
//           analysis_date:"2026-10-15T00:00:00" (tanpa zona; dibaca UTC), … }
// Parser toleran terhadap field tambahan. Nilai yang tidak terbaca → GalatBmkg("FORMAT"), tidak pernah ditebak.

const adalahObjek = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function waktuUtc(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(t)) iso = t;
  else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(t)) iso = `${t.replace(" ", "T")}Z`;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalisasiPrakiraan(json: unknown, adm4: string, mode: ModeData): PrakiraanMentah {
  if (!adalahObjek(json) || !Array.isArray(json.data)) throw new GalatBmkg("FORMAT", "Respons prakiraan tidak berbentuk dikenal");
  const slot: SlotMentah[] = [];
  let analysisDate: Date | null = null;

  for (const entri of json.data) {
    if (!adalahObjek(entri) || !Array.isArray(entri.cuaca)) continue;
    for (const hari of entri.cuaca) {
      if (!Array.isArray(hari)) continue;
      for (const s of hari) {
        if (!adalahObjek(s)) continue;
        const slotUtc = waktuUtc(s.datetime) ?? waktuUtc(s.utc_datetime);
        const desc = typeof s.weather_desc === "string" ? s.weather_desc.trim() : "";
        const analisis = waktuUtc(s.analysis_date);
        if (!slotUtc || !desc || !analisis) throw new GalatBmkg("FORMAT", "Slot prakiraan tidak lengkap");
        if (!analysisDate || analisis.getTime() > analysisDate.getTime()) analysisDate = analisis;
        slot.push({ slotUtc, weatherDesc: desc, weatherDescEn: typeof s.weather_desc_en === "string" ? s.weather_desc_en.trim() : null });
      }
    }
  }
  if (slot.length === 0 || !analysisDate) throw new GalatBmkg("FORMAT", "Prakiraan tidak memuat slot");
  slot.sort((a, b) => a.slotUtc.getTime() - b.slotUtc.getTime());
  return { adm4, analysisDate, mode, slot };
}
