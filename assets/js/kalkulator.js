// Mesin bersama untuk halaman kalkulator analisis.
// Setiap halaman memanggil K.halaman({...}): data dibaca dari tab Google Sheets
// (atau salinan lokal data/sheets/<tab>.csv), ditampilkan sebagai tabel yang bisa
// diedit di browser (mode coba, tidak tersimpan), lalu hitung() dipanggil ulang
// setiap kali angka berubah.
(function () {
  const S = Studio;

  const KELURAHAN = [
    "Ampenan Selatan", "Ampenan Tengah", "Ampenan Utara", "Banjar", "Bintaro",
    "Dayan Peken", "Kebun Sari", "Pejarakan Karya", "Pejeruk", "Taman Sari",
  ];

  // Menerima "1.234,5" (format Indonesia), "1234.5", "12%", atau kosong.
  function angka(v) {
    if (v == null) return NaN;
    let t = String(v).trim().replace(/\s|%/g, "");
    if (!t) return NaN;
    if (/,/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  const ada = (v) => Number.isFinite(v);

  function fmt(n, d = 0) {
    if (!ada(n)) return "–";
    return n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  async function tab(nama) {
    try { return await S.bacaTab(nama); } catch (e) { console.warn("Tab tidak terbaca:", nama, e); return []; }
  }

  // Tab parameter: kunci, nilai, satuan, keterangan.
  function petaParam(rows) {
    const p = {};
    rows.forEach((r) => {
      const t = String(r.nilai ?? "").trim();
      const n = /^\d{4}([,;\s]+\d{4})+$/.test(t) ? NaN : angka(t); // daftar tahun tetap teks
      p[r.kunci] = ada(n) ? n : t;
    });
    return p;
  }

  function daftarTahun(s) {
    return String(s).split(/[;,\s]+/).map(Number).filter((n) => n > 1900);
  }

  // Sel berbeda dari isi spreadsheet saat dimuat (baris baru selalu dianggap berubah bila terisi).
  const diubah = (r, k) => (r._asli ? String(r[k] ?? "").trim() !== String(r._asli[k] ?? "").trim() : String(r[k] ?? "").trim() !== "");

  // ---- Tabel input yang bisa diedit ----
  function tabelInput(el, { kolom, baris, kunci = [], teks = [], tambahBaris = false, onUbah }) {
    const render = () => {
      el.innerHTML = `<div class="table-wrap"><table class="tabel-input"><thead><tr>
        ${kolom.map((k) => `<th>${S.esc(k)}</th>`).join("")}${tambahBaris ? "<th></th>" : ""}</tr></thead><tbody>
        ${baris.map((r, i) => `<tr>${kolom.map((k) => {
          const v = S.esc(r[k] ?? "");
          if (kunci.includes(k)) return `<td class="kunci">${v}</td>`;
          const kelas = [teks.includes(k) ? "" : "num", diubah(r, k) ? "ubah" : ""].join(" ").trim();
          return `<td><input data-i="${i}" data-k="${S.esc(k)}" value="${v}" ${teks.includes(k) ? "" : 'inputmode="decimal"'} class="${kelas}"></td>`;
        }).join("")}${tambahBaris ? `<td>${r._baris ? "" : `<button class="btn-kecil" data-hapus="${i}" title="Hapus baris baru">×</button>`}</td>` : ""}</tr>`).join("")}
        </tbody></table></div>
        ${tambahBaris ? '<button class="btn-kecil" data-tambah>+ Tambah baris</button>' : ""}`;
    };
    render();
    el.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.k == null) return;
      const r = baris[+t.dataset.i];
      r[t.dataset.k] = t.value;
      t.classList.toggle("ubah", diubah(r, t.dataset.k));
      onUbah();
    });
    el.addEventListener("click", (e) => {
      const t = e.target;
      if (t.dataset.hapus != null) { baris.splice(+t.dataset.hapus, 1); render(); onUbah(); }
      if (t.dataset.tambah != null) { baris.push(Object.fromEntries(kolom.map((k) => [k, ""]))); render(); onUbah(); }
    });
  }

  // ---- Tabel hasil + unduh CSV ----
  // kolom: array label; baris: array of array (angka mentah atau string);
  // format: array fungsi/angka desimal per kolom; kelas(nilai, i, j) -> class sel.
  function tabelHasil(el, { kolom, baris, desimal = [], kelas, namaFile = "hasil", catatan = "" }) {
    const sel = (v, j) => (typeof v === "number" ? fmt(v, desimal[j] ?? 0) : S.esc(v ?? ""));
    el.innerHTML = `<div class="table-wrap"><table><thead><tr>${kolom.map((k) => `<th>${S.esc(k)}</th>`).join("")}</tr></thead>
      <tbody>${baris.map((r, i) => `<tr>${r.map((v, j) => {
        const c = [typeof v === "number" ? "num" : "", kelas ? kelas(v, i, j) || "" : ""].join(" ").trim();
        return `<td${c ? ` class="${c}"` : ""}>${sel(v, j)}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>
      <div class="aksi-hasil">${catatan ? `<span class="small muted">${catatan}</span>` : "<span></span>"}
      <button class="btn-kecil" data-unduh>Unduh CSV</button></div>`;
    el.querySelector("[data-unduh]").onclick = () => unduhCSV(namaFile, kolom, baris);
  }

  function unduhCSV(nama, kolom, baris) {
    const csv = Papa.unparse({ fields: kolom, data: baris.map((r) => r.map((v) => (typeof v === "number" && ada(v) ? +v.toFixed(6) : v))) });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${nama}.csv`;
    a.click();
  }

  // ---- Grafik (Chart.js) ----
  const grafikAktif = new Map();
  function grafik(canvasId, cfg) {
    if (typeof Chart === "undefined") return;
    const lama = grafikAktif.get(canvasId);
    if (lama) lama.destroy();
    const css = getComputedStyle(document.documentElement);
    Chart.defaults.color = css.getPropertyValue("--text-2").trim();
    Chart.defaults.borderColor = css.getPropertyValue("--border").trim();
    Chart.defaults.font.family = css.getPropertyValue("--font").trim();
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false }, cfg.options || {});
    grafikAktif.set(canvasId, new Chart(document.getElementById(canvasId), cfg));
  }
  const WARNA = ["#1f6f5c", "#d7301f", "#1f78b4", "#e6850e", "#8e44ad", "#33a02c", "#b8860b", "#0b8a8a", "#6a5acd", "#7f8c8d"];

  // Urutkan baris sesuai daftar kelurahan resmi.
  function urutKel(rows, kolom = "kelurahan") {
    const idx = (n) => { const i = KELURAHAN.indexOf(n); return i < 0 ? 99 : i; };
    return [...rows].sort((a, b) => idx(a[kolom]) - idx(b[kolom]));
  }

  // ---- Proyeksi penduduk (dipakai beberapa kalkulator) ----
  // seri: baris {kelurahan, "2019": .., "2020": ..}; p: parameter.
  const METODE = {
    aritmatik: { laju: (P0, Pt, t) => (Pt / P0 - 1) / t, f: (r, n) => 1 + r * n },
    geometrik: { laju: (P0, Pt, t) => Math.pow(Pt / P0, 1 / t) - 1, f: (r, n) => Math.pow(1 + r, n) },
    eksponensial: { laju: (P0, Pt, t) => Math.log(Pt / P0) / t, f: (r, n) => Math.exp(r * n) },
  };

  function proyeksi(seri, p) {
    const kolomTahun = (seri.fields || (seri.length ? Object.keys(seri[0]) : [])).filter((k) => /^\d{4}$/.test(k.trim()));
    const target = daftarTahun(p.tahun_proyeksi || "2026,2031,2036,2041,2046");
    const pilihan = String(p.metode_proyeksi || "otomatis").toLowerCase();
    const lajuKec = String(p.laju_proyeksi || "kelurahan").toLowerCase() === "kecamatan";

    const titik = (r) => kolomTahun.map((k) => [Number(k), angka(r[k])]).filter(([, v]) => ada(v) && v > 0).sort((a, b) => a[0] - b[0]);
    const hitungLaju = (pts) => {
      if (pts.length < 2) return null;
      const [t0, P0] = pts[0], [tn, Pt] = pts[pts.length - 1];
      const out = {};
      for (const [m, M] of Object.entries(METODE)) {
        const r = M.laju(P0, Pt, tn - t0);
        // simpangan baku selisih estimasi terhadap data historis
        const sel = pts.map(([t, v]) => P0 * M.f(r, t - t0) - v);
        const rata = sel.reduce((a, b) => a + b, 0) / sel.length;
        const sd = Math.sqrt(sel.reduce((a, b) => a + (b - rata) ** 2, 0) / sel.length);
        out[m] = { r, sd };
      }
      return out;
    };

    const baris = urutKel(seri).map((r) => ({ kelurahan: r.kelurahan, pts: titik(r) }));
    // Laju kecamatan dari jumlah seluruh kelurahan pada tahun yang lengkap.
    let lajuTotal = null;
    if (lajuKec) {
      const tahunLengkap = kolomTahun.map(Number).filter((t) => baris.every((b) => b.pts.some(([x]) => x === t)));
      const pts = tahunLengkap.map((t) => [t, baris.reduce((a, b) => a + b.pts.find(([x]) => x === t)[1], 0)]);
      lajuTotal = hitungLaju(pts);
    }

    const hasil = baris.map((b) => {
      const laju = lajuKec ? lajuTotal : hitungLaju(b.pts);
      if (!laju || !b.pts.length) return { ...b, laju: null, metode: null, tahunDasar: null, dasar: NaN, nilai: {} };
      const metode = METODE[pilihan] ? pilihan : Object.entries(laju).sort((a, c) => a[1].sd - c[1].sd)[0][0];
      const [tahunDasar, dasar] = b.pts[b.pts.length - 1];
      const nilai = {};
      target.forEach((t) => { nilai[t] = t >= tahunDasar ? dasar * METODE[metode].f(laju[metode].r, t - tahunDasar) : NaN; });
      return { ...b, laju, metode, tahunDasar, dasar, nilai };
    });
    return { kolomTahun, target, hasil, lajuKec };
  }

  // ---- Kerangka halaman ----
  // cfg.tabs: [{nama, judul, kunci:[kolom readonly], teks:[kolom teks], tambahBaris}]
  // cfg.param: daftar kunci parameter yang ditampilkan; cfg.hitung(ctx)
  // Tab yang hanya bisa diubah admin langsung di spreadsheet.
  const TAB_ADMIN = ["parameter", "standar_sarana"];

  async function halaman(cfg) {
    const tabs = cfg.tabs || [];
    const [paramRows, ...dataTabs] = await Promise.all([tab("parameter"), ...tabs.map((t) => tab(t.nama))]);
    const asli = { parameter: JSON.stringify(paramRows) };
    const data = {};
    tabs.forEach((t, i) => { data[t.nama] = dataTabs[i]; asli[t.nama] = JSON.stringify(dataTabs[i]); });
    const paramTampil = paramRows.filter((r) => (cfg.param || []).includes(r.kunci));

    const wadah = document.getElementById("kalkulator");
    wadah.innerHTML = `
      <div class="notice small" id="k-mode">Isi atau ubah angka langsung di tabel input, lalu tekan <b>Simpan ke spreadsheet</b>. Sel yang berubah ditandai kuning dan hasil di bawah langsung ikut berubah. Perubahan dicatat atas nama Anda dan dicek admin. Tab bertanda <i>hanya admin</i> bisa dipakai untuk mencoba, tetapi tidak tersimpan.</div>
      <div id="k-status"></div>
      ${tabs.map((t, i) => `<details class="card blok" ${i === 0 && !t.tertutup && dataTabs[i].length <= 30 ? "open" : ""}><summary><b>Input: ${S.esc(t.judul)}</b> <span class="small muted">tab <code>${t.nama}</code>${TAB_ADMIN.includes(t.nama) ? " · hanya admin" : ""}</span></summary><div id="k-in-${i}"></div></details>`).join("")}
      ${paramTampil.length ? `<details class="card blok"><summary><b>Parameter dan standar</b> <span class="small muted">tab <code>parameter</code> · hanya admin</span></summary><div id="k-param"></div></details>` : ""}
      <div class="bar-simpan" id="k-simpan"><span class="pesan" id="k-pesan">Belum ada perubahan.</span>
        <button class="btn-kecil" id="k-reset" hidden>Batalkan perubahan</button>
        <button class="btn-utama" id="k-tombol" disabled>Simpan ke spreadsheet</button></div>
      <div id="k-hasil"></div>`;

    let berubah = false;
    const simpanan = tabs.filter((t) => !TAB_ADMIN.includes(t.nama));
    const kolomTab = (t) => (data[t.nama].fields?.length ? data[t.nama].fields : (t.kolom || []));
    const kumpulkan = () => simpanan.map((t) => {
      const f = kolomTab(t);
      const perubahan = data[t.nama].map((r) => S.selisih(r, f)).filter(Boolean);
      const tambah = data[t.nama].filter((r) => !r._baris && f.some((k) => String(r[k] ?? "").trim() !== ""))
        .map((r) => Object.fromEntries(f.map((k) => [k, r[k] ?? ""])));
      return { t, perubahan, tambah, n: perubahan.length + tambah.length };
    }).filter((x) => x.n);
    const pesan = document.getElementById("k-pesan"), tombol = document.getElementById("k-tombol");
    const segarkanBar = () => {
      const k = kumpulkan();
      const n = k.reduce((a, x) => a + x.n, 0);
      tombol.disabled = !n;
      pesan.textContent = n ? `${n} baris berubah, belum disimpan.` : (berubah ? "Perubahan hanya di tab admin (tidak disimpan)." : "Belum ada perubahan.");
    };
    const ubah = () => { berubah = true; document.getElementById("k-reset").hidden = false; segarkanBar(); jalankan(); };
    tombol.onclick = async () => {
      tombol.disabled = true;
      pesan.textContent = "Menyimpan…";
      const laporan = [];
      let gagal = false;
      for (const x of kumpulkan()) {
        try {
          const j = await S.simpan(x.t.nama, x.perubahan, x.tambah);
          if (!j) { pesan.textContent = "Dibatalkan."; tombol.disabled = false; return; }
          if (!j.ok || j.konflik?.length) gagal = true;
          laporan.push(`${x.t.judul}: ${S.ringkasHasil(j)}`);
        } catch (e) {
          gagal = true;
          laporan.push(`${x.t.judul}: gagal (${e.message})`);
        }
      }
      pesan.textContent = laporan.join(" ") + (gagal ? "" : " Memuat ulang data terbaru…");
      if (!gagal) setTimeout(() => location.reload(), 1500);
      else tombol.disabled = false;
    };
    tabs.forEach((t, i) => {
      const kolom = data[t.nama].fields?.length ? data[t.nama].fields : (t.kolom || []);
      tabelInput(document.getElementById(`k-in-${i}`), { kolom, baris: data[t.nama], kunci: t.kunci || [], teks: t.teks || [], tambahBaris: t.tambahBaris, onUbah: ubah });
    });
    if (paramTampil.length) {
      tabelInput(document.getElementById("k-param"), { kolom: ["kunci", "nilai", "satuan", "keterangan"], baris: paramTampil, kunci: ["kunci", "satuan", "keterangan"], teks: ["nilai"], onUbah: ubah });
    }
    document.getElementById("k-reset").onclick = () => location.reload();

    function jalankan() {
      const p = petaParam(paramRows);
      const hasilEl = document.getElementById("k-hasil");
      try {
        cfg.hitung({ data, p, el: hasilEl, berubah });
      } catch (e) {
        console.error(e);
        hasilEl.innerHTML = `<div class="card"><p class="pill bad">Gagal menghitung</p> <span class="small">${S.esc(e.message)}</span></div>`;
      }
    }
    jalankan();
  }

  // Status kelengkapan isian: berapa sel angka yang terisi.
  function statusIsi(rows, kolom) {
    let isi = 0, total = 0;
    rows.forEach((r) => kolom.forEach((k) => { total++; if (ada(angka(r[k]))) isi++; }));
    return { isi, total, persen: S.persen(isi, total) };
  }

  function pesanKosong(teks) {
    return `<div class="card kosong"><p><span class="pill warn">Data belum diisi</span></p><p class="muted">${teks}</p></div>`;
  }

  window.K = { KELURAHAN, angka, ada, fmt, tab, petaParam, daftarTahun, tabelInput, tabelHasil, unduhCSV, grafik, WARNA, urutKel, proyeksi, METODE, halaman, statusIsi, pesanKosong };
})();
