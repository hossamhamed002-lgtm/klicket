<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1KQDSfLD4o50Oljio5Hd2_2Rm7hy9-6sp

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Supabase Setup (Transactions Persistence)

The app saves and loads uploaded transactions through `api/transactions.ts`.
To make data persistent for all users/devices, connect Supabase:

1. In Supabase, open SQL Editor and run:
   `supabase/schema.sql`
2. In Vercel project settings, add environment variables:
   `SUPABASE_URL` = your project URL (example: `https://xxxx.supabase.co`)
   `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key
   `SUPABASE_TRANSACTIONS_TABLE` = `transactions_snapshots` (optional, default already set)
3. Redeploy the project on Vercel.

After that, any Excel upload from the app will be stored in Supabase and shown to all users.
