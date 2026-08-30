# Pindah koleksidrpinguin.com ke Cloudflare Pages

Bot Telegram tetap di .site (Vercel) dulu. .com cukup static + functions cadangan.

## Langkah di dashboard Cloudflare
1. Workers & Pages → Create → Pages → Connect to Git
2. Repo: fashfdhgacd/koleksi-dr-pinguin
3. Production branch: main
4. Build command: (kosong)
5. Output directory: /
6. Environment variables (Production):
   BOT_TOKEN, GH_TOKEN, GH_OWNER, GH_REPO, GH_REPO_2, TELEGRAM_USER_ID
7. Save + Deploy
8. Custom domains → add koleksidrpinguin.com + www
9. Di registrar/Vercel, nameserver atau CNAME ke Pages sesuai instruksi CF
10. Jangan hapus project Vercel sebelum domain di CF sudah hijau (Active)

Webhook bot JANGAN dipindah dulu (masih .site).
