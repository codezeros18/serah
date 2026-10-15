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
  const dimensi = ukuran === "sm" ? 28 : ukuran === "lg" ? 44 : 36;
  const teksUkuran = ukuran === "sm" ? "text-lg" : ukuran === "lg" ? "text-2xl" : "text-xl";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Simbol SERAH: Tiga faset laporan bertemu pada satu titik serah */}
      <svg
        width={dimensi}
        height={dimensi}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-150 group-hover:scale-105"
        aria-hidden="true"
      >
        <rect width="36" height="36" rx="9" fill="#2457c5" />
        <path
          d="M18 7.5L27.5 13V24L18 29.5L8.5 24V13L18 7.5Z"
          stroke="white"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M18 7.5V18.5M27.5 24L18 18.5M8.5 24L18 18.5"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="18" cy="18.5" r="2.5" fill="white" />
      </svg>

      {denganTeks ? (
        <div className="flex flex-col text-left">
          <span className={`${teksUkuran} font-black tracking-tight text-tinta leading-none`}>
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
