"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { TEKS } from "@serah/kontrak/teks";

// Peta Leaflet untuk lokasi TPS. Ubin standar OpenStreetMap (tanpa API key; CARTO kini mewajibkan key). Tidak memakai geolokasi perangkat:
// titik hanya dari klik/geser penanda atau isian koordinat (CLAUDE.md §2.5).

const UBIN = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const PUSAT_AWAL: L.LatLngTuple = [-6.1754, 106.8272]; // Jakarta Pusat

function ikonPin(aktif: boolean): L.DivIcon {
  const warna = aktif ? "#0f766e" : "#64748b";
  return L.divIcon({
    className: "",
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
    html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 4px rgba(15,23,42,.35))"><path d="M17 1C8.7 1 2 7.6 2 15.8 2 26.6 17 43 17 43s15-16.400 15-27.200C32 7.600 25.300 1 17 1Z" fill="${warna}" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16" r="6" fill="#fff"/></svg>`,
  });
}

function buatPeta(el: HTMLElement): L.Map {
  const peta = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(PUSAT_AWAL, 12);
  L.tileLayer(UBIN, { maxZoom: 19, attribution: TEKS.PETA_ATRIBUSI }).addTo(peta);
  // Dialog/tab membuka dengan animasi: ukur ulang saat wadah berubah ukuran.
  const ro = new ResizeObserver(() => peta.invalidateSize());
  ro.observe(el);
  peta.on("unload", () => ro.disconnect());
  return peta;
}

const KELAS_PETA = "relative z-0 h-full w-full overflow-hidden rounded-2xl ring-1 ring-garis-halus";

export type TitikPeta = { id: string; nama: string; kode: string; lat: number; lon: number; aktif: boolean };

/** Pilih satu titik: klik peta atau geser penanda. `lat`/`lon` (derajat) menggerakkan penanda dari isian teks. */
export function PetaPilihTitik({ lat, lon, onPilih }: { lat: number | null; lon: number | null; onPilih: (lat: number, lon: number) => void }) {
  const wadah = useRef<HTMLDivElement>(null);
  const peta = useRef<L.Map | null>(null);
  const penanda = useRef<L.Marker | null>(null);
  const onPilihRef = useRef(onPilih);
  onPilihRef.current = onPilih;

  useEffect(() => {
    if (!wadah.current) return;
    const p = buatPeta(wadah.current);
    peta.current = p;
    const taruh = (ll: L.LatLng) => {
      if (!penanda.current) {
        const m = L.marker(ll, { draggable: true, icon: ikonPin(true) }).addTo(p);
        m.on("dragend", () => onPilihRef.current(m.getLatLng().lat, m.getLatLng().lng));
        penanda.current = m;
      } else penanda.current.setLatLng(ll);
    };
    p.on("click", (e: L.LeafletMouseEvent) => {
      taruh(e.latlng);
      onPilihRef.current(e.latlng.lat, e.latlng.lng);
    });
    return () => {
      p.remove();
      peta.current = null;
      penanda.current = null;
    };
  }, []);

  useEffect(() => {
    const p = peta.current;
    if (!p || lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const ll = L.latLng(lat, lon);
    if (!penanda.current) {
      const m = L.marker(ll, { draggable: true, icon: ikonPin(true) }).addTo(p);
      m.on("dragend", () => onPilihRef.current(m.getLatLng().lat, m.getLatLng().lng));
      penanda.current = m;
    } else if (!penanda.current.getLatLng().equals(ll, 1e-7)) penanda.current.setLatLng(ll);
    if (!p.getBounds().contains(ll)) p.setView(ll, Math.max(p.getZoom(), 15));
  }, [lat, lon]);

  return <div ref={wadah} role="application" aria-label={TEKS.PETA_ARIA} className={KELAS_PETA} data-testid="peta-pilih" />;
}

/** Semua TPS sebagai penanda; peta menyesuaikan batas. */
export function PetaDaftarTps({ titik }: { titik: TitikPeta[] }) {
  const wadah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wadah.current) return;
    const p = buatPeta(wadah.current);
    const lapis = L.featureGroup().addTo(p);
    for (const t of titik) {
      const m = L.marker([t.lat, t.lon], { icon: ikonPin(t.aktif), title: t.nama }).addTo(lapis);
      const isi = document.createElement("div");
      const judul = document.createElement("strong");
      judul.textContent = t.nama;
      const kode = document.createElement("div");
      kode.textContent = t.kode;
      kode.style.fontFamily = "ui-monospace, monospace";
      kode.style.fontSize = "12px";
      isi.append(judul, kode);
      m.bindPopup(isi);
    }
    if (titik.length > 0) p.fitBounds(lapis.getBounds().pad(0.35), { maxZoom: 16 });
    return () => {
      p.remove();
    };
  }, [titik]);

  return <div ref={wadah} role="application" aria-label={TEKS.PETA_ARIA} className={KELAS_PETA} data-testid="peta-daftar" />;
}
