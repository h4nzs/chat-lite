# Analisis Keamanan Sistem Enkripsi Chat-Lite

**Pendapat Umum:**
Sistem enkripsi kita sekarang **jauh lebih aman** daripada sebelumnya, tetapi belum bisa disebut "sempurna". Kita telah membangun fondasi yang sangat kuat, namun ada beberapa area penting yang bisa dan seharusnya kita tingkatkan untuk mencapai tingkat keamanan seperti aplikasi chat terkemuka (misalnya Signal).

### Kekuatan Sistem Saat Ini (Yang Sudah Kita Lakukan Dengan Benar)

1.  **Enkripsi End-to-End (E2EE) Fundamental:** Kita sudah menerapkan prinsip inti E2EE. Pesan dienkripsi di perangkat Anda dan hanya bisa didekripsi oleh perangkat penerima. Server tidak bisa membaca isi pesan.
2.  **Kunci Identitas Pengguna:** Setiap pengguna sekarang memiliki pasangan kunci publik/privat yang unik, yang merupakan dasar dari identitas digital yang aman.
3.  **Kunci Sesi per Percakapan:** Setiap percakapan memiliki kunci enkripsi acak yang terpisah. Ini adalah praktik yang baik, karena jika satu kunci percakapan bocor, percakapan Anda yang lain tetap aman.
4.  **Manajemen Kunci Sisi Klien:** Kunci privat Anda dienkripsi menggunakan password Anda dan disimpan di browser. Ini jauh lebih baik daripada menyimpannya dalam bentuk teks biasa.

### Kelemahan dan Area Peningkatan (Di Mana Kita Bisa Lebih Baik)

Meskipun fondasinya kuat, ada beberapa celah keamanan yang perlu dipertimbangkan:

1.  **(Kritis) Backup Kunci yang Tidak Aman:** Fitur "Backup Key" saat ini hanya mengunduh kunci privat dalam bentuk teks biasa. Jika file backup tersebut dicuri, seluruh keamanan akun Anda hancur. Ini adalah celah yang paling mendesak untuk diperbaiki.
2.  **(Tinggi) Tidak Ada Verifikasi Kontak (Trust on First Use):** Saat Anda memulai chat dengan seseorang, Anda secara otomatis "mempercayai" kunci publik yang diberikan oleh server. Anda tidak punya cara untuk memverifikasi apakah kunci tersebut benar-benar milik teman Anda, atau milik penyerang *man-in-the-middle*.
3.  **(Tinggi) Kurangnya *Forward Secrecy* (Kerahasiaan Masa Depan):** Kita menggunakan satu kunci sesi untuk seluruh riwayat percakapan. Jika kunci sesi ini suatu saat bocor, penyerang bisa mendekripsi **semua pesan di masa lalu** dalam percakapan tersebut.
4.  **(Sedang) Penanganan Anggota Grup:** Saat anggota baru ditambahkan ke grup, mereka mendapatkan kunci sesi yang ada. Ini berarti mereka berpotensi bisa membaca pesan yang dikirim *sebelum* mereka bergabung. Sebaliknya, jika anggota dikeluarkan, mereka masih memegang kunci sesi dan bisa terus mengintip pesan baru.

### Saran dan Roadmap Peningkatan Keamanan

Berikut adalah langkah-langkah yang saya sarankan untuk membuat aplikasi ini benar-benar aman, diurutkan berdasarkan prioritas:

| Prioritas | Fitur | Deskripsi Teknis | Manfaat Keamanan |
| :--- | :--- | :--- | :--- |
| **1. Kritis** | **Backup & Restore via Recovery Phrase** | **Backup:** Saat diminta, aplikasi menampilkan "Frasa Pemulihan" (12-24 kata acak) yang digenerate dari kunci privat pengguna. **Restore:** Di halaman login, pengguna bisa memilih opsi "Restore", lalu memasukkan username, frasa pemulihan, dan password baru. Aplikasi akan meregenerasi kunci privat dari frasa, memverifikasinya ke server, lalu mengenkripsi kunci tersebut dengan password baru untuk disimpan di perangkat baru. | Menghilangkan risiko file backup kunci dicuri dan menyediakan alur pemulihan akun yang aman dan portabel. Ini adalah standar industri untuk dompet kripto dan aplikasi aman. |
| **2. Tinggi** | **Otentikasi Biometrik (WebAuthn)** | Alih-alih meminta password di setiap sesi, gunakan API WebAuthn untuk mengikat kunci privat utama ke biometrik (sidik jari/wajah) atau PIN perangkat. Saat perlu mendekripsi kunci, aplikasi akan memicu dialog sistem operasi untuk otentikasi, bukan meminta password. | **Kenyamanan Drastis:** Menghilangkan kebutuhan mengetik password berulang kali. **Keamanan Tinggi:** Mengikat keamanan akun ke perangkat keras, membuatnya jauh lebih sulit diserang daripada password saja. |
| **3. done** | **Verifikasi Kontak (Safety Numbers)** | Untuk setiap percakapan, kita tampilkan "Kode Keamanan" (serangkaian angka atau QR code) yang unik. Kode ini dibuat dari kombinasi kunci publik Anda dan teman chat Anda. Anda bisa membandingkan kode ini melalui telepon atau bertemu langsung untuk memastikan tidak ada penyadapan. | Memberikan jaminan bahwa Anda berbicara dengan orang yang benar, bukan dengan penyadap. |
| **3. done** | **Implementasi *Ratcheting* (Sesi Berputar)** | Alih-alih satu kunci sesi, kita gunakan algoritma (seperti Double Ratchet) untuk membuat kunci baru untuk **setiap pesan**. Atau, sebagai langkah awal yang lebih sederhana, kita bisa membuat kunci sesi baru setiap kali aplikasi dibuka atau setiap 24 jam. | Jika satu kunci pesan bocor, penyerang hanya bisa membaca pesan itu saja, bukan seluruh riwayat. Ini adalah inti dari *Forward Secrecy*. |
| **4. Sedang** | **Regenerasi Kunci Grup** | Setiap kali ada perubahan anggota grup (masuk, keluar, atau dikeluarkan), server harus secara otomatis membuat **kunci sesi yang benar-benar baru** dan mendistribusikannya hanya kepada anggota yang masih aktif. | Mencegah anggota baru membaca riwayat chat, dan mencegah anggota yang sudah keluar untuk terus membaca chat baru. |

**Kesimpulan:**

Sistem kita saat ini sudah merupakan lompatan besar dari kondisi awal. Namun, untuk bisa dengan percaya diri menyebutnya "aman", saya sangat merekomendasikan untuk mengikuti roadmap di atas, dimulai dengan memperbaiki fitur backup kunci.