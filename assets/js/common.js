// Fungsi bersama untuk semua halaman dashboard.
(function () {
  const ROOT = document.documentElement.dataset.root || ".";

  const NAV = [
    ["index.html", "Beranda"],
    ["jadwal.html", "Jadwal"],
    ["tugas.html", "Tugas"],
    ["kebutuhan-data.html", "Kebutuhan Data"],
    ["peta-survei.html", "Peta Survei"],
    ["analisis/index.html", "Analisis"],
  ];

  function pasangNavigasi() {
    const aktif = document.body.dataset.page;
    const nav = NAV.map(([href, label]) => {
      const kelas = href === aktif ? ' class="aktif"' : "";
      return `<a href="${ROOT}/${href}"${kelas}>${label}</a>`;
    }).join("");
    const header = document.createElement("header");
    header.className = "topbar";
    header.innerHTML = `<div class="topbar-inner">
      <a class="brand" href="${ROOT}/index.html">Studio <span>Ampenan</span></a>
      <nav class="nav">${nav}</nav></div>`;
    document.body.prepend(header);
    const footer = document.createElement("footer");
    footer.innerHTML = "Studio Proses Perencanaan PWKL4205 · Prodi PWK Universitas Terbuka · UPBJJ Mataram · Kecamatan Ampenan, Kota Mataram";
    document.body.append(footer);
  }

  let configCache = null;
  async function config() {
    if (!configCache) {
      const res = await fetch(`${ROOT}/data/config.json`, { cache: "no-store" });
      configCache = await res.json();
    }
    return configCache;
  }

  // Membaca satu tab: dari Google Sheets bila URL CSV-nya diisi di config.json,
  // bila tidak dari salinan lokal data/sheets/<nama>.csv.
  async function bacaTab(nama) {
    const cfg = await config();
    const url = (cfg.google_sheets && cfg.google_sheets[nama]) || `${ROOT}/data/sheets/${nama}.csv`;
    return bacaCSV(url);
  }

  function bacaCSV(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true, header: true, skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (r) => resolve(r.data),
        error: reject,
      });
    });
  }

  async function bacaJSON(path) {
    const res = await fetch(`${ROOT}/${path}`);
    return res.json();
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function benar(v) {
    return ["true", "ya", "1", "✓", "v", "x"].includes(String(v ?? "").trim().toLowerCase());
  }

  function tanggal(s) {
    // Menerima YYYY-MM-DD atau DD/MM/YYYY.
    if (!s) return null;
    const t = String(s).trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  }

  function formatTanggal(d) {
    return d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";
  }

  // Sesi berjalan = sesi terakhir yang tanggalnya sudah lewat atau hari ini.
  function sesiSekarang(jadwal, hariIni = new Date()) {
    let kini = null;
    for (const s of jadwal) {
      const d = tanggal(s.tanggal);
      if (d && d <= hariIni) kini = s;
    }
    return kini;
  }

  function persen(a, b) {
    return b ? Math.round((a / b) * 100) : 0;
  }

  function barRow(label, nilai, total, nilai2) {
    const p = persen(nilai, total);
    const p2 = nilai2 == null ? null : persen(nilai2, total);
    return `<div class="bar-row"><span>${esc(label)}</span>
      <div class="bar">${p2 != null ? `<i class="b2" style="width:${p2}%"></i>` : ""}<i style="width:${p}%"></i></div>
      <span class="pct">${p}%</span></div>`;
  }

  function opsi(select, nilai, label) {
    const daftar = [...new Set(nilai.filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
    select.innerHTML = `<option value="">${label}</option>` + daftar.map((v) => `<option>${esc(v)}</option>`).join("");
  }

  window.Studio = { ROOT, config, bacaTab, bacaCSV, bacaJSON, esc, benar, tanggal, formatTanggal, sesiSekarang, persen, barRow, opsi };
  document.addEventListener("DOMContentLoaded", pasangNavigasi);
})();
