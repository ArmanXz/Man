# Kalkulator Gaji & Keuangan

Aplikasi web pencatat gaji shift, lembur, dan pengeluaran, bertema neumorphism.
Data disimpan otomatis di **localStorage browser** (per perangkat/browser).

## Menjalankan di laptop (lokal)

Butuh [Node.js](https://nodejs.org) (versi 18 ke atas) sudah terpasang.

```bash
npm install
npm run dev
```

Buka alamat yang muncul di terminal (biasanya `http://localhost:5173`).

## Deploy online gratis (disarankan: Vercel)

1. Buat akun di [github.com](https://github.com) (jika belum punya).
2. Buat repository baru, lalu upload semua isi folder ini (bisa lewat GitHub Desktop atau `git push`).
3. Daftar/masuk ke [vercel.com](https://vercel.com) memakai akun GitHub.
4. Klik **Add New → Project**, pilih repository yang baru diupload.
5. Biarkan pengaturan default (Vercel otomatis mengenali project Vite), klik **Deploy**.
6. Setelah selesai, dapat URL publik seperti `nama-project.vercel.app` — online 24 jam tanpa perlu laptop menyala.

Cara yang sama juga berlaku untuk [netlify.com](https://netlify.com) (build command: `npm run build`, publish directory: `dist`).

## Catatan tentang data

- Data (minggu kerja, pengeluaran, dll) tersimpan di `localStorage` browser tempat kamu membuka web ini.
- Kalau buka dari HP dan laptop, datanya **tidak otomatis sinkron** (masing-masing browser punya penyimpanan sendiri).
- Kalau ganti browser/HP atau membersihkan data browser, data lama akan hilang — gunakan tombol **Ekspor Data (JSON)** di aplikasi untuk backup berkala.
