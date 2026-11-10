# Doctor's website: appointments and health blog

A simple website for an MBBS doctor:

- **Public website** (`index.html`): about you, your services, clinic timings, latest articles and an **online appointment booking** form.
- **Health blog** (`blog.html`): all published articles, with category filters and search.
- **Doctor's dashboard** (`admin.html`): see today's patients, confirm or cancel bookings, add walk-in appointments, keep private notes, and **write, preview and publish blog posts**.

There is no build step. Plain HTML, CSS and JavaScript, so it runs on any free static host.

## 1. Add your details

Open **`config.js`** and change your name, email, timings, time slots for each day (`slotsByDay`) and services. You don't need to touch anything else.

## 2. Try it (demo mode)

Out of the box the site runs in **demo mode**. Data is stored only in the browser you are using, and it comes with sample appointments and posts.

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. For the dashboard, open http://localhost:8000/admin.html and enter PIN **1234** (change `demoPin` in `config.js`).

> In demo mode, bookings a patient makes on *their* phone do **not** reach your dashboard. To get real bookings, follow step 3.

## 3. Go live with real bookings (free Supabase database)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql` and press **Run**.
3. Go to **Authentication → Users → Add user** and create your doctor login (email + password).
4. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up", so nobody else can create an account.
5. Go to **Project Settings → API**. Copy the **Project URL** and the **anon / publishable key** into `supabaseUrl` and `supabaseAnonKey` in `config.js`.

Security rules: patients can only *create* a pending booking and read *published* posts. Only you, when signed in, can see patient details, notes and drafts.

## 4. Put it online

Any static host works: **Vercel**, **Netlify** or **GitHub Pages**. Upload the folder as-is, with no build command and the output directory set to the project root.

## Writing blog posts

In the dashboard choose **Write a post**. Use the toolbar for headings, **bold**, lists, quotes and links. Click **Preview** to see how it will look, then **Save draft** or **Publish**. Never include patient names or identifiable details.

## Files

| File | What it is |
|---|---|
| `config.js` | Your details and settings |
| `index.html`, `blog.html` | Public website and blog |
| `admin.html` | Doctor's dashboard |
| `assets/js/store.js` | Saves data (demo mode or Supabase) |
| `assets/js/site.js`, `assets/js/admin.js` | Page logic |
| `supabase/schema.sql` | Database tables and security rules |
