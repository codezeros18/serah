import { selAsal, type ModelLembarNeraca, type ModelPdfLaporan } from "@serah/core/pdf";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { TEKS } from "@serah/kontrak";
import { createElement as h, type ReactElement } from "react";

// Renderer PDF (S23). HANYA menggambar model dari packages/core/pdf: tidak ada hitungan, pemformatan angka, atau
// pemilihan data di sini. Server-only (runtime nodejs). Font bawaan (Helvetica) cukup untuk aksara Latin Indonesia.

// Tanpa pemenggalan kata otomatis: kode serah, sidik, dan angka tidak boleh terputus (dan teks PDF tetap bisa dicari).
Font.registerHyphenationCallback((kata) => [kata]);

const gaya = StyleSheet.create({
  halaman: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 24, fontFamily: "Helvetica", fontSize: 7, color: "#111111" },
  judul: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sub: { fontSize: 8, marginBottom: 8, color: "#444444" },
  baris: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#bbbbbb", paddingVertical: 2 },
  kepala: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000000", paddingVertical: 3, backgroundColor: "#eeeeee" },
  total: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000000", paddingVertical: 3, fontFamily: "Helvetica-Bold" },
  sel: { paddingHorizontal: 2 },
  catatan: { marginTop: 10, fontSize: 6.5, color: "#333333" },
  blok: { marginTop: 10 },
  subjudul: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  angka: { fontSize: 8, marginBottom: 4 },
  nomor: { position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 7, color: "#666666" },
});

/** Lebar relatif kolom laporan (jumlah 13 kolom, urutan sama dengan CSV). */
const LEBAR_LAPORAN = [5, 8.5, 7, 5, 5, 5, 7, 12, 8, 5, 9, 7, 17];

const Nomor = () =>
  h(Text, { style: gaya.nomor, fixed: true, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` });

function sel(teks: string, lebar: number, i: number): ReactElement {
  return h(View, { key: i, style: { ...gaya.sel, width: `${lebar}%` } }, h(Text, null, teks));
}

function barisTabel(sels: readonly string[], lebar: readonly number[], gayaBaris: (typeof gaya)["baris" | "total"], kunci: string | number): ReactElement {
  return h(View, { key: kunci, style: gayaBaris, wrap: false }, ...sels.map((s, i) => sel(s, lebar[i] ?? 10, i)));
}

export async function renderLaporanPdf(m: ModelPdfLaporan): Promise<Uint8Array> {
  const dok = h(
    Document,
    { title: `${m.judul} ${m.periode}`, creator: TEKS.APP_NAMA, producer: TEKS.APP_NAMA },
    h(
      Page,
      { size: "A4", orientation: "landscape", style: gaya.halaman },
      h(Text, { style: gaya.judul }, m.judul),
      h(Text, { style: gaya.sub }, m.periode),
      h(View, { style: gaya.kepala, fixed: true }, ...m.kolom.map((k, i) => sel(k, LEBAR_LAPORAN[i] ?? 10, i))),
      ...m.baris.map((b, i) => barisTabel(b, LEBAR_LAPORAN, gaya.baris, `b${i}`)),
      ...m.total.map((t, i) => barisTabel(t, LEBAR_LAPORAN, gaya.total, `t${i}`)),
      h(Text, { style: gaya.catatan }, m.catatan),
      h(Nomor),
    ),
  );
  return new Uint8Array(await renderToBuffer(dok));
}

const LEBAR_ASAL = [17, 11, 12, 12, 12, 18, 18];

export async function renderLembarNeracaPdf(m: ModelLembarNeraca): Promise<Uint8Array> {
  const dok = h(
    Document,
    { title: `${m.judul} ${m.periode}`, creator: TEKS.APP_NAMA, producer: TEKS.APP_NAMA },
    h(
      Page,
      { size: "A4", orientation: "landscape", style: gaya.halaman },
      h(Text, { style: gaya.judul }, m.judul),
      h(Text, { style: gaya.sub }, `${m.kawasanNama} · ${m.periode}`),
      h(Text, { style: gaya.sub }, m.penjelasan),
      ...m.aliran.map((a) =>
        h(
          View,
          { key: a.aliran, style: gaya.blok },
          h(Text, { style: gaya.subjudul }, a.label),
          h(Text, { style: gaya.angka }, `${TEKS.KOL_BERAT_TPS}: ${a.totalTps} · ${TEKS.KOL_BERAT_DITERIMA}: ${a.totalDiterima} · ${TEKS.KOL_BERAT_DITOLAK}: ${a.totalDitolak}`),
          h(View, { style: gaya.kepala, wrap: false }, ...m.kolomAsal.map((k, i) => sel(k, LEBAR_ASAL[i] ?? 10, i))),
          ...a.asal.map((x, i) => barisTabel(selAsal(x), LEBAR_ASAL, gaya.baris, `${a.aliran}${i}`)),
        ),
      ),
      h(Text, { style: gaya.catatan }, m.catatan),
      h(Nomor),
    ),
  );
  return new Uint8Array(await renderToBuffer(dok));
}
