// Peta survei: gabungkan data teknis foto (repo) dengan keterangan (Google Sheets).
(async function () {
  const { bacaTab, bacaCSV, bacaJSON, config, esc, opsi, ROOT } = Studio;
  const TANPA_KATEGORI = "Belum dikategorikan";

  const [cfg, teknis, keterangan, batas] = await Promise.all([
    config(),
    bacaCSV(`${ROOT}/data/survei/survei_foto.csv`),
    bacaTab("survei_foto").catch(() => []),
    bacaJSON("data/geo/batas_ampenan.geojson"),
  ]);

  const warna = Object.fromEntries(cfg.kategori_survei.map((k) => [k.nama, k.warna]));
  warna[TANPA_KATEGORI] = "#b0b7b3";
  const ket = Object.fromEntries(keterangan.map((k) => [k.nama_file, k]));

  const foto = teknis.map((t) => {
    const k = ket[t.nama_file] || {};
    return {
      ...t, ...Object.fromEntries(Object.entries(k).filter(([, v]) => v !== "")),
      kategori: k.kategori || TANPA_KATEGORI,
      lat: parseFloat(t.lat), lon: parseFloat(t.lon),
      tgl: (t.waktu || "").slice(0, 10),
    };
  });

  // Peta dasar
  const peta = L.map("peta", { zoomControl: true });
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap",
  });
  const citra = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Citra © Esri",
  });
  osm.addTo(peta);

  const lapisBatas = L.geoJSON(batas, {
    style: { color: "#1f6f5c", weight: 2, fillColor: "#1f6f5c", fillOpacity: 0.04, dashArray: "4 3" },
    onEachFeature: (f, l) => {
      const nama = (f.properties.NAMOBJ || "").replace("Pajarakan", "Pejarakan");
      l.bindTooltip(nama, { sticky: true });
    },
  }).addTo(peta);
  peta.fitBounds(lapisBatas.getBounds(), { padding: [10, 10] });

  const cluster = L.markerClusterGroup({ maxClusterRadius: 35, showCoverageOnHover: false });
  peta.addLayer(cluster);
  L.control.layers(
    { "OpenStreetMap": osm, "Citra satelit": citra },
    { "Batas kelurahan": lapisBatas, "Titik foto": cluster },
    { collapsed: true }
  ).addTo(peta);
  L.control.scale({ imperial: false }).addTo(peta);

  // Filter
  const fKat = document.getElementById("f-kategori");
  const fKel = document.getElementById("f-kelurahan");
  const fTgl = document.getElementById("f-tanggal");
  const fApp = document.getElementById("f-aplikasi");
  const fCari = document.getElementById("f-cari");
  opsi(fKat, foto.map((f) => f.kategori), "Semua kategori");
  opsi(fKel, foto.map((f) => f.kelurahan), "Semua kelurahan");
  opsi(fTgl, foto.map((f) => f.tgl), "Semua tanggal");
  opsi(fApp, foto.map((f) => f.aplikasi), "Semua aplikasi");
  const kategoriAktif = new Set(Object.keys(warna));

  let tampil = [];
  const markerByFile = {};

  function ikon(f) {
    return L.divIcon({
      className: "",
      html: `<span class="dot" style="background:${warna[f.kategori] || warna.Lainnya};width:14px;height:14px"></span>`,
      iconSize: [14, 14],
    });
  }

  function popup(f) {
    const judul = f.judul || f.nama_file;
    const baris = [
      ["Kategori", f.kategori], ["Kelurahan", f.kelurahan], ["Waktu", f.waktu],
      ["Surveyor", f.surveyor], ["Kondisi", f.kondisi], ["Aplikasi", f.aplikasi],
      ["Koordinat", `${f.lat.toFixed(6)}, ${f.lon.toFixed(6)}`],
    ].filter(([, v]) => v);
    const catatan = f.catatan_cek ? `<p class="small" style="color:#a86a00;margin:.3rem 0 0">⚠ ${esc(f.catatan_cek)}</p>` : "";
    return `<div class="popup-foto">
      <img src="${ROOT}/survei/thumb/${encodeURIComponent(f.nama_file)}" data-file="${esc(f.nama_file)}" alt="${esc(judul)}" loading="lazy">
      <h3>${esc(judul)}</h3>
      ${f.keterangan_temuan ? `<p class="small" style="margin:0 0 .3rem">${esc(f.keterangan_temuan)}</p>` : ""}
      <dl>${baris.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>${catatan}</div>`;
  }

  function terapkan() {
    const q = fCari.value.trim().toLowerCase();
    tampil = foto.filter((f) =>
      !isNaN(f.lat) &&
      kategoriAktif.has(f.kategori) &&
      (!fKat.value || f.kategori === fKat.value) &&
      (!fKel.value || f.kelurahan === fKel.value) &&
      (!fTgl.value || f.tgl === fTgl.value) &&
      (!fApp.value || f.aplikasi === fApp.value) &&
      (!q || [f.judul, f.keterangan_temuan, f.nama_file, f.alamat_cap].join(" ").toLowerCase().includes(q))
    );
    cluster.clearLayers();
    for (const f of tampil) {
      const m = L.marker([f.lat, f.lon], { icon: ikon(f), title: f.judul || f.nama_file });
      m.bindPopup(() => popup(f), { maxWidth: 270 });
      markerByFile[f.nama_file] = m;
      cluster.addLayer(m);
    }
    document.getElementById("jumlah").textContent = `${tampil.length} dari ${foto.length} foto`;
    renderGaleri();
    renderRekap();
  }

  function renderLegenda() {
    const hitung = {};
    foto.forEach((f) => (hitung[f.kategori] = (hitung[f.kategori] || 0) + 1));
    const urutan = [...cfg.kategori_survei.map((k) => k.nama), TANPA_KATEGORI];
    document.getElementById("legenda").innerHTML = urutan.map((n) => `
      <label class="legend-item"><input type="checkbox" data-kat="${esc(n)}" ${kategoriAktif.has(n) ? "checked" : ""}>
      <span class="dot" style="background:${warna[n]}"></span>${esc(n)}
      <span class="muted small" style="margin-left:auto">${hitung[n] || 0}</span></label>`).join("");
    document.querySelectorAll("#legenda input").forEach((cb) => cb.addEventListener("change", () => {
      cb.checked ? kategoriAktif.add(cb.dataset.kat) : kategoriAktif.delete(cb.dataset.kat);
      terapkan();
    }));
  }

  function renderRekap() {
    const hitung = {};
    tampil.forEach((f) => (hitung[f.kelurahan] = (hitung[f.kelurahan] || 0) + 1));
    const semua = batas.features.map((f) => (f.properties.NAMOBJ || "").replace("Pajarakan", "Pejarakan"));
    Object.keys(hitung).forEach((k) => { if (!semua.includes(k)) semua.push(k); });
    const maks = Math.max(1, ...Object.values(hitung));
    document.getElementById("rekap").innerHTML = semua
      .sort((a, b) => (hitung[b] || 0) - (hitung[a] || 0))
      .map((k) => Studio.barRow(`${k} (${hitung[k] || 0})`, hitung[k] || 0, maks)).join("")
      .replace(/<span class="pct">\d+%<\/span>/g, "<span></span>");
  }

  function renderGaleri() {
    document.getElementById("galeri").innerHTML = tampil.map((f, i) => `
      <button data-i="${i}" title="${esc(f.judul || f.nama_file)}">
        <img src="${ROOT}/survei/thumb/${encodeURIComponent(f.nama_file)}" alt="" loading="lazy"></button>`).join("");
  }

  document.getElementById("galeri").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const f = tampil[+b.dataset.i];
    document.querySelectorAll(".galeri button.pilih").forEach((x) => x.classList.remove("pilih"));
    b.classList.add("pilih");
    const m = markerByFile[f.nama_file];
    cluster.zoomToShowLayer(m, () => m.openPopup());
  });

  // Lightbox
  const lb = document.getElementById("lightbox");
  let lbIndex = 0;
  function bukaLightbox(file) {
    lbIndex = Math.max(0, tampil.findIndex((f) => f.nama_file === file));
    tampilLightbox();
    lb.classList.add("buka");
  }
  function tampilLightbox() {
    const f = tampil[lbIndex];
    document.getElementById("lb-img").src = `${ROOT}/survei/foto/${encodeURIComponent(f.nama_file)}`;
    document.getElementById("lb-cap").textContent =
      `${f.judul || f.nama_file} · ${f.kelurahan} · ${f.waktu}  (${lbIndex + 1}/${tampil.length})`;
  }
  peta.on("popupopen", (e) => {
    const img = e.popup.getElement().querySelector("img[data-file]");
    if (!img) return;
    img.addEventListener("click", () => bukaLightbox(img.dataset.file));
    // Ukuran popup baru diketahui setelah foto termuat; geser peta agar popup tidak terpotong.
    if (!img.complete) img.addEventListener("load", () => e.popup.update(), { once: true });
  });
  document.getElementById("lb-tutup").onclick = () => lb.classList.remove("buka");
  document.getElementById("lb-prev").onclick = () => { lbIndex = (lbIndex - 1 + tampil.length) % tampil.length; tampilLightbox(); };
  document.getElementById("lb-next").onclick = () => { lbIndex = (lbIndex + 1) % tampil.length; tampilLightbox(); };
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("buka")) return;
    if (e.key === "Escape") lb.classList.remove("buka");
    if (e.key === "ArrowLeft") document.getElementById("lb-prev").click();
    if (e.key === "ArrowRight") document.getElementById("lb-next").click();
  });

  // Peringatan data
  const perlu = foto.filter((f) => f.catatan_cek || isNaN(f.lat));
  const tanpaKet = foto.filter((f) => f.kategori === TANPA_KATEGORI).length;
  document.getElementById("peringatan").innerHTML =
    (tanpaKet ? `<div class="notice info">${tanpaKet} foto belum diberi kategori dan keterangan. Isi di tab <b>survei_foto</b> Google Sheets.</div>` : "") +
    (perlu.length ? `<div class="notice"><b>${perlu.length} foto perlu dicek:</b><br>${perlu.map((f) => `${esc(f.nama_file)}: ${esc(f.catatan_cek || "tanpa koordinat")}`).join("<br>")}</div>` : "");

  // Unduh GeoJSON
  const gj = {
    type: "FeatureCollection",
    features: foto.filter((f) => !isNaN(f.lat)).map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      properties: Object.fromEntries(Object.entries(f).filter(([k]) => !["lat", "lon", "tgl"].includes(k))),
    })),
  };
  document.getElementById("unduh").href = URL.createObjectURL(new Blob([JSON.stringify(gj)], { type: "application/geo+json" }));

  [fKat, fKel, fTgl, fApp].forEach((el) => el.addEventListener("change", terapkan));
  fCari.addEventListener("input", terapkan);
  renderLegenda();
  terapkan();
})();
