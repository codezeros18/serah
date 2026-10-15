import { buatKlienAnthropic, ClaudePembaca } from "./claude-pembaca";
import { ManualPembaca, type PembacaTiket } from "./pembaca";

export * from "./pembaca";
export { ClaudePembaca, PROMPT_SISTEM, SKEMA_TIKET, normalisasi } from "./claude-pembaca";

export type EnvAi = { ANTHROPIC_API_KEY?: string; AI_MODEL: string; AI_MODEL_CADANGAN: string };

/** Tanpa kunci API → ManualPembaca (jalur manual selalu ada). */
export function buatPembaca(env: EnvAi): PembacaTiket {
  if (!env.ANTHROPIC_API_KEY) return new ManualPembaca();
  return new ClaudePembaca({
    klien: buatKlienAnthropic(env.ANTHROPIC_API_KEY),
    model: env.AI_MODEL,
    modelCadangan: env.AI_MODEL_CADANGAN,
  });
}
