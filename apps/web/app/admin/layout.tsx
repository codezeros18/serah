import type { ReactNode } from "react";
import { KerangkaApp } from "@/lib/klien/komponen/kerangka-app";

export default function TataLetakAdmin({ children }: { children: ReactNode }) {
  return <KerangkaApp>{children}</KerangkaApp>;
}
