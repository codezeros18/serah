import { TEKS } from "@serah/kontrak/teks";

// Landing kerangka S00. Landing final dibangun jalur B (S27).
export default function HalamanLanding() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
      <p className="text-sm font-semibold tracking-widest">{TEKS.APP_NAMA}</p>
      <h1 className="text-3xl font-bold">{TEKS.LANDING_JUDUL}</h1>
      <p className="text-base">{TEKS.LANDING_SUB}</p>
    </main>
  );
}
