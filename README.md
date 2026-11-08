# Drakor Indo

Portal katalog drama dengan tampilan dari preview GitHub Pages, dihosting pada Cloudflare Workers.

Produksi: https://drakor.zerosarcade.com/

Alamat Workers alternatif: https://drakor-indo.m3dzero.workers.dev/

## Fitur

- Katalog dari DramaID dan DramaQu, pilihan sumber, pencarian judul, kategori, genre, dan urutan A–Z.
- Sinopsis, daftar episode, favorit pada browser, dan tata letak responsif.
- Pemutar video langsung DramaID atau embed DramaQu. Tautan referensi dan tombol menuju halaman sumber tidak ditampilkan.
- API hanya membaca halaman dari dua sumber yang diizinkan. Tidak mengunggah atau menyimpan video.

## Pengembangan

```sh
npm ci
npm run dev
npm run check
npm run smoke
```

`worker.js` mengimpor `index.html` sebagai modul teks. `app.js` adalah salinan skrip frontend untuk pengeditan; sinkronkan isinya ke blok script pada `index.html` setelah perubahan.

Server dev memakai Miniflare dan meneruskan permintaan HTML melalui curl agar menghormati proxy jaringan lingkungan pengembangan. Smoke test memakai implementasi Worker yang sama, mengambil katalog dan satu episode dari setiap sumber, lalu memeriksa penolakan URL di luar daftar sumber. Tes ini tidak membuktikan video selesai diputar pada browser.

## Deployment

Konfigurasi ada pada `wrangler.jsonc`, Worker `drakor-indo`, akun `04fc10e8368714bca1dd53f92ce3d661`. Gunakan koneksi Cloudflare yang berwenang atau `npx wrangler deploy` setelah autentikasi lokal. Jangan memasukkan token ke Git.

Deployment awal dilakukan melalui API Cloudflare. Belum ada deployment otomatis dari GitHub. GitHub Pages hanya menyajikan template statis lama; API katalog membutuhkan Cloudflare Worker.

## Batasan

Katalog menampilkan judul dari halaman katalog sumber, bukan seluruh arsip. Pilihan genre dan negara berlaku bergantian. Filter film dan Medis saat ini menggunakan DramaID. Nama tombol genre adalah daftar tetap; hasilnya diambil dari halaman genre sumber. Romansa DramaQu dipetakan ke kategori romantis. Favorit disimpan pada perangkat dan tampilan favorit mengikuti katalog yang dimuat. Perubahan struktur HTML sumber atau kebijakan hotlink/embed bisa memerlukan pembaruan adapter.

Verifikasi awal: build dry-run dan smoke test dua sumber berhasil. Pemeriksaan visual browser dan playback menyeluruh belum terverifikasi karena relay preview gagal dan domain produksi belum diizinkan pada jaringan lingkungan pengujian.

## Drama unggulan

`GET /api/featured` membaca pilihan populer DramaID dan sidebar populer DramaQu pada detail judul pertama katalog. Daftar digabung bergantian, judul duplikat disatukan (DramaID diutamakan), dan dibatasi 10. Ini bukan peringkat gabungan berdasarkan skor penonton. Hasil boleh kurang dari 10 jika sumber tidak tersedia. Browser mengacak urutan sekali setiap refresh; filter katalog tidak memengaruhinya.

Slider mendukung swipe, tombol navigasi, indikator, dan autoplay 6 detik dengan tombol jeda. Autoplay berhenti sementara ketika hover, fokus, sentuhan, dialog detail terbuka, atau tab tidak aktif, serta nonaktif untuk prefers-reduced-motion. Jalankan `node scripts/featured-test.mjs` untuk uji penggabungan, kegagalan sumber, navigasi, dan timer. Pemeriksaan visual browser tetap terbatas jika relay preview tidak tersedia.
