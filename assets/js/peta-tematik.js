// Peta tematik: layer GeoJSON hasil analisis spasial (data/geo/), dimuat saat layer dicentang.
(async function () {
  const { bacaJSON, esc, ROOT } = Studio;
  const KELAS = {
    "Permukiman & lahan terbangun": "#e64c3c", "Sawah & tanaman semusim": "#ffeb5a", "Kebun campuran & pepohonan": "#227832",
    "Rumput & semak": "#96d26e", "Lahan terbuka": "#cdaa7d", "Badan air": "#3c78dc",
  };
  const KELOMPOK = {
    "Zona perumahan": "#e64c3c", "Zona perdagangan & jasa": "#b03a8c", "Zona pariwisata": "#f39c12",
    "Zona cagar budaya": "#8e5a2b", "Zona tanaman pangan": "#d4b000", "Tanpa zona RDTR": "#999999",
  };
  const isi = (warna, op = 0.75) => ({ color: warna, weight: 0, fillColor: warna, fillOpacity: op });
  const ha = (v) => (v == null ? "" : `${Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 })} ha`);

  // urutan = urutan gambar (yang di atas digambar terakhir)
  const LAYER = [
    { id: "rtrw", nama: "RTRW: rencana pola ruang", file: "rtrw_ampenan", kunci: "Kelas_III", warna: (p) => p.warna, op: 0.6, garis: true,
      atribut: (p) => [["Kawasan", p.Kelas_III], ["Kelas", p.Kelas_I], ["Kelurahan", p.kelurahan], ["Luas", ha(p.luas_ha)]] },
    { id: "rdtr", nama: "RDTR: pola ruang (zona)", file: "rdtr_ampenan", kunci: "zona", warna: (p) => p.warna, op: 0.65, garis: true,
      atribut: (p) => [["Zona", p.zona], ["Kode", p.kode_szn], ["LP2B", p.lp2b === "K02B" ? "Ya (K02B)" : "Tidak"], ["Kelurahan", p.kelurahan], ["Luas", ha(p.luas_ha)]] },
    { id: "tl2020", nama: "Tutupan lahan 2020", file: "tutupan_lahan_2020", kunci: "kelas", warna: (p) => KELAS[p.kelas],
      atribut: (p) => [["Kelas", p.kelas], ["Kelurahan", p.kelurahan], ["Luas di kelurahan", ha(p.luas_ha)]] },
    { id: "tl2025", nama: "Tutupan lahan 2025", file: "tutupan_lahan_2025", kunci: "kelas", warna: (p) => KELAS[p.kelas], awal: true,
      atribut: (p) => [["Kelas", p.kelas], ["Kelurahan", p.kelurahan], ["Luas di kelurahan", ha(p.luas_ha)]] },
    { id: "permukiman", nama: "Lahan permukiman 2025", file: "lahan_permukiman_2025", kunci: "kelompok", warna: (p) => KELOMPOK[p.kelompok],
      atribut: (p) => [["Letak", p.kelompok], ["Kelurahan", p.kelurahan], ["Luas", ha(p.luas_ha)]] },
    { id: "perubahan", nama: "Perubahan lahan 2020–2025", file: "perubahan_lahan_2020_2025", kunci: "menjadi", label: (v) => `Menjadi ${v.toLowerCase()}`, warna: (p) => KELAS[p.menjadi], op: 0.85, garis: true,
      atribut: (p) => [["Perubahan", `${p.dari} → ${p.menjadi}`], ["Kelurahan", p.kelurahan], ["Luas", ha(p.luas_ha)]] },
    { id: "alihsawah", nama: "Alih fungsi sawah 2020–2025", file: "alih_fungsi_sawah_2020_2025", kunci: "menjadi", label: (v) => `Sawah → ${v.toLowerCase()}`, warna: (p) => KELAS[p.menjadi], op: 0.9, garis: "#780000",
      atribut: (p) => [["Perubahan", `${p.dari} → ${p.menjadi}`], ["Kelurahan", p.kelurahan], ["Luas", ha(p.luas_ha)]] },
    { id: "titik", nama: "Titik cek lapangan (50)", file: "titik_cek_lapangan", kunci: "kelas_2025", label: (v) => `Kelas 2025: ${v.toLowerCase()}`, warna: (p) => KELAS[p.kelas_2025], titik: true,
      atribut: (p) => [["Titik", p.id], ["Kelas 2020", p.kelas_2020], ["Kelas 2025", p.kelas_2025], ["Kelurahan", p.kelurahan], ["Hasil cek", p.hasil_cek || "belum dicek"], ["Koordinat", `${(+p.lat).toFixed(6)}, ${(+p.lon).toFixed(6)}`]] },
  ];

  const peta = L.map("peta");
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  const citra = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Citra © Esri" });
  osm.addTo(peta);
  LAYER.forEach((l, i) => { peta.createPane(`p-${l.id}`).style.zIndex = 410 + i; });
  peta.createPane("p-batas").style.zIndex = 430;

  const batas = await bacaJSON("data/geo/batas_ampenan.geojson");
  const lapisBatas = L.geoJSON(batas, {
    pane: "p-batas",
    style: { color: "#1f2d2a", weight: 1.6, fill: false, dashArray: "5 3" },
    onEachFeature: (f, l) => l.bindTooltip((f.properties.NAMOBJ || "").replace("Pajarakan", "Pejarakan"), { sticky: true }),
  }).addTo(peta);
  peta.fitBounds(lapisBatas.getBounds(), { padding: [10, 10] });
  L.control.layers({ "OpenStreetMap": osm, "Citra satelit": citra }, { "Batas kelurahan": lapisBatas }, { collapsed: true }).addTo(peta);
  L.control.scale({ imperial: false }).addTo(peta);

  function popup(l, p) {
    return `<div class="popup-foto"><h3>${esc(l.nama)}</h3><dl>${l.atribut(p).filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>`;
  }

  async function muat(l) {
    if (l.lapis) return l.lapis;
    const gj = await bacaJSON(`data/geo/${l.file}.geojson`);
    l.data = gj;
    l.lapis = L.geoJSON(gj, {
      pane: `p-${l.id}`,
      style: (f) => ({ ...isi(l.warna(f.properties) || "#cccccc", l.op ?? 0.75), ...(l.garis ? { weight: 0.6, color: l.garis === true ? "#555" : l.garis } : {}) }),
      pointToLayer: (f, ll) => L.circleMarker(ll, { pane: `p-${l.id}`, radius: 6, weight: 2, color: "#fff", fillColor: l.warna(f.properties) || "#999", fillOpacity: 1 }),
      onEachFeature: (f, ly) => ly.bindPopup(popup(l, f.properties), { maxWidth: 280 }),
    });
    return l.lapis;
  }

  function renderLegenda() {
    const aktif = LAYER.filter((l) => l.tampil && l.data).reverse();
    document.getElementById("legenda-tematik").innerHTML = aktif.length ? aktif.map((l) => {
      const nilai = [...new Map(l.data.features.map((f) => [f.properties[l.kunci], l.warna(f.properties)])).entries()]
        .filter(([v]) => v).sort((a, b) => String(a[0]).localeCompare(String(b[0]), "id"));
      return `<div><b class="small">${esc(l.nama)}</b>${nilai.map(([v, w]) =>
        `<div class="legend-item"><span style="width:14px;height:14px;flex:none;border-radius:${l.titik ? "50%" : "3px"};background:${w};border:1px solid rgba(0,0,0,.25)"></span>${esc(l.label ? l.label(v) : v)}</div>`).join("")}</div>`;
    }).join("") : `<p class="small muted">Centang layer untuk melihat legendanya.</p>`;
  }

  document.getElementById("daftar-layer").innerHTML = [...LAYER].reverse().map((l) => `
    <label class="legend-item"><input type="checkbox" data-id="${l.id}" ${l.awal ? "checked" : ""}> ${esc(l.nama)}
      <a class="small" style="margin-left:auto" href="${ROOT}/data/geo/${l.file}.geojson" download title="Unduh GeoJSON">unduh</a></label>`).join("");

  async function atur(l, on) {
    l.tampil = on;
    if (on) { (await muat(l)).addTo(peta); } else if (l.lapis) peta.removeLayer(l.lapis);
    renderLegenda();
  }
  document.querySelectorAll("#daftar-layer input").forEach((cb) => cb.addEventListener("change", () => {
    const l = LAYER.find((x) => x.id === cb.dataset.id);
    atur(l, cb.checked).catch((e) => { cb.checked = false; alert(`Gagal memuat ${l.nama}: ${e.message}`); });
  }));
  for (const l of LAYER.filter((x) => x.awal)) await atur(l, true);
  renderLegenda();
})();
