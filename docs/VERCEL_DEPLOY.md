# Deploying Newsletter Maker on Vercel

## What is the "Express app"?

Your app has **two parts**:

1. **Frontend** – The pages you see (Article Search, Article View, etc.). These are the HTML/JS/CSS files in `public/`.

2. **Backend (Express)** – A small Node.js server that:
   - Saves and loads your newsletter data (e.g. Week 1) from Supabase
   - Serves the `/api/state` and `/api/articles` endpoints
   - Runs from `server.js` in the project root

When you see **"Cannot reach server"**, it means the browser can load the frontend but the backend (`/api/state`) is not responding—usually because Vercel is only deploying the frontend and not running `server.js`.

## What we fixed in the repo

- **`vercel.json`** – Tells Vercel to run `server.js` as the server and to send all requests (including `/api/*`) to it. Without this, some Vercel project settings can result in only the `public/` folder being deployed.

## What to check in Vercel (Dashboard)

1. **Project → Settings → General**
   - **Framework Preset:** leave as **Other** (or **None**). Do **not** set it to something that builds only a static site (e.g. "Create React App" with output `build`).
   - **Build Command:** leave **empty** or use `npm run build` only if you add a build script. Do not set a command that builds to `public` and then use that as the only output.
   - **Output Directory:** leave **empty**. If this is set to **`public`**, Vercel will deploy only the static files and **will not run** `server.js`, so the API will not work.

2. **Project → Settings → Environment Variables**
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_SECRET_KEY` = your Supabase secret/service role key

3. **Redeploy**
   - After changing settings or adding `vercel.json`, trigger a new deployment (e.g. **Deployments → … → Redeploy** or push a commit).

After a successful deploy, open the app, go to **Article View**, and click **Refresh from server**. Week 1 should load if the env vars are set and the data is in Supabase.
