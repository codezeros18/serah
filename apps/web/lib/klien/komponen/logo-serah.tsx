import { TEKS } from "@serah/kontrak/teks";

interface LogoSerahProps {
  ukuran?: "sm" | "md" | "lg";
  denganTeks?: boolean;
  denganTagline?: boolean;
  className?: string;
}

export function LogoSerah({
  ukuran = "md",
  denganTeks = true,
  denganTagline = false,
  className = "",
}: LogoSerahProps) {
  const dimensi = ukuran === "sm" ? 30 : ukuran === "lg" ? 48 : 38;
  const teksUkuran = ukuran === "sm" ? "text-lg" : ukuran === "lg" ? "text-2xl" : "text-xl";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Logo SERAH: tiga figur saling merangkul (aset /ikon/logo.png dari SERAH1.png) */}
      <img
        src="/ikon/logo.png"
        alt=""
        aria-hidden="true"
        width={dimensi}
        height={Math.round(dimensi * 0.97)}
        decoding="async"
        className="shrink-0 transition-transform duration-150 group-hover:scale-105"
      />

      {denganTeks ? (
        <div className="flex flex-col text-left">
          <span className={`${teksUkuran} font-semibold tracking-tight text-tinta leading-none`}>
            {TEKS.APP_NAMA}
          </span>
          {denganTagline ? (
            <span className="text-[11px] font-medium text-tinta-redup leading-tight mt-1">
              {TEKS.APP_TAGLINE}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
