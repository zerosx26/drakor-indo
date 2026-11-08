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

Katalog memakai snapshot seluruh halaman katalog publik yang berhasil ditelusuri saat impor terakhir. Filter genre bekerja pada katalog kategori negara yang sedang dimuat. Filter film saat ini menggunakan DramaID. Tombol genre memakai daftar tetap dari seluruh genre pada snapshot 8 November 2026. Pemilihan genre menyaring data di browser, bukan mengambil halaman genre lain. Favorit disimpan pada perangkat dan tampilan favorit mengikuti katalog yang dimuat. Perubahan struktur HTML sumber atau kebijakan hotlink/embed bisa memerlukan pembaruan adapter.

Verifikasi awal: build dry-run dan smoke test dua sumber berhasil. Pemeriksaan visual browser dan playback menyeluruh belum terverifikasi karena relay preview gagal dan domain produksi belum diizinkan pada jaringan lingkungan pengujian.

## Drama unggulan

`GET /api/featured` membaca pilihan populer DramaID dan sidebar populer DramaQu pada detail judul pertama katalog. Daftar digabung bergantian, judul duplikat disatukan (DramaID diutamakan), dan dibatasi 10. Ini bukan peringkat gabungan berdasarkan skor penonton. Hasil boleh kurang dari 10 jika sumber tidak tersedia. Browser mengacak urutan sekali setiap refresh; filter katalog tidak memengaruhinya.

Slider mendukung swipe, tombol navigasi, indikator, dan autoplay 6 detik dengan tombol jeda. Autoplay berhenti sementara ketika hover mouse, fokus keyboard, sentuhan yang masih berlangsung, dialog detail terbuka, atau tab tidak aktif; ketukan mobile dan swipe memulai ulang timer 6 detik, serta nonaktif untuk prefers-reduced-motion. Jalankan `node scripts/featured-test.mjs` untuk uji penggabungan, kegagalan sumber, navigasi, dan timer. Pemeriksaan visual browser tetap terbatas jika relay preview tidak tersedia.

## Metadata detail

Genre dan negara hanya dibaca dari tag genre/breadcrumb detail DramaID serta chip genre/info negara pada detail DramaQu. Menu, footer, dan rekomendasi tidak digunakan sebagai metadata. Nama diterjemahkan untuk nilai umum, duplikat dibuang, dan metadata yang tidak tersedia ditampilkan sebagai “—”. Uji fixture: `node scripts/metadata-test.mjs`.

## Filter genre tetap

Frontend membaca seluruh halaman API snapshot untuk sumber/kategori yang dipilih. Setiap item memiliki `genres: string[]` yang dilengkapi saat impor. Adapter live lama tetap tersedia melalui `live=1` untuk diagnosis dan slider populer; mode metadata=full pada adapter live dibatasi 40 judul per respons.

Tombol genre memakai daftar tetap 62 genre ditambah Semua, diurutkan A–Z. Pergantian sumber, kategori, dan impor katalog tidak mengubah daftar tombol secara otomatis. Pergantian genre tidak mengambil katalog baru atau menghapus kategori negara. Pilihan tetap dipertahankan walaupun sumber/kategori tidak memiliki hasil; hasil kosong ditampilkan. Genre baru ditambahkan melalui pembaruan kode secara sengaja. Pencarian juga mencakup nama genre. Tidak ada genre rekaan untuk judul yang metadata-nya kosong. Daftar ini mencakup katalog yang dimuat, bukan seluruh arsip situs sumber. Uji dengan `node scripts/genres-test.mjs`.

## Impor seluruh katalog

Binding Workers KV `CATALOG` menyimpan snapshot katalog lengkap dari seluruh pagination kedua sumber, dibagi menjadi potongan 200 entri dengan manifest versi. Endpoint katalog default membaca snapshot ini; `live=1` tetap tersedia untuk diagnosis adapter sumber. Frontend memuat metadata indeks sumber/kategori yang dipilih, menampilkan 48 kartu per tahap, serta mencari dan menyaring seluruh indeks yang dimuat. Judul yang sama pada penyedia berbeda tetap menjadi entri masing-masing agar pilihan sumber dan favorit lama tetap berfungsi.

Jalankan `python scripts/import_catalog.py` untuk menelusuri pagination dan melengkapi metadata. Cache pengambilan berada di `../import-cache` (berlaku satu jam). Skrip menghentikan impor jika ada halaman katalog gagal; kegagalan detail tercatat dan memakai metadata kartu yang tersedia. Hasil `catalog.json` adalah data sementara yang diabaikan Git. Jalankan `node scripts/prepare_catalog.mjs` untuk memvalidasi data, membuat `catalog-manifest.json`, dan menyiapkan bulk KV di `../import-batches`.

Unggah seluruh batch chunk ke namespace KV yang dinyatakan pada konfigurasi, verifikasi jumlahnya, lalu tulis manifest terakhir agar penggantian snapshot tidak menampilkan data setengah jadi. Setelah itu terbitkan Worker dengan binding `CATALOG`. Pembaruan snapshot dilakukan dengan impor ulang; belum ada sinkronisasi terjadwal. Uji arsip dan tampilan bertahap: `node scripts/catalog-test.mjs`. Preview dan smoke test mengisi KV lokal dari catalog.json; data produksi tidak dipakai untuk pengujian tulis.

API snapshot katalog memakai `page` (mulai dari 1) dan mengembalikan `nextPage` atau null. Setiap respons membaca satu chunk KV, maksimum 500 entri, agar CPU dan payload per permintaan tetap terbatas. Frontend mengambil semua chunk sumber/kategori sebelum membentuk genre dan menyaring judul, sehingga pencarian mencakup keseluruhan snapshot; tampilan kartu tetap dibatasi 48 per tahap.
