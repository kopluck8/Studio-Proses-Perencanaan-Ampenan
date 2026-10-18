/**
 * Apps Script Dashboard Studio Ampenan.
 *
 * Pasang: buka Google Sheets kosong → Ekstensi → Apps Script → hapus isi Code.gs,
 * tempel seluruh file ini → Simpan → muat ulang Sheets. Menu "Dashboard Studio"
 * akan muncul. Jalankan "1. Siapkan semua tab" sekali.
 *
 * Isi awal tiap tab diambil langsung dari repo GitHub (data/sheets/<tab>.csv),
 * jadi tidak perlu impor CSV manual. Tab yang sudah berisi data tidak ditimpa.
 */

const REPO_RAW = 'https://raw.githubusercontent.com/kopluck8/Studio-Proses-Perencanaan-Ampenan/main/data/sheets/';

// Urutan tab di spreadsheet. Progres dulu, lalu input kalkulator.
const TAB = [
  'jadwal', 'tugas', 'kebutuhan_data', 'survei_foto',
  'kelurahan', 'parameter', 'penduduk_seri', 'penduduk_struktur',
  'standar_sarana', 'sarana_eksisting', 'rth',
  'ekonomi_sektor', 'ekonomi_meta', 'lahan', 'lahan_meta', 'skl',
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

// Hanya akun yang menjalankan menu ini (Deo) yang bisa mengubah kolom ceklis_deo dan tanggal_ceklis.
function kunciCeklis() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('kebutuhan_data');
  if (!sh) { SpreadsheetApp.getUi().alert('Jalankan menu 1 dulu.'); return; }
  const kepala = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const c1 = kepala.indexOf('ceklis_deo') + 1, c2 = kepala.indexOf('tanggal_ceklis') + 1;
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .filter((p) => p.getDescription() === 'Ceklis Deo').forEach((p) => p.remove());
  const saya = Session.getEffectiveUser();
  const p = sh.getRange(1, Math.min(c1, c2), sh.getMaxRows(), Math.abs(c2 - c1) + 1).protect().setDescription('Ceklis Deo');
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
    'Mengedit tetap hanya untuk orang yang Deo undang. Lanjut?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  DriveApp.getFileById(SpreadsheetApp.getActive().getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  tampilkanId();
}

function tampilkanId() {
  const id = SpreadsheetApp.getActive().getId();
  SpreadsheetApp.getUi().alert('Salin ID ini ke data/config.json pada "google_sheets_id":\n\n' + id);
}
