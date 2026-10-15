import { notFound } from "next/navigation";
import { MOCK_AKTIF } from "@/lib/klien/api";
import { Galeri } from "@/lib/klien/komponen/galeri";

// Halaman pengembangan: semua token & komponen. Tidak tersedia di produksi tanpa mock.
export default function HalamanKomponen() {
  if (process.env.NODE_ENV === "production" && !MOCK_AKTIF) notFound();
  return <Galeri />;
}
