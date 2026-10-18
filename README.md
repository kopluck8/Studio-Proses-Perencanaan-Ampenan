# Dashboard Studio Proses Perencanaan · Kecamatan Ampenan

Dashboard progres dan hasil analisis Studio Proses Perencanaan (PWKL4205/STPL4213), Prodi PWK Universitas Terbuka, UPBJJ Mataram. Wilayah studi: Kecamatan Ampenan, Kota Mataram (10 kelurahan). Jadwal: 12 sesi Tuweb, 6 September – 22 November 2026.

Halaman:

| Halaman | Isi | Sumber data |
|---|---|---|
| Beranda (`index.html`) | Ringkasan sesi, tugas, data, foto survei | semua tab |
| Jadwal (`jadwal.html`) | 12 sesi dan milestone | tab `jadwal` |
| Tugas (`tugas.html`) | Tugas per bidang dan PJ | tab `tugas` |
| Kebutuhan Data (`kebutuhan-data.html`) | Daftar 49 data, kondisi, verifikasi Deo | tab `kebutuhan_data` |
| Peta Survei (`peta-survei.html`) | Titik foto survei lapangan dengan popup foto | `data/survei/survei_foto.csv` + tab `survei_foto` |
| Analisis (`analisis/`) | Kalkulator analisis 6 aspek dan tahap 2–4 | tab input per kalkulator |

Situs ini statis (HTML, CSS, JavaScript tanpa proses build) dan dijalankan oleh GitHub Pages.

## 1. Mengaktifkan GitHub Pages

1. Buka **Settings → Pages** di repo.
2. Pada **Build and deployment**, pilih **Deploy from a branch**, cabang `main`, folder `/ (root)`, lalu **Save**.
3. Setelah satu-dua menit situs tampil di `https://kopluck8.github.io/Studio-Proses-Perencanaan-Ampenan/`.

## 2. Menghubungkan Google Sheets

Data progres diisi seluruh tim di satu Google Sheets. Dashboard membaca tiap tab sebagai CSV.

1. Buat Google Sheets baru, lalu buat tab dengan nama persis: `jadwal`, `tugas`, `kebutuhan_data`, `survei_foto`.
2. Isi tiap tab dengan mengimpor file awal dari folder `data/sheets/` (**File → Impor → Unggah → Ganti sheet saat ini**). Baris pertama (judul kolom) jangan diubah.
3. **File → Bagikan → Publikasikan ke web**. Pilih satu tab, format **Nilai yang dipisahkan koma (.csv)**, lalu **Publikasikan**. Salin URL-nya. Ulangi untuk setiap tab.
4. Tempel tiap URL di `data/config.json` pada bagian `google_sheets`, misalnya:
   ```json
   "google_sheets": {
     "jadwal": "https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv",
     "tugas": "https://docs.google.com/spreadsheets/d/e/.../pub?gid=123&single=true&output=csv",
     ...
   }
   ```
5. Selesai. Perubahan di Sheets muncul di dashboard dalam beberapa menit (Google menyegarkan CSV terbitan sekitar tiap 5 menit). Bila URL dikosongkan, dashboard memakai salinan lokal di `data/sheets/`.

### Mengunci kolom ceklis supaya hanya Deo yang bisa mencentang

1. Di tab `kebutuhan_data`, blok kolom `ceklis_deo` dan `tanggal_ceklis`.
2. **Data → Lindungi sheet dan rentang → Tambahkan sheet atau rentang**, beri nama "Ceklis Deo".
3. **Setel izin → Batasi siapa yang dapat mengedit rentang ini → Khusus Anda**, lalu **Selesai**.
4. Supaya mudah dicentang, blok kolom `ceklis_deo` lalu **Sisipkan → Kotak centang**. Dashboard menganggap TRUE, ya, 1, ✓, v, atau x sebagai sudah diverifikasi.

Anggota tim tetap bisa mengubah kolom lain (misalnya `kondisi` dan `catatan_kondisi`), tetapi tidak bisa mencentang verifikasi.

### Isian yang diterima

| Tab | Kolom | Nilai |
|---|---|---|
| `tugas` | `status` | Belum mulai · Dikerjakan · Review pembimbing · Selesai |
| `tugas` | `tahap` | 0 (persiapan & survei) · 1 (analisis 6 aspek) · 2 (AHP-WLC) · 3 (konflik & mismatch) · 4 (SWOT & laporan) |
| `tugas` | `terhambat` | ya / kosong |
| `kebutuhan_data` | `kondisi` | Belum ada · Sudah diminta · Ada sebagian · Ada lengkap · Tidak tersedia |
| `survei_foto` | `kategori` | Cagar Budaya · Sempadan Alam · Rawan Bencana · Permukiman Kumuh & KDB · Alih Fungsi KP2B · Sarana · Prasarana · Ekonomi & UMKM · Lainnya |

Tanggal ditulis `YYYY-MM-DD` atau `DD/MM/YYYY`.

## 3. Menambah foto survei

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

## 4. Struktur repo

```
index.html, jadwal.html, tugas.html, kebutuhan-data.html, peta-survei.html
analisis/                 halaman kalkulator
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
