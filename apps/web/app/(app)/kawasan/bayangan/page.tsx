import { KunciHak } from "@/lib/klien/komponen/kunci-hak";
import { LayarModeBayangan } from "@/lib/klien/komponen/layar-mode-bayangan";

export default function HalamanModeBayangan() {
  return (
    <KunciHak kunci="mode_bayangan">
      <LayarModeBayangan />
    </KunciHak>
  );
}
