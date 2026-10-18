(async function () {
  const { bacaTab, esc, benar, opsi, barRow, persen } = Studio;
  const data = await bacaTab("kebutuhan_data");

  const KELAS_KONDISI = {
    "ada lengkap": "ok", "ada sebagian": "warn", "sudah diminta": "info",
    "belum ada": "neutral", "tidak tersedia": "bad",
  };
  const lengkap = (d) => (d.kondisi || "").toLowerCase() === "ada lengkap";
  const cek = (d) => benar(d.ceklis_deo);
  const antri = (d) => lengkap(d) && !cek(d);

  // Ringkasan
  const total = data.length;
  const nLengkap = data.filter(lengkap).length;
  const nSebagian = data.filter((d) => (d.kondisi || "").toLowerCase() === "ada sebagian").length;
  const nCek = data.filter(cek).length;
  const nAntri = data.filter(antri).length;
  document.getElementById("ringkas").innerHTML = [
    ["Total item data", total, ""],
    ["Ada lengkap", nLengkap, `${persen(nLengkap, total)}% · ${nSebagian} ada sebagian`],
    ["Terverifikasi Deo", nCek, `${persen(nCek, total)}% dari total`],
    ["Antrean verifikasi", nAntri, "lengkap tapi belum dicentang"],
  ].map(([l, v, s]) => `<div class="card stat"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join("");

  // Per aspek
  const aspek = [...new Set(data.map((d) => d.aspek))];
  document.getElementById("per-aspek").innerHTML = aspek.map((a) => {
    const g = data.filter((d) => d.aspek === a);
    return barRow(`${a} (${g.length})`, g.filter(lengkap).length, g.length, g.filter(cek).length);
  }).join("");

  // Per instansi (dipecah pada "/" dan "+")
  const inst = {};
  data.forEach((d) => {
    String(d.sumber_instansi || "").split(/[\/+]/).map((s) => s.trim()).filter(Boolean).forEach((s) => {
      inst[s] = inst[s] || { total: 0, ada: 0 };
      inst[s].total++;
      if (lengkap(d)) inst[s].ada++;
    });
  });
  const barisInst = Object.entries(inst).sort((a, b) => b[1].total - a[1].total);
  document.getElementById("per-instansi").innerHTML = `<table><thead><tr><th>Instansi / sumber</th><th class="num">Item</th><th class="num">Ada lengkap</th></tr></thead><tbody>
    ${barisInst.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v.total}</td><td class="num">${v.ada}</td></tr>`).join("")}</tbody></table>`;

  // Tabel + filter
  const fA = document.getElementById("f-aspek"), fB = document.getElementById("f-bidang");
  const fK = document.getElementById("f-kondisi"), fC = document.getElementById("f-cek"), fQ = document.getElementById("f-cari");
  opsi(fA, data.map((d) => d.aspek), "Semua aspek");
  opsi(fB, data.map((d) => d.bidang_pj), "Semua bidang");
  opsi(fK, data.map((d) => d.kondisi), "Semua kondisi");

  function render() {
    const q = fQ.value.trim().toLowerCase();
    const rows = data.filter((d) =>
      (!fA.value || d.aspek === fA.value) &&
      (!fB.value || d.bidang_pj === fB.value) &&
      (!fK.value || d.kondisi === fK.value) &&
      (!fC.value || (fC.value === "ya" ? cek(d) : fC.value === "tidak" ? !cek(d) : antri(d))) &&
      (!q || [d.data, d.rincian_variabel, d.sumber_instansi, d.id].join(" ").toLowerCase().includes(q))
    );
    document.getElementById("jumlah").textContent = `${rows.length} dari ${total} item`;
    document.getElementById("tabel").innerHTML = rows.map((d) => {
      const kelas = KELAS_KONDISI[(d.kondisi || "").toLowerCase()] || "neutral";
      const verif = cek(d)
        ? `<span class="cek ya" title="Diverifikasi ${esc(d.tanggal_ceklis)}">✓</span> <span class="small muted">${esc(d.tanggal_ceklis)}</span>`
        : `<span class="cek tidak">☐</span>`;
      return `<tr class="${antri(d) ? "antri" : ""}">
        <td>${esc(d.id)}</td><td>${esc(d.aspek)}</td>
        <td><b>${esc(d.data)}</b><br><span class="small muted">${esc(d.rincian_variabel)}</span></td>
        <td>${esc(d.format)}</td>
        <td>${esc(d.sumber_instansi)}<br><span class="small muted">${esc(d.metode)}</span></td>
        <td class="small">${esc(d.dipakai_untuk)}</td><td>${esc(d.bidang_pj)}</td>
        <td><span class="pill ${kelas}">${esc(d.kondisi || "Belum ada")}</span></td>
        <td class="small">${esc(d.catatan_kondisi)}</td><td>${verif}</td></tr>`;
    }).join("");
  }
  [fA, fB, fK, fC].forEach((el) => el.addEventListener("change", render));
  fQ.addEventListener("input", render);
  render();
})();
