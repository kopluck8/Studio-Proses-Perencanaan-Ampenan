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
    footer.innerHTML = "Studio Proses Perencanaan PWKL4205 · Prodi PWK Universitas Terbuka · UPBJJ Mataram · Kecamatan Ampenan, Kota Mataram<span id=\"sumber-data\"></span>";
    document.body.append(footer);
    const k = Object.keys(sumber)[0];
    if (k) tandaiSumber(k, sumber[k]);
  }

  let configCache = null;
  async function config() {
    if (!configCache) {
      const res = await fetch(`${ROOT}/data/config.json`, { cache: "no-store" });
      configCache = await res.json();
    }
    return configCache;
  }

  // Membaca satu tab. Urutan sumber:
  // 1. URL CSV khusus tab di config.json google_sheets.<nama>;
  // 2. spreadsheet dari google_sheets_id (dibaca lewat gviz, spreadsheet harus bisa dilihat siapa pun yang punya link);
  // 3. salinan lokal data/sheets/<nama>.csv bila Sheets gagal dibaca.
  const sumber = {};
  async function bacaTab(nama) {
    const cfg = await config();
    const lokal = `${ROOT}/data/sheets/${nama}.csv`;
    const khusus = cfg.google_sheets && cfg.google_sheets[nama];
    const id = cfg.google_sheets_id;
    const url = khusus || (id ? `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(nama)}` : "");
    if (url) {
      try {
        const [teks, cadangan] = await Promise.all([ambilTeks(url), ambilTeks(lokal).catch(() => "")]);
        const data = uraiCSV(teks);
        // gviz mengembalikan tab pertama bila nama tab tidak ada, jadi cocokkan kolom pertama dengan salinan lokal.
        const kolomLokal = cadangan ? uraiCSV(cadangan).fields : [];
        if (data.fields.length && (!kolomLokal.length || kolomLokal[0] === data.fields[0])) {
          tandaiSumber(nama, "sheets");
          return data;
        }
        console.warn(`Tab "${nama}" di Google Sheets tidak ditemukan atau kolomnya berbeda; memakai salinan repo.`);
      } catch (e) {
        console.warn(`Tab "${nama}" gagal dibaca dari Google Sheets; memakai salinan repo.`, e);
      }
    }
    tandaiSumber(nama, "lokal");
    return uraiCSV(await ambilTeks(lokal));
  }

  async function ambilTeks(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const teks = await res.text();
    if (/^\s*<(!doctype|html)/i.test(teks)) throw new Error(`Bukan CSV: ${url}`);
    return teks;
  }

  function uraiCSV(teks) {
    const r = Papa.parse(teks.replace(/^\ufeff/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
    r.data.fields = (r.meta.fields || []).map((f) => f.trim());
    return r.data;
  }

  async function bacaCSV(url) {
    return uraiCSV(await ambilTeks(url));
  }

  function tandaiSumber(nama, asal) {
    sumber[nama] = asal;
    const el = document.getElementById("sumber-data");
    if (!el) return;
    const nilai = Object.values(sumber);
    const nSheets = nilai.filter((v) => v === "sheets").length;
    el.textContent = nSheets === nilai.length ? " · Data: Google Sheets (langsung)"
      : nSheets ? ` · Data: Google Sheets (${nSheets} tab), salinan repo (${nilai.length - nSheets} tab)`
      : " · Data: salinan repo (Google Sheets belum terhubung)";
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
