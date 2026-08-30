# Koleksi Dr. Pinguin Bokep, M.S.B.

Modern static video gallery with admin panel + GitHub auto-save.

## Structure

```
koleksi-dr-pinguin/
├── index.html          # Gallery utama
├── admin.html          # Admin panel (password protected)
├── css/styles.css
├── js/app.js           # Gallery logic
├── js/admin.js         # Admin + GitHub push
├── data/videos.json    # Semua data video
├── logo.png
├── vercel.json
└── README.md
```

## Admin

1. Buka `/admin.html`
2. Password: `Koleksi Dr. Pinguin Bokep, M.S.B`
3. Tab **Export / Import** → isi GitHub Token → **Simpan ke GitHub**

## Deploy

Import repo di Vercel → Framework: Other → Output: `.` → Deploy.

Matikan **Deployment Protection / Vercel Authentication** di Settings agar URL publik bisa diakses tanpa login.
