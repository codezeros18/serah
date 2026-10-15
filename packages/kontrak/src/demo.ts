// Akun demo (hanya DEMO_MODE=true): `<peran huruf kecil>@demo.serah.id`. Dipakai seed & POST /api/auth/demo.
export const DOMAIN_EMAIL_DEMO = "demo.serah.id";

export function emailDemo(peran: string): string {
  return `${peran.toLowerCase()}@${DOMAIN_EMAIL_DEMO}`;
}
