import { LabelDemo } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";

// Panel tiga layar diisi sprint S27/S28. Kerangka: label demo + judul.
export default function HalamanDemo() {
  return (
    <div>
      <LabelDemo />
      <h1 className="p-4 text-2xl font-bold">{TEKS.APP_NAMA}</h1>
    </div>
  );
}
