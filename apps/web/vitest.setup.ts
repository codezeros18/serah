import { aturIntegrasi } from "@/lib/server/integrasi";
import { cuacaTanpaJaringan, manualPembaca, pemrosesFotoStub } from "@/lib/server/uji/stub-integrasi";

// Test integrasi berjalan tanpa jaringan dan tanpa AI (T18) dan memakai berkas uji sintetis (PNG/JPEG buatan
// tangan yang tidak dapat didekode sharp). Produksi memakai adaptor nyata; pengujian adaptor nyata ada di
// lib/server/integrasi.test.ts (memakai aturIntegrasi untuk melepas stub).
aturIntegrasi({ foto: pemrosesFotoStub, pembacaTiket: manualPembaca, cuaca: cuacaTanpaJaringan });
