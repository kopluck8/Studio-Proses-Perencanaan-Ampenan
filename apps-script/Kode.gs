/**
 * Apps Script Dashboard Studio Ampenan.
 *
 * Pasang: buka Google Sheets kosong → Ekstensi → Apps Script → hapus isi Code.gs,
 * tempel seluruh file ini → Simpan → muat ulang Sheets. Menu "Dashboard Studio"
 * akan muncul. Jalankan "1. Siapkan semua tab" sekali.
 *
 * Isi awal tiap tab diambil langsung dari repo GitHub (data/sheets/<tab>.csv),
 * jadi tidak perlu impor CSV manual. Tab yang sudah berisi data tidak ditimpa.
 *
 * Bagian bawah file ini adalah penerima data dari dashboard (doPost). Anggota tim
 * mengisi di dashboard, skrip menulis ke spreadsheet atas nama admin, dan setiap
 * perubahan dicatat di tab log_perubahan untuk diverifikasi admin.
 */

const REPO_RAW = 'https://raw.githubusercontent.com/kopluck8/Studio-Proses-Perencanaan-Ampenan/main/data/sheets/';

// Urutan tab di spreadsheet. Progres dulu, lalu input kalkulator.
const TAB = [
  'jadwal', 'tugas', 'kebutuhan_data', 'survei_foto',
  'kelurahan', 'parameter', 'penduduk_seri', 'penduduk_struktur',
  'standar_sarana', 'sarana_eksisting', 'rth',
  'ekonomi_sektor', 'ekonomi_meta', 'pdrb_kecamatan', 'pekerja_sektor', 'lahan', 'lahan_meta', 'lahan_transisi', 'skl',
  'bencana', 'cagar_budaya', 'stakeholder', 'anggaran',
  'ahp_responden', 'wlc_layer', 'zonasi_wlc', 'mismatch', 'swot',
];

// Pilihan isian (dropdown) per tab dan kolom.
const PILIHAN = {
  tugas: {
    tahap: ['0', '1', '2', '3', '4'],
    status: ['Belum mulai', 'Dikerjakan', 'Review pembimbing', 'Selesai'],
  },
  kebutuhan_data: {
    kondisi: ['Belum ada', 'Sudah diminta', 'Ada sebagian', 'Ada lengkap', 'Tidak tersedia'],
  },
  survei_foto: {
    kategori: ['Cagar Budaya', 'Sempadan Alam', 'Rawan Bencana', 'Permukiman Kumuh & KDB',
      'Alih Fungsi KP2B', 'Sarana', 'Prasarana', 'Ekonomi & UMKM', 'Lainnya'],
  },
  cagar_budaya: { keaslian_fasad: ['3', '2', '1'], beralih_fungsi: ['ya', 'tidak'] },
  swot: { jenis: ['S', 'W', 'O', 'T'] },
};

// Kolom kotak centang.
const CENTANG = { tugas: ['terhambat'], kebutuhan_data: ['ceklis_deo'] };

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Dashboard Studio')
    .addItem('1. Siapkan semua tab', 'siapkanSemuaTab')
    .addItem('2. Kunci kolom ceklis untuk saya', 'kunciCeklis')
    .addItem('3. Bagikan agar dashboard bisa membaca', 'bagikanUntukDashboard')
    .addSeparator()
    .addItem('Tampilkan ID untuk config.json', 'tampilkanId')
    .addItem('Isi ulang satu tab dari repo (menimpa)', 'isiUlangSatuTab')
    .addItem('Sesuaikan: Lingkungan & struktur penduduk kecamatan', 'sesuaikanLingkunganDanStruktur')
    .addItem('Sesuaikan: Estimasi PDRB kecamatan', 'sesuaikanEstimasiPdrb')
    .addItem('Sesuaikan: Perubahan lahan (Sentinel-2)', 'sesuaikanPerubahanLahan')
    .addToUi();
}

function siapkanSemuaTab() {
  const ss = SpreadsheetApp.getActive();
  const laporan = [];
  TAB.forEach((nama, i) => {
    let sh = ss.getSheetByName(nama);
    if (!sh) sh = ss.insertSheet(nama, i);
    if (sh.getLastRow() > 1) { laporan.push(nama + ': sudah berisi, dilewati'); rapikan_(sh, nama); return; }
    isiDariRepo_(sh, nama);
    laporan.push(nama + ': dibuat');
  });
  // Hapus "Sheet1"/"Lembar1" bawaan bila kosong.
  ss.getSheets().forEach((sh) => {
    if (TAB.indexOf(sh.getName()) < 0 && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  SpreadsheetApp.getUi().alert('Selesai.\n\n' + laporan.join('\n') +
    '\n\nLangkah berikutnya: menu 2 (kunci ceklis) dan menu 3 (bagikan).');
}

function isiUlangSatuTab() {
  const ui = SpreadsheetApp.getUi();
  const jawab = ui.prompt('Isi ulang tab dari repo', 'Nama tab (isinya akan DITIMPA):\n' + TAB.join(', '), ui.ButtonSet.OK_CANCEL);
  if (jawab.getSelectedButton() !== ui.Button.OK) return;
  const nama = jawab.getResponseText().trim();
  if (TAB.indexOf(nama) < 0) { ui.alert('Tab "' + nama + '" tidak dikenal.'); return; }
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
  sh.clear();
  sh.getDataRange().clearDataValidations();
  isiDariRepo_(sh, nama);
  ui.alert('Tab ' + nama + ' sudah diisi ulang.');
}

function isiDariRepo_(sh, nama) {
  const res = UrlFetchApp.fetch(REPO_RAW + nama + '.csv', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Gagal mengambil ' + nama + '.csv dari repo (' + res.getResponseCode() + ')');
  const baris = Utilities.parseCsv(res.getContentText('UTF-8'));
  const lebar = Math.max.apply(null, baris.map((b) => b.length));
  const data = baris.map((b) => { while (b.length < lebar) b.push(''); return b; });
  // Semua sel berformat teks biasa supaya angka, tahun, dan tanggal terbaca apa adanya oleh dashboard.
  sh.getRange(1, 1, Math.max(data.length + 200, 300), lebar).setNumberFormat('@');
  sh.getRange(1, 1, data.length, lebar).setValues(data);
  rapikan_(sh, nama);
}

function rapikan_(sh, nama) {
  const lebar = sh.getLastColumn();
  if (!lebar) return;
  const kepala = sh.getRange(1, 1, 1, lebar).getValues()[0].map(String);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, lebar).setFontWeight('bold').setBackground('#d8ece5');
  const akhir = Math.max(sh.getLastRow(), 2) + 200;

  const pilihan = PILIHAN[nama] || {};
  Object.keys(pilihan).forEach((kol) => {
    const c = kepala.indexOf(kol) + 1;
    if (!c) return;
    const aturan = SpreadsheetApp.newDataValidation().requireValueInList(pilihan[kol], true).setAllowInvalid(true).build();
    sh.getRange(2, c, akhir - 1, 1).setDataValidation(aturan);
  });
  (CENTANG[nama] || []).forEach((kol) => {
    const c = kepala.indexOf(kol) + 1;
    if (!c) return;
    const rentang = sh.getRange(2, c, Math.max(sh.getLastRow() - 1, 1), 1);
    const nilai = rentang.getValues().map((r) => [/^(true|ya|1|✓|v|x)$/i.test(String(r[0]).trim())]);
    rentang.insertCheckboxes();
    rentang.setValues(nilai);
  });

  // Baris judul diberi peringatan bila diubah (nama kolom dibaca dashboard).
  const sudah = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).some((p) => p.getDescription() === 'Judul kolom');
  if (!sudah) sh.getRange(1, 1, 1, lebar).protect().setDescription('Judul kolom').setWarningOnly(true);
  sh.autoResizeColumns(1, Math.min(lebar, 12));
}

// Hanya akun yang menjalankan menu ini (admin) yang bisa mengubah kolom ceklis_deo dan tanggal_ceklis.
function kunciCeklis() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('kebutuhan_data');
  if (!sh) { SpreadsheetApp.getUi().alert('Jalankan menu 1 dulu.'); return; }
  const kepala = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const c1 = kepala.indexOf('ceklis_deo') + 1, c2 = kepala.indexOf('tanggal_ceklis') + 1;
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .filter((p) => p.getDescription() === 'Ceklis admin').forEach((p) => p.remove());
  const saya = Session.getEffectiveUser();
  const p = sh.getRange(1, Math.min(c1, c2), sh.getMaxRows(), Math.abs(c2 - c1) + 1).protect().setDescription('Ceklis admin');
  p.addEditor(saya);
  p.removeEditors(p.getEditors().filter((u) => u.getEmail() !== saya.getEmail()));
  if (p.canDomainEdit()) p.setDomainEdit(false);
  SpreadsheetApp.getUi().alert('Kolom ceklis_deo dan tanggal_ceklis sekarang hanya bisa diubah oleh ' + saya.getEmail() + '.');
}

// Mencentang ceklis_deo otomatis mengisi tanggal_ceklis.
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== 'kebutuhan_data' || e.range.getRow() < 2) return;
  const kepala = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const c1 = kepala.indexOf('ceklis_deo') + 1, c2 = kepala.indexOf('tanggal_ceklis') + 1;
  if (!c1 || !c2 || e.range.getColumn() !== c1 || e.range.getNumColumns() !== 1) return;
  const tz = Session.getScriptTimeZone();
  const nilai = e.range.getValues().map((r) => [r[0] === true ? Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') : '']);
  sh.getRange(e.range.getRow(), c2, nilai.length, 1).setValues(nilai);
}

// Dashboard membaca data lewat tautan "siapa pun yang memiliki link dapat melihat".
// Anggota tim tetap perlu ditambahkan sebagai editor lewat tombol Bagikan.
function bagikanUntukDashboard() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert('Bagikan spreadsheet', 'Spreadsheet akan bisa DILIHAT siapa pun yang punya link (sesuai keputusan repo publik). ' +
    'Mengedit tetap hanya untuk orang yang diundang admin. Lanjut?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  DriveApp.getFileById(SpreadsheetApp.getActive().getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  tampilkanId();
}

function tampilkanId() {
  const id = SpreadsheetApp.getActive().getId();
  SpreadsheetApp.getUi().alert('Salin ID ini ke data/config.json pada "google_sheets_id":\n\n' + id);
}


// ===================== Penerima data dari dashboard =====================
// Pasang: Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone.
// Setiap kali kode ini diubah: Deploy → Manage deployments → Edit → Version: New version.

// Kolom yang boleh diisi tim per tab. kolom '*' = semua kolom kecuali kunci.
// kunci = kolom penanda baris yang tidak boleh diubah pada baris yang sudah ada.
// tambah = tim boleh menambah baris baru. Tab yang tidak tercantum hanya bisa diubah admin
// (misalnya parameter dan standar_sarana).
const BOLEH = {
  jadwal: { kolom: ['tautan_notulensi'] },
  tugas: { kolom: ['status', 'terhambat', 'catatan', 'tautan_hasil'], tambah: true,
    kolomTambah: ['tahap', 'aspek', 'bidang', 'pj', 'judul', 'sesi_target', 'tenggat', 'status', 'catatan'] },
  kebutuhan_data: { kolom: ['kondisi', 'catatan_kondisi'] },
  survei_foto: { kolom: ['kategori', 'judul', 'keterangan_temuan', 'kondisi', 'surveyor', 'bidang', 'arah_foto', 'kaitan_analisis'], tambah: true,
    kolomTambah: ['nama_file', 'kategori', 'judul', 'keterangan_temuan', 'kondisi', 'surveyor', 'bidang', 'arah_foto', 'kaitan_analisis'] },
  kelurahan: { kolom: ['jumlah_lingkungan', 'lahan_permukiman_ha'] },
  penduduk_seri: { kolom: '*', kunci: ['kelurahan'] },
  penduduk_struktur: { kolom: '*', kunci: ['kelompok_umur'] },
  sarana_eksisting: { kolom: '*', kunci: ['kelurahan'] },
  rth: { kolom: '*', kunci: ['kelurahan'] },
  ekonomi_sektor: { kolom: '*', kunci: ['sektor'] },
  ekonomi_meta: { kolom: '*', kunci: ['kunci'] },
  pdrb_kecamatan: { kolom: '*', kunci: ['kecamatan'] },
  pekerja_sektor: { kolom: '*', kunci: ['kelompok', 'kategori_pdrb', 'periode'], tambah: true },
  lahan: { kolom: '*', kunci: ['kelurahan'], tambah: true },
  lahan_meta: { kolom: '*', kunci: ['kunci'] },
  lahan_transisi: { kolom: '*', kunci: ['kelurahan', 'dari', 'menjadi'], tambah: true },
  skl: { kolom: '*', tambah: true },
  bencana: { kolom: '*', kunci: ['kelurahan'] },
  cagar_budaya: { kolom: '*', tambah: true },
  stakeholder: { kolom: '*', tambah: true },
  anggaran: { kolom: '*', tambah: true },
  ahp_responden: { kolom: '*', tambah: true },
  wlc_layer: { kolom: '*', tambah: true },
  zonasi_wlc: { kolom: '*', kunci: ['kelurahan'] },
  mismatch: { kolom: '*', kunci: ['kelurahan', 'jenis'], tambah: true },
  swot: { kolom: '*', tambah: true },
};

function doGet() {
  return jawab_({ ok: true, pesan: 'Penerima data Dashboard Studio aktif.' });
}

function doPost(e) {
  let masuk;
  try { masuk = JSON.parse(e.postData.contents); } catch (err) { return jawab_({ ok: false, pesan: 'Data tidak terbaca.' }); }
  const nama = String(masuk.nama || '').trim().slice(0, 80);
  if (!nama) return jawab_({ ok: false, pesan: 'Nama pengisi wajib diisi.' });
  if (masuk.aksi === 'cek') return jawab_({ ok: true, pesan: 'Penerima data siap.' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jawab_({ ok: false, pesan: 'Spreadsheet sedang sibuk, coba lagi.' });
  try {
    return jawab_(simpan_(masuk, nama));
  } catch (err) {
    return jawab_({ ok: false, pesan: 'Gagal menyimpan: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

function simpan_(masuk, nama) {
  const tab = String(masuk.tab || '');
  const aturan = BOLEH[tab];
  if (!aturan) return { ok: false, pesan: 'Tab ' + tab + ' hanya bisa diubah admin di spreadsheet.' };
  const sh = SpreadsheetApp.getActive().getSheetByName(tab);
  if (!sh) return { ok: false, pesan: 'Tab ' + tab + ' tidak ada di spreadsheet.' };

  const lebar = sh.getLastColumn();
  const kepala = sh.getRange(1, 1, 1, lebar).getValues()[0].map((v) => String(v).trim());
  const kunci = aturan.kunci || [];
  const bolehUbah = (k) => kepala.indexOf(k) >= 0 && kunci.indexOf(k) < 0 && (aturan.kolom === '*' || aturan.kolom.indexOf(k) >= 0);
  const bolehTambah = (k) => kepala.indexOf(k) >= 0 && (aturan.kolomTambah ? aturan.kolomTambah.indexOf(k) >= 0 : aturan.kolom === '*' || aturan.kolom.indexOf(k) >= 0 || kunci.indexOf(k) >= 0);
  const log = [];
  const waktu = new Date();
  const hasil = { ok: true, diubah: 0, ditambah: 0, ditolak: [], konflik: [] };

  const n = Math.max(sh.getLastRow() - 1, 0);
  const tampil = n ? sh.getRange(2, 1, n, lebar).getDisplayValues() : [];
  const cocok = (i, asli) => Object.keys(asli).every((k) => {
    const c = kepala.indexOf(k);
    return c < 0 || String(tampil[i][c]).trim() === String(asli[k] ?? '').trim();
  });

  (masuk.perubahan || []).forEach((u) => {
    // Cari baris: pakai nomor baris bila isinya masih sama, bila tidak cari baris yang isinya sama.
    let i = Number(u.baris) - 2;
    if (!(i >= 0 && i < n && cocok(i, u.asli || {}))) {
      const calon = [];
      for (let j = 0; j < n; j++) if (cocok(j, u.asli || {})) calon.push(j);
      i = calon.length === 1 ? calon[0] : -1;
    }
    if (i < 0) { hasil.konflik.push(ringkasBaris_(u.asli, kepala)); return; }
    Object.keys(u.baru || {}).forEach((k) => {
      if (!bolehUbah(k)) { hasil.ditolak.push(k); return; }
      const c = kepala.indexOf(k);
      const lama = tampil[i][c];
      const baru = String(u.baru[k] ?? '').trim();
      if (String(lama).trim() === baru) return;
      tulisSel_(sh.getRange(i + 2, c + 1), baru);
      tampil[i][c] = baru;
      log.push([waktu, nama, tab, i + 2, ringkasBaris_(u.asli, kepala), k, lama, baru, false]);
      hasil.diubah++;
    });
  });

  if ((masuk.tambah || []).length && !aturan.tambah) {
    hasil.ditolak.push('baris baru (tab ' + tab + ' tidak bisa ditambah dari dashboard)');
  } else {
    (masuk.tambah || []).forEach((t) => {
      const isi = kepala.map((k) => (bolehTambah(k) ? String(t[k] ?? '').trim() : ''));
      if (tab === 'tugas') isi[kepala.indexOf('id')] = idTugasBaru_(sh, kepala);
      if (!isi.some((v) => v !== '')) return;
      const r = sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, lebar).setNumberFormat('@');
      kepala.forEach((k, c) => { if (isi[c] !== '') tulisSel_(sh.getRange(r, c + 1), isi[c]); });
      log.push([waktu, nama, tab, r, '(baris baru)', '', '', isi.filter(Boolean).join(' | '), false]);
      hasil.ditambah++;
    });
  }

  if (log.length) catatLog_(log);
  hasil.ditolak = Array.from(new Set(hasil.ditolak));
  return hasil;
}

function tulisSel_(sel, nilai) {
  const v = sel.getDataValidation();
  if (v && v.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
    sel.setValue(/^(true|ya|1|✓|v|x)$/i.test(nilai));
  } else {
    sel.setValue(nilai);
  }
}

function idTugasBaru_(sh, kepala) {
  const c = kepala.indexOf('id') + 1;
  const n = Math.max(sh.getLastRow() - 1, 0);
  const ada = n ? sh.getRange(2, c, n, 1).getValues().map((r) => Number(String(r[0]).replace(/\D/g, '')) || 0) : [];
  return 'T-' + String(Math.max(0, ...ada) + 1).padStart(2, '0');
}

function ringkasBaris_(asli, kepala) {
  if (!asli) return '';
  return kepala.slice(0, 2).map((k) => asli[k]).filter(Boolean).join(' · ');
}

function catatLog_(baris) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('log_perubahan');
  if (!sh) {
    sh = ss.insertSheet('log_perubahan');
    sh.appendRow(['waktu', 'pengisi', 'tab', 'baris', 'data', 'kolom', 'nilai_lama', 'nilai_baru', 'dicek_admin']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#fbedd0');
  }
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1, baris.length, 9).setValues(baris);
  sh.getRange(r, 9, baris.length, 1).insertCheckboxes();
}

function jawab_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===================== Penyesuaian 24 Okt 2026 =====================
// Ampenan tidak memakai RW (hanya Lingkungan), dan data kelompok umur hanya tersedia
// tingkat kecamatan. Jalankan sekali dari menu; isian yang sudah ada dipertahankan.
function sesuaikanLingkunganDanStruktur() {
  const ss = SpreadsheetApp.getActive();
  const catatan = [];

  // kelurahan: jumlah_rw + jumlah_rt -> jumlah_lingkungan
  const kel = ss.getSheetByName('kelurahan');
  if (kel) {
    const kepala = kel.getRange(1, 1, 1, kel.getLastColumn()).getValues()[0].map(String);
    const cRw = kepala.indexOf('jumlah_rw') + 1, cRt = kepala.indexOf('jumlah_rt') + 1;
    if (cRw) {
      kel.getRange(1, cRw).setValue('jumlah_lingkungan');
      catatan.push('kelurahan: kolom jumlah_rw diganti jumlah_lingkungan');
    }
    if (cRt) {
      const isi = kel.getLastRow() > 1 && kel.getRange(2, cRt, kel.getLastRow() - 1, 1).getValues().some((r) => r[0] !== '');
      if (!isi) { kel.deleteColumn(cRt); catatan.push('kelurahan: kolom jumlah_rt (kosong) dihapus'); }
      else catatan.push('kelurahan: kolom jumlah_rt berisi data, dibiarkan');
    }
  }

  // penduduk_struktur: dari per kelurahan menjadi tingkat kecamatan (jumlahkan isian lama bila ada)
  const st = ss.getSheetByName('penduduk_struktur');
  if (st && st.getLastColumn()) {
    const nilai = st.getDataRange().getValues();
    const kepala = nilai[0].map(String);
    if (kepala.indexOf('kelurahan') >= 0) {
      const cU = kepala.indexOf('kelompok_umur'), cL = kepala.indexOf('laki_laki'), cP = kepala.indexOf('perempuan');
      const urut = [], jumlah = {};
      nilai.slice(1).forEach((r) => {
        const u = String(r[cU]).trim();
        if (!u) return;
        if (!jumlah[u]) { jumlah[u] = { L: '', P: '' }; urut.push(u); }
        const tambah = (lama, v) => { const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return v === '' || isNaN(n) ? lama : (Number(lama) || 0) + n; };
        jumlah[u].L = tambah(jumlah[u].L, r[cL]);
        jumlah[u].P = tambah(jumlah[u].P, r[cP]);
      });
      st.clear();
      st.getDataRange().clearDataValidations();
      const baru = [['kelompok_umur', 'laki_laki', 'perempuan']].concat(urut.map((u) => [u, String(jumlah[u].L), String(jumlah[u].P)]));
      st.getRange(1, 1, 300, 3).setNumberFormat('@');
      st.getRange(1, 1, baru.length, 3).setValues(baru);
      rapikan_(st, 'penduduk_struktur');
      catatan.push('penduduk_struktur: diubah menjadi tingkat kecamatan (16 kelompok umur)');
    }
  }

  // Taman RW -> Taman Lingkungan (standar sarana dan sarana eksisting)
  const std = ss.getSheetByName('standar_sarana');
  if (std && std.getLastRow() > 1) {
    const r = std.getRange(2, 1, std.getLastRow() - 1, 1);
    r.setValues(r.getValues().map((x) => [x[0] === 'Taman RW' ? 'Taman Lingkungan' : x[0]]));
  }
  const sar = ss.getSheetByName('sarana_eksisting');
  if (sar && sar.getLastColumn()) {
    const r = sar.getRange(1, 1, 1, sar.getLastColumn());
    r.setValues([r.getValues()[0].map((x) => (x === 'Taman RW' ? 'Taman Lingkungan' : x))]);
    catatan.push('sarana: Taman RW diganti Taman Lingkungan');
  }

  // Keterangan kebutuhan data DM-02
  const kd = ss.getSheetByName('kebutuhan_data');
  if (kd && kd.getLastRow() > 1) {
    const kepala = kd.getRange(1, 1, 1, kd.getLastColumn()).getValues()[0].map(String);
    const cId = kepala.indexOf('id') + 1, cR = kepala.indexOf('rincian_variabel') + 1;
    const ids = kd.getRange(2, cId, kd.getLastRow() - 1, 1).getValues();
    ids.forEach((x, i) => { if (x[0] === 'DM-02') kd.getRange(i + 2, cR).setValue('Kelompok umur 5 tahunan tingkat kecamatan (tidak tersedia per kelurahan)'); });
  }

  SpreadsheetApp.getUi().alert('Penyesuaian selesai.\n\n' + (catatan.join('\n') || 'Tidak ada yang perlu diubah.'));
}


// ===================== Penyesuaian 24 Okt 2026 (2) =====================
// Kalkulator Estimasi PDRB Kecamatan: dua tab baru, baris baru di ekonomi_meta dan parameter,
// serta kebutuhan data ekonomi yang diperbarui. Isian yang sudah ada tidak ditimpa.
function sesuaikanEstimasiPdrb() {
  const ss = SpreadsheetApp.getActive();
  const catatan = [];

  ['pdrb_kecamatan', 'pekerja_sektor'].forEach((nama) => {
    let sh = ss.getSheetByName(nama);
    // Tab yang sudah ada tetapi angkanya masih kosong semua diisi ulang dari repo.
    const mulai = nama === 'pekerja_sektor' ? 4 : 2;
    const adaIsi = sh && sh.getLastRow() > 1 && sh.getLastColumn() >= mulai &&
      sh.getRange(2, mulai, sh.getLastRow() - 1, sh.getLastColumn() - mulai + 1).getValues().some((r) => r.some((v) => String(v).trim() !== ''));
    if (adaIsi) { catatan.push(nama + ': sudah berisi, dilewati'); return; }
    if (!sh) sh = ss.insertSheet(nama, TAB.indexOf(nama));
    sh.clear();
    sh.getDataRange().clearDataValidations();
    isiDariRepo_(sh, nama);
    catatan.push(nama + ': tab dibuat');
  });

  // Tambah baris yang belum ada (kunci di kolom pertama) dari salinan repo.
  const tambahBaris = (nama, isiKosongJuga) => {
    const sh = ss.getSheetByName(nama);
    if (!sh) return;
    const res = UrlFetchApp.fetch(REPO_RAW + nama + '.csv', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return;
    const repo = Utilities.parseCsv(res.getContentText('UTF-8'));
    const nilai = sh.getDataRange().getValues();
    const kunci = nilai.map((r) => String(r[0]).trim());
    repo.slice(1).forEach((r) => {
      const i = kunci.indexOf(r[0]);
      if (i < 0) {
        sh.getRange(sh.getLastRow() + 1, 1, 1, r.length).setNumberFormat('@').setValues([r]);
        catatan.push(nama + ': baris ' + r[0] + ' ditambahkan');
      } else if (isiKosongJuga && isiKosongJuga.indexOf(r[0]) >= 0) {
        // Ganti nilai bawaan lama yang masih kosong atau masih teks contoh.
        const lama = String(nilai[i][1]).trim();
        if (!lama || /pilih satu/i.test(lama)) { sh.getRange(i + 1, 2).setNumberFormat('@').setValue(r[1]); catatan.push(nama + ': ' + r[0] + ' diisi'); }
      }
    });
  };
  tambahBaris('ekonomi_meta', ['variabel', 'tahun_awal', 'tahun_akhir']);
  tambahBaris('parameter');

  // Isi sel yang masih kosong (atau masih berisi angka bawaan versi sebelumnya) dari salinan repo.
  const isiDariSeed = (nama, kolom, lama) => {
    const sh = ss.getSheetByName(nama);
    if (!sh || sh.getLastRow() < 2) return;
    const res = UrlFetchApp.fetch(REPO_RAW + nama + '.csv', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return;
    const repo = Utilities.parseCsv(res.getContentText('UTF-8'));
    const kRepo = repo[0];
    const peta = {};
    repo.slice(1).forEach((r) => { peta[String(r[0]).trim()] = r; });
    const nilai = sh.getDataRange().getValues();
    const kepala = nilai[0].map(String);
    let n = 0;
    nilai.slice(1).forEach((r, i) => {
      const sumber = peta[String(r[0]).trim()];
      if (!sumber) return;
      kolom.forEach((k) => {
        const c = kepala.indexOf(k), j = kRepo.indexOf(k);
        if (c < 0 || j < 0 || sumber[j] === '') return;
        const isi = String(r[c]).trim();
        if (isi === '' || (lama && lama.indexOf(isi) >= 0)) { sh.getRange(i + 2, c + 1).setNumberFormat('@').setValue(sumber[j]); n++; }
      });
    });
    if (n) catatan.push(nama + ': ' + n + ' sel diisi dari data BPS');
  };
  isiDariSeed('ekonomi_sektor', ['pembanding_awal', 'pembanding_akhir']);
  isiDariSeed('pdrb_kecamatan', ['penduduk_awal', 'penduduk_akhir'], ['91311', '69261', '79132', '71662', '60816', '68965']);
  isiDariSeed('ekonomi_meta', ['nilai'], ['2023', 'PDRB / tenaga kerja / unit usaha (pilih satu)']);

  // Kebutuhan data ekonomi: perbarui EK-01/EK-02 dan tambah EK-06..EK-08 (kolom kondisi dan ceklis tidak diubah).
  const kd = ss.getSheetByName('kebutuhan_data');
  const res = UrlFetchApp.fetch(REPO_RAW + 'kebutuhan_data.csv', { muteHttpExceptions: true });
  if (kd && res.getResponseCode() === 200) {
    const repo = Utilities.parseCsv(res.getContentText('UTF-8'));
    const kRepo = repo[0];
    const kepala = kd.getRange(1, 1, 1, kd.getLastColumn()).getValues()[0].map(String);
    const ids = kd.getRange(1, 1, kd.getLastRow(), 1).getValues().map((r) => String(r[0]).trim());
    const ubahKolom = ['data', 'rincian_variabel', 'format', 'sumber_instansi', 'metode', 'dipakai_untuk'];
    repo.slice(1).filter((r) => /^EK-0[1-26-8]$/.test(r[0])).forEach((r) => {
      const i = ids.indexOf(r[0]);
      if (i < 0) {
        const baris = kepala.map((k) => { const j = kRepo.indexOf(k); return j < 0 ? '' : r[j]; });
        const cCek = kepala.indexOf('ceklis_deo');
        if (cCek >= 0) baris[cCek] = false;
        // Sisipkan setelah baris EK terakhir supaya urutannya rapi.
        let setelah = ids.reduce((a, x, k) => (/^EK-/.test(x) ? k : a), kd.getLastRow() - 1);
        kd.insertRowAfter(setelah + 1);
        kd.getRange(setelah + 2, 1, 1, baris.length).setValues([baris]);
        if (cCek >= 0) kd.getRange(setelah + 2, cCek + 1).insertCheckboxes().setValue(false);
        ids.splice(setelah + 1, 0, r[0]);
        catatan.push('kebutuhan_data: ' + r[0] + ' ditambahkan');
      } else {
        ubahKolom.forEach((k) => {
          const c = kepala.indexOf(k), j = kRepo.indexOf(k);
          if (c >= 0 && j >= 0) kd.getRange(i + 1, c + 1).setValue(r[j]);
        });
        catatan.push('kebutuhan_data: ' + r[0] + ' diperbarui');
      }
    });
  }

  SpreadsheetApp.getUi().alert('Penyesuaian selesai.\n\n' + (catatan.join('\n') || 'Tidak ada yang perlu diubah.'));
}

// Mengisi tab perubahan lahan dari hasil klasifikasi Sentinel-2 di repo. Angka yang sudah diisi tim tidak ditimpa.
function sesuaikanPerubahanLahan() {
  const ss = SpreadsheetApp.getActive();
  const catatan = [];
  const repo = (nama) => {
    const res = UrlFetchApp.fetch(REPO_RAW + nama + '.csv', { muteHttpExceptions: true });
    return res.getResponseCode() === 200 ? Utilities.parseCsv(res.getContentText('UTF-8')) : null;
  };
  const kosongSemua = (sh, mulai) => !(sh.getLastRow() > 1 && sh.getLastColumn() >= mulai &&
    sh.getRange(2, mulai, sh.getLastRow() - 1, sh.getLastColumn() - mulai + 1).getValues().some((r) => r.some((v) => String(v).trim() !== '')));

  // lahan (kelas lama masih kosong) dan lahan_transisi (tab baru) diisi ulang dari repo.
  [['lahan', 3], ['lahan_transisi', 4]].forEach(([nama, mulai]) => {
    let sh = ss.getSheetByName(nama);
    if (sh && !kosongSemua(sh, mulai)) { catatan.push(nama + ': sudah berisi angka, dilewati (pakai menu Isi ulang satu tab bila ingin menimpa)'); return; }
    const baru = !sh;
    if (!sh) sh = ss.insertSheet(nama, TAB.indexOf(nama));
    sh.clear();
    sh.getDataRange().clearDataValidations();
    isiDariRepo_(sh, nama);
    catatan.push(nama + (baru ? ': tab dibuat dan diisi' : ': diisi dari klasifikasi Sentinel-2'));
  });

  // Isi sel kosong pada baris yang kuncinya sama dengan salinan repo; baris yang belum ada ditambahkan bila diminta.
  const isiKosong = (nama, kunci, kolom, tambah, saring) => {
    const sh = ss.getSheetByName(nama), data = repo(nama);
    if (!sh || !data) return;
    const kRepo = data[0], nilai = sh.getDataRange().getValues(), kepala = nilai[0].map((v) => String(v).trim());
    const id = (r, kp) => kunci.map((k) => String(r[kp.indexOf(k)]).trim()).join('|');
    const peta = {};
    nilai.slice(1).forEach((r, i) => { peta[id(r, kepala)] = i + 2; });
    let n = 0;
    data.slice(1).filter((r) => !saring || saring(r, kRepo)).forEach((r) => {
      const baris = peta[id(r, kRepo)];
      if (!baris) {
        if (!tambah) return;
        const isi = kepala.map((k) => { const j = kRepo.indexOf(k); return j < 0 ? '' : r[j]; });
        sh.getRange(sh.getLastRow() + 1, 1, 1, isi.length).setNumberFormat('@').setValues([isi]);
        catatan.push(nama + ': baris ' + id(r, kRepo) + ' ditambahkan');
        return;
      }
      kolom.forEach((k) => {
        const c = kepala.indexOf(k), j = kRepo.indexOf(k);
        if (c < 0 || j < 0 || r[j] === '' || String(nilai[baris - 1][c]).trim() !== '') return;
        sh.getRange(baris, c + 1).setNumberFormat('@').setValue(r[j]);
        n++;
      });
    });
    if (n) catatan.push(nama + ': ' + n + ' sel kosong diisi');
  };
  isiKosong('lahan_meta', ['kunci'], ['nilai'], true);
  isiKosong('mismatch', ['kelurahan', 'jenis'], ['luas_ha', 'luas_zona_ha'], false, (r, k) => r[k.indexOf('jenis')] === 'Mismatch: KP2B');

  // Kebutuhan data FL-07, FL-08, EK-05: kondisi diperbarui hanya bila masih "Belum ada".
  const kd = ss.getSheetByName('kebutuhan_data'), data = repo('kebutuhan_data');
  if (kd && data) {
    const kRepo = data[0], kepala = kd.getRange(1, 1, 1, kd.getLastColumn()).getValues()[0].map(String);
    const ids = kd.getRange(1, 1, kd.getLastRow(), 1).getValues().map((r) => String(r[0]).trim());
    const cK = kepala.indexOf('kondisi'), cC = kepala.indexOf('catatan_kondisi');
    data.slice(1).filter((r) => ['FL-07', 'FL-08', 'EK-05'].indexOf(r[0]) >= 0).forEach((r) => {
      const i = ids.indexOf(r[0]);
      if (i < 0 || cK < 0) return;
      const lama = String(kd.getRange(i + 1, cK + 1).getValue()).trim();
      if (lama && lama !== 'Belum ada') return;
      kd.getRange(i + 1, cK + 1).setValue(r[kRepo.indexOf('kondisi')]);
      if (cC >= 0) kd.getRange(i + 1, cC + 1).setValue(r[kRepo.indexOf('catatan_kondisi')]);
      catatan.push('kebutuhan_data: ' + r[0] + ' diperbarui');
    });
  }

  SpreadsheetApp.getUi().alert('Penyesuaian selesai.\n\n' + (catatan.join('\n') || 'Tidak ada yang perlu diubah.'));
}
