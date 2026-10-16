"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { TEKS } from "@serah/kontrak/teks";

type Opsi = { nilai: string; label: string; nonaktif: boolean };

function teksDari(simpul: ReactNode): string {
  if (simpul === null || simpul === undefined || typeof simpul === "boolean") return "";
  if (typeof simpul === "string" || typeof simpul === "number") return String(simpul);
  if (Array.isArray(simpul)) return simpul.map(teksDari).join("");
  if (isValidElement(simpul)) return teksDari((simpul.props as { children?: ReactNode }).children);
  return "";
}

function kumpulkan(anak: ReactNode, keluar: Opsi[]): void {
  Children.forEach(anak, (c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (c.type === "option") {
      const label = teksDari(p.children);
      keluar.push({ nilai: String(p.value ?? label), label, nonaktif: Boolean(p.disabled) });
    } else if (c.type === Fragment || p.children !== undefined) {
      kumpulkan(p.children, keluar);
    }
  });
}

type Props = {
  id?: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  /** Tambahan kelas untuk pembungkus (mis. lebar). */
  className?: string;
};

/**
 * Pilihan kustom bergaya SERAH, pengganti <select>. API mirip <select>: anak berupa <option>.
 * <select> asli tetap ada (tersembunyi) agar formulir, label, dan tes tetap bekerja;
 * pengguna berinteraksi lewat tombol kombo + daftar pilihan yang bisa dioperasikan keyboard.
 */
export function Pilih({
  id,
  value,
  onChange,
  children,
  required,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
  className = "",
}: Props) {
  const idOtomatis = useId();
  const idSelect = id ?? idOtomatis;
  const idDaftar = `${idSelect}-daftar`;
  const akar = useRef<HTMLDivElement>(null);
  const daftar = useRef<HTMLUListElement>(null);
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [posisi, setPosisi] = useState<CSSProperties | null>(null);

  const opsi = useMemo(() => {
    const k: Opsi[] = [];
    kumpulkan(children, k);
    return k;
  }, [children]);

  const terpilih = opsi.find((o) => o.nilai === value && o.label !== "");
  const teksTombol = terpilih?.label ?? "";
  const teksKosong = placeholder ?? TEKS.UMUM_PILIH;

  const tutup = useCallback(() => setBuka(false), []);

  const pilih = useCallback(
    (nilai: string) => {
      onChange({ target: { value: nilai } });
      setBuka(false);
    },
    [onChange],
  );

  // Daftar memakai posisi fixed: tidak terpotong oleh dialog/kartu yang bisa digulir.
  const hitungPosisi = useCallback(() => {
    const k = akar.current?.getBoundingClientRect();
    if (!k || window.innerWidth < 640) {
      setPosisi(null);
      return;
    }
    const bawah = window.innerHeight - k.bottom - 12;
    const atas = k.top - 12;
    const naik = bawah < 220 && atas > bawah;
    const maks = Math.max(140, Math.min(256, (naik ? atas : bawah) - 8));
    setPosisi({
      position: "fixed",
      left: k.left,
      width: k.width,
      maxHeight: maks,
      zIndex: 100,
      ...(naik ? { bottom: window.innerHeight - k.top + 8 } : { top: k.bottom + 8 }),
    });
  }, []);

  const bukaDaftar = useCallback(() => {
    if (disabled) return;
    hitungPosisi();
    const idx = opsi.findIndex((o) => o.nilai === value && !o.nonaktif && o.label !== "");
    setAktif(idx >= 0 ? idx : Math.max(0, opsi.findIndex((o) => !o.nonaktif && o.label !== "")));
    setBuka(true);
  }, [disabled, hitungPosisi, opsi, value]);

  // Ikuti tombol saat halaman/dialog digulir atau ukuran berubah.
  useEffect(() => {
    if (!buka) return;
    window.addEventListener("scroll", hitungPosisi, true);
    window.addEventListener("resize", hitungPosisi);
    return () => {
      window.removeEventListener("scroll", hitungPosisi, true);
      window.removeEventListener("resize", hitungPosisi);
    };
  }, [buka, hitungPosisi]);

  // Tutup saat klik di luar.
  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (akar.current && !akar.current.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener("pointerdown", luar);
    return () => document.removeEventListener("pointerdown", luar);
  }, [buka]);

  // Jaga opsi aktif terlihat.
  useEffect(() => {
    if (!buka) return;
    daftar.current?.querySelector<HTMLElement>(`[data-indeks="${aktif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aktif, buka]);

  function geser(arah: 1 | -1) {
    if (opsi.length === 0) return;
    let i = aktif;
    for (let n = 0; n < opsi.length; n++) {
      i = (i + arah + opsi.length) % opsi.length;
      if (!opsi[i]?.nonaktif && opsi[i]?.label !== "") break;
    }
    setAktif(i);
  }

  function tanganiKunci(e: KeyboardEvent<HTMLButtonElement>) {
    if (!buka) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        bukaDaftar();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      tutup();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      geser(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      geser(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setAktif(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setAktif(Math.max(0, opsi.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = opsi[aktif];
      if (o && !o.nonaktif) pilih(o.nilai);
    } else if (e.key === "Tab") {
      tutup();
    }
  }

  const tampil = opsi.filter((o) => o.label !== "" || o.nilai !== "");

  return (
    <div ref={akar} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={buka}
        aria-controls={idDaftar}
        aria-label={teksTombol || ariaLabel || teksKosong}
        disabled={disabled}
        onClick={() => (buka ? tutup() : bukaDaftar())}
        onKeyDown={tanganiKunci}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border bg-kertas px-4 text-left text-base text-tinta shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-garis focus:outline-none focus-visible:ring-4 focus-visible:ring-aksi/15 disabled:cursor-not-allowed disabled:opacity-50 ${
          buka ? "border-aksi ring-4 ring-aksi/15" : "border-garis-halus"
        }`}
      >
        <span className={`truncate ${teksTombol ? "" : "text-tinta-redup"}`}>{teksTombol || teksKosong}</span>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-tinta-redup transition-transform duration-200 ${buka ? "rotate-180 text-aksi" : ""}`}
        >
          <path d="m6 9.500 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {buka ? (
        <div aria-hidden="true" onClick={tutup} className="fixed inset-0 z-40 bg-tinta/30 backdrop-blur-sm sm:hidden" />
      ) : null}

      {buka ? (
        <ul
          ref={daftar}
          id={idDaftar}
          role="listbox"
          style={posisi ?? undefined}
          className="dropdown-masuk gulir-halus z-50 overflow-auto border border-garis-halus bg-white p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.18)] max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:max-h-[60dvh] max-sm:rounded-3xl max-sm:p-2 sm:rounded-2xl"
        >
          {tampil.map((o) => {
            const indeks = opsi.indexOf(o);
            const dipilih = o.nilai === value;
            return (
              <li
                key={`${o.nilai}-${indeks}`}
                role="option"
                aria-selected={dipilih}
                aria-disabled={o.nonaktif || undefined}
                data-indeks={indeks}
                onPointerEnter={() => !o.nonaktif && setAktif(indeks)}
                onClick={() => !o.nonaktif && pilih(o.nilai)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-sm transition-colors ${
                  o.nonaktif
                    ? "cursor-not-allowed text-garis"
                    : indeks === aktif
                      ? "bg-aksi-latar text-aksi"
                      : "text-tinta"
                } ${dipilih ? "font-semibold" : "font-medium"}`}
              >
                <span className="truncate">{o.label}</span>
                {dipilih ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" className="shrink-0 text-aksi">
                    <path d="m5 12.500 4.500 4.500L19 7" stroke="currentColor" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* <select> asli: dipertahankan untuk formulir, label (htmlFor), dan pengujian */}
      <select
        id={idSelect}
        value={value}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e)}
        className="sr-only"
      >
        {children}
      </select>
    </div>
  );
}
