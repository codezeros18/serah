// Nama kawasan unik untuk test. Kode kawasan (KWS-xxxxx) unik GLOBAL dan dibentuk dari inisial kata nama; generator hanya
// mencoba 200 kandidat per nama, sehingga nama tetap yang dipakai berulang di skema lokal yang berumur panjang akhirnya
// menghabiskan kandidat (POST /api/kawasan → 500). Dua kata satu-huruf acak memberi 676 keluarga kode berbeda.
const huruf = () => String.fromCharCode(97 + Math.floor(Math.random() * 26));

export function namaUnik(dasar: string): string {
  return `${dasar} ${huruf()} ${huruf()}`;
}
