# Supabase setup and Week 1 seed

**One command:** `node scripts/setup-supabase-week1.js`

- If the **newsletter_state** table doesn’t exist yet, the script prints SQL. Run that SQL in **Supabase Dashboard → SQL Editor**, then run the script again.
- When the table exists, the script seeds **workspace** and **sessions** (including **"Week 1"**) with the exported articles and image URLs.

Content is stored under **Week 1** so the app can load it via **Load Saved → Week 1**.

Optional: run the seed only with `node scripts/seed-week1-to-supabase.js` (table must already exist).

## State icons (purablis.com)

Upload all 50 US state icons from `bookbunnylibrary/state_icons_dark` to GoDaddy FTP:

`node scripts/upload-state-icons-dark.js`

Requires `GODADDY_FTP_*` and `GODADDY_PUBLIC_BASE_URL` in `.env`. Writes `data/state-icons-manifest.json` used by Image View search when a state name is typed.
