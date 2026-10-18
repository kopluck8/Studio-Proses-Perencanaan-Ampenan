// Perhitungan AHP bersama untuk kalkulator AHP dan generator WLC.
// Input: baris tab ahp_responden (responden, instansi, level, induk, kriteria_a, kriteria_b, nilai).
// nilai = seberapa penting kriteria_a dibanding kriteria_b (skala Saaty 1/9 … 9).
(function () {
  // Random Index Saaty (n = 1 … 10)
  const RI = { 1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };

  // Menerima "3", "1/3", "0,333", "0.2".
  function pecahan(v) {
    const t = String(v ?? "").trim().replace(/\s/g, "");
    if (!t) return NaN;
    const m = t.match(/^(\d+(?:[.,]\d+)?)\/(\d+(?:[.,]\d+)?)$/);
    if (m) return Number(m[1].replace(",", ".")) / Number(m[2].replace(",", "."));
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  // Bobot dengan pendekatan eigenvector: normalisasi kolom lalu rata-rata baris.
  function bobot(M) {
    const n = M.length;
    const jumlahKolom = M[0].map((_, j) => M.reduce((a, r) => a + r[j], 0));
    const w = M.map((r) => r.reduce((a, v, j) => a + v / jumlahKolom[j], 0) / n);
    const Aw = M.map((r) => r.reduce((a, v, j) => a + v * w[j], 0));
    const lambda = n > 0 ? Aw.reduce((a, v, i) => a + v / w[i], 0) / n : NaN;
    const CI = n > 2 ? (lambda - n) / (n - 1) : 0;
    const ri = RI[n] ?? 1.49;
    const CR = ri ? CI / ri : 0;
    return { w, lambda, CI, CR, RI: ri, n };
  }

  // Bangun matriks n×n dari pasangan; null bila ada pasangan yang belum diisi.
  function matriks(pasangan, item) {
    const n = item.length;
    const M = item.map((_, i) => item.map((_, j) => (i === j ? 1 : NaN)));
    pasangan.forEach(({ a, b, v }) => {
      const i = item.indexOf(a), j = item.indexOf(b);
      if (i < 0 || j < 0 || i === j || !(v > 0)) return;
      M[i][j] = v;
      M[j][i] = 1 / v;
    });
    const lengkap = M.every((r) => r.every((x) => Number.isFinite(x)));
    return lengkap ? M : null;
  }

  function rataGeometrik(daftarM) {
    const m = daftarM.length, n = daftarM[0].length;
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) =>
      Math.pow(daftarM.reduce((a, M) => a * M[i][j], 1), 1 / m)));
  }

  // Kelompokkan per (level, induk). Hasil: [{level, induk, item, responden:[{nama, instansi, M, hasil}], gabungan}]
  function analisis(rows, { crMaks = 0.1, hanyaKonsisten = false } = {}) {
    const grup = new Map();
    rows.forEach((r) => {
      const a = String(r.kriteria_a ?? "").trim(), b = String(r.kriteria_b ?? "").trim();
      if (!a || !b) return;
      const level = String(r.level ?? "1").trim() || "1";
      const induk = level === "1" ? "" : String(r.induk ?? "").trim();
      const kunci = `${level}|${induk}`;
      if (!grup.has(kunci)) grup.set(kunci, { level, induk, item: [], baris: [] });
      const g = grup.get(kunci);
      [a, b].forEach((x) => { if (!g.item.includes(x)) g.item.push(x); });
      g.baris.push({ resp: String(r.responden ?? "").trim() || "(tanpa nama)", instansi: String(r.instansi ?? "").trim(), a, b, v: pecahan(r.nilai) });
    });

    const hasil = [...grup.values()].map((g) => {
      const namaResp = [...new Set(g.baris.map((x) => x.resp))];
      const responden = namaResp.map((nama) => {
        const bs = g.baris.filter((x) => x.resp === nama);
        const terisi = bs.filter((x) => x.v > 0).length;
        const M = matriks(bs, g.item);
        const h = M ? bobot(M) : null;
        return { nama, instansi: bs.find((x) => x.instansi)?.instansi || "", terisi, perlu: (g.item.length * (g.item.length - 1)) / 2, M, hasil: h, konsisten: h ? h.CR < crMaks : false };
      });
      const dipakai = responden.filter((r) => r.M && (!hanyaKonsisten || r.konsisten));
      const gabungan = dipakai.length ? bobot(rataGeometrik(dipakai.map((r) => r.M))) : null;
      return { ...g, responden, dipakai: dipakai.length, gabungan, konsisten: gabungan ? gabungan.CR < crMaks : false };
    });

    // Bobot global: level 2 dengan induk = kriteria level 1.
    const l1 = hasil.find((g) => g.level === "1");
    const global = [];
    if (l1 && l1.gabungan) {
      l1.item.forEach((k, i) => {
        const w1 = l1.gabungan.w[i];
        const sub = hasil.find((g) => g.level === "2" && g.induk === k);
        if (sub && sub.gabungan) sub.item.forEach((s, j) => global.push({ kriteria: k, sub: s, w1, lokal: sub.gabungan.w[j], global: w1 * sub.gabungan.w[j] }));
        else global.push({ kriteria: k, sub: "", w1, lokal: 1, global: w1 });
      });
    }
    return { grup: hasil, l1, global };
  }

  window.AHP = { RI, pecahan, bobot, matriks, rataGeometrik, analisis };
})();
