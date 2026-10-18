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
      <nav class="nav">${nav}</nav><div id="tombol-akun" class="tombol-akun"></div></div>`;
    document.body.prepend(header);
    perbaruiTombolAkun();
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

  // Setiap baris membawa _baris (nomor baris di spreadsheet) dan _asli (isi saat dimuat)
  // sebagai properti tersembunyi, dipakai saat menyimpan perubahan dari dashboard.
  function uraiCSV(teks) {
    const r = Papa.parse(teks.replace(/^\ufeff/, ""), { header: true, skipEmptyLines: false, transformHeader: (h) => h.trim() });
    const fields = (r.meta.fields || []).map((f) => f.trim());
    const data = [];
    r.data.forEach((row, i) => {
      if (!fields.some((f) => String(row[f] ?? "").trim() !== "")) return;
      fields.forEach((f) => { if (row[f] == null) row[f] = ""; });
      Object.defineProperty(row, "_baris", { value: i + 2, writable: true });
      Object.defineProperty(row, "_asli", { value: Object.fromEntries(fields.map((f) => [f, row[f]])), writable: true });
      data.push(row);
    });
    data.fields = fields;
    return data;
  }

  // ---- Mengisi dari dashboard: akun anggota dan pengiriman ke Apps Script ----
  const KUNCI_AKUN = "studio-akun";
  function akun() {
    try { return JSON.parse(localStorage.getItem(KUNCI_AKUN)) || null; } catch (e) { return null; }
  }
  function keluar() {
    try { localStorage.removeItem(KUNCI_AKUN); } catch (e) { /* abaikan */ }
    perbaruiTombolAkun();
  }

  async function kirim(muatan) {
    const cfg = await config();
    if (!cfg.apps_script_url) throw new Error("Admin belum memasang alamat penerima data (apps_script_url di config.json).");
    const res = await fetch(cfg.apps_script_url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // tanpa preflight CORS
      body: JSON.stringify(muatan),
    });
    if (!res.ok) throw new Error(`Penerima data menjawab ${res.status}`);
    return res.json();
  }

  // Minta nama pengisi (sekali, lalu diingat di browser ini).
  function masuk() {
    return new Promise((resolve) => {
      const ada = akun();
      const dlg = document.createElement("div");
      dlg.className = "modal-latar";
      dlg.innerHTML = `<form class="modal">
        <h2>Siapa yang mengisi?</h2>
        <p class="small muted">Isian dari dashboard langsung tersimpan ke spreadsheet tim dan dicatat atas nama ini untuk dicek admin. Nama diingat di browser ini.</p>
        <label>Nama<input name="nama" list="daftar-anggota" required value="${esc(ada?.nama || "")}" autocomplete="name"></label>
        <datalist id="daftar-anggota"></datalist>
        <p class="small" data-pesan></p>
        <div class="modal-aksi"><button type="button" class="btn-kecil" data-batal>Batal</button><button class="btn-utama">Lanjut</button></div>
      </form>`;
      document.body.append(dlg);
      config().then((cfg) => {
        dlg.querySelector("#daftar-anggota").innerHTML = (cfg.anggota_tim || []).map((n) => `<option value="${esc(n)}">`).join("");
      });
      const form = dlg.querySelector("form");
      const pesan = dlg.querySelector("[data-pesan]");
      form.nama.focus();
      dlg.querySelector("[data-batal]").onclick = () => { dlg.remove(); resolve(null); };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const calon = { nama: form.nama.value.trim() };
        pesan.textContent = "Memeriksa sambungan ke spreadsheet…";
        try {
          const j = await kirim({ aksi: "cek", ...calon });
          if (!j.ok) { pesan.textContent = j.pesan; return; }
          try { localStorage.setItem(KUNCI_AKUN, JSON.stringify(calon)); } catch (err) { /* tetap lanjut */ }
          dlg.remove();
          perbaruiTombolAkun();
          resolve(calon);
        } catch (err) {
          pesan.textContent = err.message;
        }
      };
    });
  }

  // Simpan perubahan satu tab. perubahan: [{baris, asli, baru}], tambah: [{kolom: nilai}]
  async function simpan(tab, perubahan, tambah = []) {
    const a = akun() || (await masuk());
    if (!a) return null;
    return kirim({ aksi: "simpan", nama: a.nama, tab, perubahan, tambah });
  }

  // Bandingkan baris dengan isi saat dimuat: kembalikan {baris, asli, baru} atau null.
  function selisih(row, fields) {
    if (!row._asli) return null;
    const baru = {};
    fields.forEach((f) => { if (String(row[f] ?? "").trim() !== String(row._asli[f] ?? "").trim()) baru[f] = row[f]; });
    return Object.keys(baru).length ? { baris: row._baris, asli: row._asli, baru } : null;
  }

  function ringkasHasil(j) {
    if (!j) return "Dibatalkan.";
    if (!j.ok) return `Gagal: ${j.pesan}`;
    const b = [];
    if (j.diubah) b.push(`${j.diubah} sel diubah`);
    if (j.ditambah) b.push(`${j.ditambah} baris ditambah`);
    if (!b.length) b.push("Tidak ada yang berubah");
    if (j.konflik?.length) b.push(`${j.konflik.length} baris tidak ditemukan karena sudah diubah admin (${j.konflik.join(", ")}); muat ulang halaman lalu isi lagi`);
    if (j.ditolak?.length) b.push(`kolom hanya untuk admin: ${j.ditolak.join(", ")}`);
    return b.join(" · ") + ".";
  }

  // Bar "Simpan ke spreadsheet" untuk halaman progres. baris = array baris tab (diubah langsung oleh halaman),
  // tambahan() = baris baru yang akan ditambahkan. Kembalikan fungsi segarkan() untuk dipanggil setiap ada perubahan.
  function barSimpan(el, { tab, baris, tambahan = () => [] }) {
    el.className = "bar-simpan";
    el.innerHTML = `<span class="pesan">Belum ada perubahan.</span>
      <button class="btn-kecil" data-batal hidden>Batalkan</button>
      <button class="btn-utama" data-simpan disabled>Simpan ke spreadsheet</button>`;
    const pesan = el.querySelector(".pesan"), tombol = el.querySelector("[data-simpan]"), batal = el.querySelector("[data-batal]");
    const kumpulkan = () => ({ perubahan: baris.map((r) => selisih(r, baris.fields || Object.keys(r._asli || {}))).filter(Boolean), tambah: tambahan() });
    function segarkan() {
      const { perubahan, tambah } = kumpulkan();
      const n = perubahan.length + tambah.length;
      tombol.disabled = !n;
      batal.hidden = !n;
      pesan.textContent = n ? `${n} baris berubah, belum disimpan.` : "Belum ada perubahan.";
    }
    batal.onclick = () => location.reload();
    tombol.onclick = async () => {
      const { perubahan, tambah } = kumpulkan();
      tombol.disabled = true;
      pesan.textContent = "Menyimpan…";
      try {
        const j = await simpan(tab, perubahan, tambah);
        pesan.textContent = ringkasHasil(j);
        if (j && j.ok && !j.konflik?.length) { pesan.textContent += " Memuat ulang data terbaru…"; setTimeout(() => location.reload(), 1500); }
        else tombol.disabled = false;
      } catch (e) {
        pesan.textContent = `Gagal: ${e.message}`;
        tombol.disabled = false;
      }
    };
    return segarkan;
  }

  function perbaruiTombolAkun() {
    const el = document.getElementById("tombol-akun");
    if (!el) return;
    const a = akun();
    el.innerHTML = a
      ? `<span class="small muted">Mengisi sebagai <b>${esc(a.nama)}</b></span> <button class="btn-kecil" data-keluar>Ganti</button>`
      : `<button class="btn-kecil" data-masuk>Isi nama pengisi</button>`;
    el.querySelector("[data-keluar]")?.addEventListener("click", keluar);
    el.querySelector("[data-masuk]")?.addEventListener("click", masuk);
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

  window.Studio = { ROOT, config, bacaTab, bacaCSV, bacaJSON, esc, benar, tanggal, formatTanggal, sesiSekarang, persen, barRow, opsi, akun, masuk, keluar, simpan, selisih, ringkasHasil, barSimpan };
  document.addEventListener("DOMContentLoaded", pasangNavigasi);
})();
