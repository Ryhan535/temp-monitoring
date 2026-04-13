# Temperature & Humidity Monitoring System

Sistem monitoring suhu dan kelembaban real-time dengan Firebase.

## Fitur
- Dashboard monitoring real-time
- Detail grafik dengan opsi 1h, 24h, 7d
- Pengaturan threshold alert (High Alert & Critical otomatis +5)
- Notifikasi alert
- Pruning data otomatis setiap hari (via GitHub Actions)

## Teknologi
- HTML5, CSS3, JavaScript
- Firebase Realtime Database & Firestore
- Chart.js untuk visualisasi
- GitHub Actions untuk pruning otomatis

## Setup
1. Clone repository
2. Setup Firebase project
3. Tambahkan service account ke GitHub Secrets
4. Push ke GitHub

## Pruning Data
Data sensor otomatis dihapus setelah 7 hari melalui GitHub Actions setiap hari jam 02:00 UTC.