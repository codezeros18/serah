import { guardBatasImpor } from "./a-batas-impor.ts";
import { guardKataTerlarang } from "./b-kata-terlarang.ts";
import { guardLiteralTeks } from "./c-literal-teks.ts";
import { guardFloatDecimal } from "./d-float-decimal.ts";
import { guardKolomIdentitas } from "./e-kolom-identitas.ts";
import { guardGeolokasi } from "./f-geolokasi.ts";
import { guardSdkAi } from "./g-sdk-ai.ts";
import { guardKosakataBayar } from "./h-kosakata-bayar.ts";
import { guardUbahSerah } from "./i-ubah-serah.ts";
import { guardKodePaket } from "./j-kode-paket.ts";
import { guardConsoleLog } from "./k-console-log.ts";
import { guardAmbangAturan } from "./l-ambang-aturan.ts";
import { guardEnvTertrack } from "./m-env-tertrack.ts";
import { guardRuteMutasi } from "./n-rute-mutasi.ts";
import { guardTanpaStubProduksi } from "./o-tanpa-stub-produksi.ts";
import type { Guard } from "./jenis.ts";

export const DAFTAR_GUARD: readonly Guard[] = [
  guardBatasImpor,
  guardKataTerlarang,
  guardLiteralTeks,
  guardFloatDecimal,
  guardKolomIdentitas,
  guardGeolokasi,
  guardSdkAi,
  guardKosakataBayar,
  guardUbahSerah,
  guardKodePaket,
  guardConsoleLog,
  guardAmbangAturan,
  guardEnvTertrack,
  guardRuteMutasi,
  guardTanpaStubProduksi,
];
