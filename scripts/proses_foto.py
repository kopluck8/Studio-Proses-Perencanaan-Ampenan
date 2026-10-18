"""Proses foto survei: baca koordinat, buat versi kecil, perbarui data/survei/survei_foto.csv.

Pemakaian:
    python scripts/proses_foto.py <folder_foto_asli> [--hapus-asli]

Sumber koordinat (urutan prioritas):
1. Tag GPS standar di EXIF.
2. Deskripsi EXIF aplikasi TM3 (format "GTM3V2|id|waktu|lat|lon|alt|...").
3. Bila keduanya kosong, baris tetap dibuat dengan lat/lon kosong dan catatan
   "Isi koordinat dari cap foto"; isi manual di CSV atau tab SURVEI_FOTO.

Kelurahan ditentukan dari data/geo/batas_ampenan.geojson (bukan dari alamat di cap foto).
"""
import csv
import json
import math
import os
import sys

from PIL import ExifTags, Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "survei", "survei_foto.csv")
AOI_PATH = os.path.join(ROOT, "data", "geo", "batas_ampenan.geojson")
FOTO_DIR = os.path.join(ROOT, "survei", "foto")
THUMB_DIR = os.path.join(ROOT, "survei", "thumb")
UKURAN_FOTO = 1600
UKURAN_THUMB = 400

KOLOM = [
    "nama_file", "aplikasi", "waktu", "lat", "lon", "akurasi_m", "kelurahan",
    "kelurahan_cap", "sumber_koordinat", "alamat_cap", "catatan_cek",
]


def _rasional(v):
    try:
        x = float(v)
        return None if math.isnan(x) else x
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def koordinat_exif(exif):
    gps = {ExifTags.GPSTAGS.get(k, k): v for k, v in exif.get_ifd(0x8825).items()}
    hasil = []
    for tag, ref_tag in (("GPSLatitude", "GPSLatitudeRef"), ("GPSLongitude", "GPSLongitudeRef")):
        dms = gps.get(tag)
        if not dms or len(dms) != 3:
            return None
        bagian = [_rasional(x) for x in dms]
        if None in bagian:
            return None
        nilai = bagian[0] + bagian[1] / 60 + bagian[2] / 3600
        if gps.get(ref_tag) in ("S", "W"):
            nilai = -nilai
        hasil.append(nilai)
    if hasil == [0.0, 0.0]:
        return None
    return hasil


def koordinat_tm3(exif):
    desk = str(exif.get(270) or "")
    if not desk.startswith("GTM3"):
        return None
    bagian = desk.split("|")
    try:
        return [float(bagian[3]), float(bagian[4])]
    except (IndexError, ValueError):
        return None


def muat_aoi():
    with open(AOI_PATH, encoding="utf-8") as f:
        data = json.load(f)
    poligon = []
    for fitur in data["features"]:
        geo = fitur["geometry"]
        bagian = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
        nama = fitur["properties"].get("NAMOBJ", "").replace("Pajarakan", "Pejarakan")
        poligon.append((nama, bagian))
    return poligon


def di_dalam(x, y, cincin):
    dalam = False
    for i in range(len(cincin)):
        x1, y1 = cincin[i][:2]
        x2, y2 = cincin[i - 1][:2]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dalam = not dalam
    return dalam


def cari_kelurahan(lat, lon, aoi):
    for nama, bagian in aoi:
        for poly in bagian:
            if di_dalam(lon, lat, poly[0]) and not any(di_dalam(lon, lat, h) for h in poly[1:]):
                return nama
    return "(di luar Kec. Ampenan)"


def simpan_kecil(img, tujuan, ukuran, kualitas):
    salinan = img.copy()
    salinan.thumbnail((ukuran, ukuran))
    salinan.save(tujuan, "JPEG", quality=kualitas, optimize=True)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    sumber = sys.argv[1]
    hapus_asli = "--hapus-asli" in sys.argv
    os.makedirs(FOTO_DIR, exist_ok=True)
    os.makedirs(THUMB_DIR, exist_ok=True)

    baris = []
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, encoding="utf-8") as f:
            baris = list(csv.DictReader(f))
    indeks = {b["nama_file"]: b for b in baris}
    aoi = muat_aoi()

    baru = 0
    for akar, _, file in os.walk(sumber):
        for nama in sorted(file):
            if not nama.lower().endswith((".jpg", ".jpeg")):
                continue
            jalur = os.path.join(akar, nama)
            with Image.open(jalur) as asli:
                exif = asli.getexif()
                img = ImageOps.exif_transpose(asli).convert("RGB")
            simpan_kecil(img, os.path.join(FOTO_DIR, nama), UKURAN_FOTO, 80)
            simpan_kecil(img, os.path.join(THUMB_DIR, nama), UKURAN_THUMB, 75)

            data = indeks.get(nama)
            if data is None:
                data = {k: "" for k in KOLOM}
                data["nama_file"] = nama
                baris.append(data)
                indeks[nama] = data
                baru += 1
            if not data.get("lat"):
                koordinat, sumber_k = koordinat_exif(exif), "EXIF GPS"
                if koordinat is None:
                    koordinat, sumber_k = koordinat_tm3(exif), "EXIF (deskripsi TM3)"
                if koordinat:
                    data["lat"], data["lon"] = f"{koordinat[0]:.7f}", f"{koordinat[1]:.7f}"
                    data["sumber_koordinat"] = sumber_k
                else:
                    data["catatan_cek"] = "Isi koordinat dari cap foto"
            if not data.get("aplikasi"):
                data["aplikasi"] = ("TM3" if nama.startswith("GTM3") else
                                    "GPS Map Camera" if "GPSMap" in nama else "Kamera HP")
            if not data.get("waktu"):
                sub = exif.get_ifd(0x8769)
                waktu = sub.get(36867) or exif.get(306) or ""
                data["waktu"] = str(waktu).replace(":", "-", 2)[:16]
            if data.get("lat") and data.get("lon"):
                data["kelurahan"] = cari_kelurahan(float(data["lat"]), float(data["lon"]), aoi)
            if hapus_asli:
                os.remove(jalur)

    kolom = list(dict.fromkeys(KOLOM + [k for b in baris for k in b]))
    baris.sort(key=lambda b: b["nama_file"])
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=kolom, extrasaction="ignore")
        w.writeheader()
        w.writerows(baris)
    print(f"{len(baris)} foto di CSV, {baru} baru.")


if __name__ == "__main__":
    main()
