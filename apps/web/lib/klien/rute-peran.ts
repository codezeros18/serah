import type { Peran } from "@serah/kontrak/enum";

export function rutePeran(peran: Peran | null | undefined): string {
  switch (peran) {
    case "PETUGAS":
      return "/petugas";
    case "PENGANGKUT":
      return "/pengangkut";
    case "PENGELOLA":
      return "/kawasan";
    case "PENERIMA":
      return "/penerima";
    case "ADMIN":
      return "/admin";
    default:
      return "/mulai";
  }
}
