import { KunciHak } from "@/lib/klien/komponen/kunci-hak";
import { LayarTagihanAngkut } from "@/lib/klien/komponen/layar-tagihan-angkut";

export default function HalamanTagihanAngkutKawasan() {
  return (
    <KunciHak kunci="tagihan_angkut">
      <LayarTagihanAngkut peran="KAWASAN" />
    </KunciHak>
  );
}
