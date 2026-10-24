# Dashboard Studio Proses Perencanaan · Kecamatan Ampenan

Dashboard progres dan hasil analisis Studio Proses Perencanaan (PWKL4205/STPL4213), Prodi PWK Universitas Terbuka, UPBJJ Mataram. Wilayah studi: Kecamatan Ampenan, Kota Mataram (10 kelurahan). Jadwal: 12 sesi Tuweb, 6 September – 22 November 2026.

Halaman:

| Halaman | Isi | Sumber data |
|---|---|---|
| Beranda (`index.html`) | Ringkasan sesi, tugas, data, foto survei | semua tab |
| Jadwal (`jadwal.html`) | 12 sesi dan milestone | tab `jadwal` |
| Tugas (`tugas.html`) | Tugas per bidang dan PJ | tab `tugas` |
| Kebutuhan Data (`kebutuhan-data.html`) | Daftar 49 data, kondisi, verifikasi admin | tab `kebutuhan_data` |
| Peta Survei (`peta-survei.html`) | Titik foto survei lapangan dengan popup foto | `data/survei/survei_foto.csv` + tab `survei_foto` |
| Analisis (`analisis/`) | Kalkulator analisis 6 aspek dan tahap 2–4 | tab input per kalkulator |

Situs ini statis (HTML, CSS, JavaScript tanpa proses build) dan dijalankan oleh GitHub Pages.

## 1. Mengaktifkan GitHub Pages

1. Buka **Settings → Pages** di repo.
2. Pada **Build and deployment**, pilih **Deploy from a branch**, cabang `main`, folder `/ (root)`, lalu **Save**.
3. Setelah satu-dua menit situs tampil di `https://kopluck8.github.io/Studio-Proses-Perencanaan-Ampenan/`.

## 2. Menghubungkan Google Sheets (otomatis dengan Apps Script)

Semua data progres dan input kalkulator diisi tim di satu Google Sheets. Tidak perlu impor CSV atau menyalin URL per tab.

1. Buat Google Sheets baru (dengan akun admin).
2. **Ekstensi → Apps Script**. Hapus isi `Code.gs`, tempel seluruh isi [`apps-script/Kode.gs`](apps-script/Kode.gs), lalu **Simpan**.
3. Kembali ke Sheets dan muat ulang halaman. Menu **Dashboard Studio** muncul.
4. Jalankan **1. Siapkan semua tab**. Pertama kali Google meminta izin; pilih akun, **Lanjutan → Buka (tidak aman)**, lalu **Izinkan** (skrip ini milik admin sendiri). Skrip membuat 25 tab, mengisi isi awalnya langsung dari repo, menambah dropdown dan kotak centang, serta mengunci baris judul dengan peringatan.
5. Jalankan **2. Kunci kolom ceklis untuk saya**. Kolom `ceklis_deo` dan `tanggal_ceklis` hanya bisa diubah akun admin. Saat admin mencentang, `tanggal_ceklis` terisi otomatis.
6. Jalankan **3. Bagikan agar dashboard bisa membaca**. Spreadsheet bisa dilihat siapa pun yang punya link (mengedit tetap hanya untuk yang diundang), lalu ID spreadsheet ditampilkan.
7. Tempel ID itu di `data/config.json`: `"google_sheets_id": "ID_SPREADSHEET"`, lalu commit.
8. Pasang penerima data supaya tim bisa mengisi dari dashboard: di editor Apps Script pilih **Deploy → New deployment → Web app**, isi **Execute as: Me** dan **Who has access: Anyone**, lalu **Deploy**. Salin alamat `.../exec` ke `data/config.json` pada `"apps_script_url"`. Setiap kali `Kode.gs` diperbarui: **Deploy → Manage deployments → Edit (ikon pensil) → Version: New version → Deploy**; alamatnya tetap sama.

### Alur isian tim dan verifikasi admin

- Anggota tim **tidak perlu akses edit** ke spreadsheet. Mereka mengisi di dashboard: tabel input kalkulator, kolom status/catatan di halaman Tugas, kondisi di Kebutuhan Data, dan tombol **Isi keterangan** di popup Peta Survei. Saat pertama menyimpan, dashboard menanyakan nama pengisi (diingat di browser itu).
- Penerima data menulis ke spreadsheet atas nama admin dan mencatat setiap perubahan di tab `log_perubahan` (waktu, pengisi, tab, baris, kolom, nilai lama, nilai baru, kotak `dicek_admin`). Admin memeriksa dan merapikan langsung di spreadsheet; perbaikan admin langsung tampil di dashboard.
- Kolom yang boleh diisi tim diatur di `BOLEH` pada `Kode.gs`. Tab `parameter` dan `standar_sarana`, kolom `ceklis_deo`/`tanggal_ceklis`, serta `luas_ha` kelurahan hanya bisa diubah admin. Menghapus baris juga hanya oleh admin.
- Bila admin mengubah baris yang sedang diisi anggota, penyimpanan anggota untuk baris itu ditolak dengan pesan "muat ulang", supaya perbaikan admin tidak tertimpa.

Setelah itu dashboard membaca Sheets langsung setiap kali halaman dibuka; perubahan di Sheets langsung terlihat setelah halaman dimuat ulang. Bagian bawah setiap halaman menulis sumber datanya ("Google Sheets (langsung)" atau "salinan repo"). Bila satu tab tidak ditemukan, dashboard memakai salinan di `data/sheets/`.

Menu **Isi ulang satu tab dari repo** menimpa satu tab dengan isi awal dari repo, berguna bila sebuah tab rusak atau ada kolom baru.

### Isian yang diterima

| Tab | Kolom | Nilai |
|---|---|---|
| `tugas` | `status` | Belum mulai · Dikerjakan · Review pembimbing · Selesai |
| `tugas` | `tahap` | 0 (persiapan & survei) · 1 (analisis 6 aspek) · 2 (AHP-WLC) · 3 (konflik & mismatch) · 4 (SWOT & laporan) |
| `tugas` | `terhambat` | ya / kosong |
| `kebutuhan_data` | `kondisi` | Belum ada · Sudah diminta · Ada sebagian · Ada lengkap · Tidak tersedia |
| `survei_foto` | `kategori` | Cagar Budaya · Sempadan Alam · Rawan Bencana · Permukiman Kumuh & KDB · Alih Fungsi KP2B · Sarana · Prasarana · Ekonomi & UMKM · Lainnya |

Tanggal ditulis `YYYY-MM-DD` atau `DD/MM/YYYY`.

## 3. Mengisi kalkulator analisis

Setiap kalkulator di folder `analisis/` membaca satu atau beberapa tab Sheets, menghitung dengan rumus di `assets/js/`, lalu menampilkan tabel hasil (bisa diunduh CSV) dan grafik. Angka juga bisa diubah langsung di halaman untuk mencoba saat diskusi, tetapi perubahan itu tidak tersimpan.

Semua tab di bawah dibuat otomatis oleh Apps Script (langkah 2). Daftar tab dan kalkulator yang memakainya:

| Tab | Diisi bidang | Dipakai kalkulator |
|---|---|---|
| `kelurahan` | Administrasi | luas sudah terisi dari batas AOI; isi jumlah lingkungan dan luas lahan permukiman |
| `parameter` | Koordinator | semua standar dan asumsi (SNI, template dosen) |
| `penduduk_seri` | Sosbud & Kependudukan | proyeksi, kepadatan, kebutuhan rumah, sarana, prasarana, DDDTL |
| `penduduk_struktur` | Sosbud & Kependudukan | struktur penduduk (tingkat kecamatan) |
| `standar_sarana`, `sarana_eksisting` | Sarana & Prasarana | sarana, sentralitas |
| `rth` | Sarana & Prasarana | RTH 20% |
| `ekonomi_sektor`, `ekonomi_meta` | Ekonomi & Permukiman | LQ, shift share |
| `lahan`, `lahan_meta` | Fisik & Lingkungan | perubahan lahan |
| `skl` | Fisik & Lingkungan | SKL |
| `bencana` | Kebencanaan | keterpaparan bencana |
| `cagar_budaya` | Sosbud & Kependudukan | kondisi cagar budaya |
| `stakeholder`, `anggaran` | Administrasi & Kebijakan | stakeholder, efektivitas anggaran |
| `ahp_responden`, `wlc_layer`, `zonasi_wlc` | Kebencanaan + Koordinator | AHP, WLC |
| `mismatch` | Administrasi & Kebijakan + Fisik | konflik & mismatch |
| `swot` | Koordinator | IFAS/EFAS & SWOT |

Penulisan angka: pakai koma untuk desimal (`0,006`) atau titik tanpa pemisah ribuan (`0.006`). Titik diikuti tepat tiga angka, seperti `1.250`, dibaca sebagai seribu dua ratus lima puluh. Kolom judul (baris pertama) dan nama kelurahan jangan diubah.

## 4. Menambah foto survei

Cara otomatis:

1. Unggah foto asli (JPG) ke folder `survei/unggah/` lewat **Add file → Upload files** di GitHub.
2. GitHub Actions ("Proses foto survei") memperkecil foto, membaca koordinatnya, menentukan kelurahan dari batas AOI, memperbarui `data/survei/survei_foto.csv`, lalu menghapus foto asli dari folder unggah.
3. Tambahkan baris foto baru di tab `survei_foto` (kolom `nama_file` sama persis dengan nama file) lalu isi kategori dan keterangannya.

Cara manual di komputer sendiri:

```bash
pip install pillow
python scripts/proses_foto.py <folder_foto_asli>
```

Koordinat dibaca dari tag GPS EXIF atau dari deskripsi EXIF aplikasi TM3. Foto GPS Map Camera yang koordinatnya hanya ada di cap foto diberi catatan "Isi koordinat dari cap foto"; isi `lat` dan `lon` manual di `data/survei/survei_foto.csv`. Unggah foto dari file aslinya (bukan dari WhatsApp atau chat), karena aplikasi chat menghapus data EXIF.

Foto asli resolusi penuh tetap disimpan di Google Drive; repo hanya menyimpan versi 1600 px dan thumbnail 400 px.

## 5. Struktur repo

```
index.html, jadwal.html, tugas.html, kebutuhan-data.html, peta-survei.html
analisis/                 21 halaman kalkulator
assets/css, assets/js     tampilan dan skrip bersama
data/config.json          URL Google Sheets, tanggal presentasi, kategori survei
data/sheets/              salinan awal tiap tab Sheets (cadangan)
data/survei/              data teknis foto (koordinat, kelurahan)
data/geo/                 batas Kecamatan Ampenan dan 10 kelurahan (BIG, 2022)
survei/foto, survei/thumb foto survei terkompresi
survei/unggah/            tempat unggah foto asli untuk diproses otomatis
scripts/proses_foto.py    pemroses foto
```

Catatan wilayah: batas resmi memakai file AOI (sekitar 919 ha) dengan 10 kelurahan: Ampenan Selatan, Ampenan Tengah, Ampenan Utara, Banjar, Bintaro, Dayan Peken, Kebun Sari, Pejarakan Karya, Pejeruk, dan Taman Sari.
