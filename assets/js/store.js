/*
 * Data layer. Two modes:
 *  - "local":    demo mode, everything saved in this browser (localStorage)
 *  - "supabase": real database, used when supabaseUrl + supabaseAnonKey are set in config.js
 * Both expose the same async API so the pages do not care which one is used.
 */
(function () {
  const CFG = window.SITE_CONFIG || {};
  const useSupabase = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";

  /* ---------------- helpers ---------------- */
  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post";
  }

  function isoDate(d) {
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }

  const APPT_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

  function cleanAppointment(a, isPublic) {
    const out = {
      patient_name: String(a.patient_name || "").trim().slice(0, 120),
      phone: String(a.phone || "").trim().slice(0, 30),
      email: String(a.email || "").trim().slice(0, 160),
      age: a.age === "" || a.age == null ? null : Math.max(0, Math.min(130, parseInt(a.age, 10) || 0)),
      gender: String(a.gender || "").slice(0, 20),
      appt_date: String(a.appt_date || ""),
      appt_time: String(a.appt_time || ""),
      reason: String(a.reason || "").trim().slice(0, 1000),
      status: isPublic ? "pending" : (APPT_STATUSES.includes(a.status) ? a.status : "pending"),
      notes: isPublic ? "" : String(a.notes || "").slice(0, 2000)
    };
    if (!out.patient_name) throw new Error("Please enter the patient's name.");
    if (!/^[+\d][\d\s-]{6,}$/.test(out.phone)) throw new Error("Please enter a valid phone number.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(out.appt_date)) throw new Error("Please choose a date.");
    if (!out.appt_time) throw new Error("Please choose a time.");
    return out;
  }

  function cleanPost(p) {
    const title = String(p.title || "").trim().slice(0, 200);
    if (!title) throw new Error("Please add a title.");
    return {
      title,
      slug: slugify(p.slug || title),
      category: String(p.category || "General").trim().slice(0, 60) || "General",
      excerpt: String(p.excerpt || "").trim().slice(0, 400),
      cover_url: /^https?:\/\//i.test(p.cover_url || "") ? String(p.cover_url).trim() : "",
      content: String(p.content || ""),
      status: p.status === "published" ? "published" : "draft"
    };
  }

  /* ---------------- LOCAL (demo) backend ---------------- */
  const LS = {
    posts: "drsite.posts",
    appts: "drsite.appointments",
    session: "drsite.session"
  };
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { throw new Error("Could not save — browser storage is full or blocked."); }
  }

  function seedIfEmpty() {
    let seeded = false;
    try { seeded = localStorage.getItem("drsite.seeded") === "1"; } catch (e) { return; }
    if (seeded) return;
    const now = new Date();
    const day = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return isoDate(d); };
    const ts = new Date().toISOString();
    write(LS.posts, [
      {
        id: uid(), slug: "monsoon-fevers-when-to-see-a-doctor", title: "Monsoon fevers: when should you see a doctor?",
        category: "Infections", status: "published", cover_url: "",
        excerpt: "Dengue, malaria, typhoid or a simple viral fever? Warning signs that mean you should not wait at home.",
        content:
"Every monsoon, clinics fill up with patients who have fever. Most of these are **simple viral fevers** that settle in 3–5 days. But some need early tests and treatment.\n\n" +
"## See a doctor the same day if you have\n\n- Fever above 102°F that does not come down with paracetamol\n- Severe body ache, pain behind the eyes or a rash\n- Vomiting, unable to drink fluids, or passing very little urine\n- Bleeding from gums or nose, or black stools\n- Drowsiness or confusion\n\n" +
"## What you can do at home\n\n1. Drink plenty of fluids — ORS, coconut water, soups\n2. Take paracetamol for fever (avoid painkillers like ibuprofen unless your doctor says so)\n3. Rest and check temperature every 4–6 hours\n\n" +
"> Do not start antibiotics on your own. Most fevers are viral and antibiotics will not help.\n\nIf the fever lasts more than 3 days, book a visit so we can decide which tests are needed.",
        published_at: ts, created_at: ts, updated_at: ts
      },
      {
        id: uid(), slug: "understanding-your-blood-pressure-numbers", title: "Understanding your blood pressure numbers",
        category: "Heart health", status: "published", cover_url: "",
        excerpt: "What 120/80 really means, when BP is called high, and simple daily habits that bring it down.",
        content:
"Blood pressure is written as two numbers, for example **120/80 mmHg**.\n\n- The top number (*systolic*) is the pressure when the heart beats\n- The bottom number (*diastolic*) is the pressure when the heart rests\n\n" +
"## What is normal?\n\nBelow 120/80 is ideal. Readings of **140/90 or more** on repeated checks mean high blood pressure (hypertension).\n\n" +
"## Small changes that help\n\n- Cut down salt — avoid pickles, papad and packaged snacks\n- Walk briskly for 30 minutes, 5 days a week\n- Sleep 7–8 hours\n- Stop smoking and limit alcohol\n\nHigh BP usually has **no symptoms**, so check it at least once a year after age 30.",
        published_at: ts, created_at: ts, updated_at: ts
      },
      {
        id: uid(), slug: "draft-healthy-diet-for-diabetes", title: "A simple Indian diet plan for diabetes",
        category: "Diabetes", status: "draft", cover_url: "",
        excerpt: "Practical swaps for everyday Indian meals.", content: "Write your post here…",
        published_at: null, created_at: ts, updated_at: ts
      }
    ]);
    const mk = (n, d, t, reason, status, phone) => ({
      id: uid(), patient_name: n, phone: phone, email: "", age: 20 + Math.floor(Math.random() * 45), gender: "",
      appt_date: d, appt_time: t, reason, status, notes: "", created_at: ts
    });
    write(LS.appts, [
      mk("Rahul Sharma", day(0), "10:30", "Fever and body ache for 2 days", "confirmed", "98200 11223"),
      mk("Priya Nair", day(0), "11:00", "BP follow-up", "pending", "98330 44556"),
      mk("Anil Kumar", day(0), "17:30", "Diabetes review, reports ready", "confirmed", "99870 77889"),
      mk("Sneha Patil", day(1), "10:00", "Cough and cold", "pending", "90040 12121"),
      mk("Mohammed Irfan", day(2), "18:00", "Health check-up", "pending", "93222 34343"),
      mk("Kavita Joshi", day(-1), "12:00", "Skin rash", "completed", "98190 56565"),
      mk("Suresh Reddy", day(-2), "19:00", "Stomach pain", "cancelled", "97690 78787")
    ]);
    try { localStorage.setItem("drsite.seeded", "1"); } catch (e) { /* ignore */ }
  }

  const local = {
    mode: "local",
    async init() { seedIfEmpty(); },

    async listPosts({ publishedOnly = false } = {}) {
      let rows = read(LS.posts);
      if (publishedOnly) rows = rows.filter((p) => p.status === "published");
      return rows.sort((a, b) => (b.published_at || b.updated_at || "").localeCompare(a.published_at || a.updated_at || ""));
    },
    async getPost(slug) {
      return read(LS.posts).find((p) => p.slug === slug || p.id === slug) || null;
    },
    async savePost(p) {
      const rows = read(LS.posts);
      const data = cleanPost(p);
      const ts = new Date().toISOString();
      // keep slugs unique
      let base = data.slug, n = 2;
      while (rows.some((r) => r.slug === data.slug && r.id !== p.id)) data.slug = `${base}-${n++}`;
      const i = rows.findIndex((r) => r.id === p.id);
      if (i >= 0) {
        const prev = rows[i];
        rows[i] = { ...prev, ...data, updated_at: ts,
          published_at: data.status === "published" ? (prev.published_at || ts) : prev.published_at };
        write(LS.posts, rows);
        return rows[i];
      }
      const row = { id: uid(), ...data, created_at: ts, updated_at: ts, published_at: data.status === "published" ? ts : null };
      rows.push(row);
      write(LS.posts, rows);
      return row;
    },
    async deletePost(id) { write(LS.posts, read(LS.posts).filter((p) => p.id !== id)); },

    async listAppointments() {
      return read(LS.appts).sort((a, b) => (a.appt_date + a.appt_time).localeCompare(b.appt_date + b.appt_time));
    },
    async bookAppointment(a) {
      const row = { id: uid(), ...cleanAppointment(a, true), created_at: new Date().toISOString() };
      const rows = read(LS.appts); rows.push(row); write(LS.appts, rows);
      return true;
    },
    async saveAppointment(a) {
      const rows = read(LS.appts);
      const data = cleanAppointment(a, false);
      const i = rows.findIndex((r) => r.id === a.id);
      if (i >= 0) rows[i] = { ...rows[i], ...data };
      else rows.push({ id: uid(), ...data, created_at: new Date().toISOString() });
      write(LS.appts, rows);
    },
    async setAppointmentStatus(id, status) {
      if (!APPT_STATUSES.includes(status)) return;
      const rows = read(LS.appts);
      const r = rows.find((x) => x.id === id);
      if (r) { r.status = status; write(LS.appts, rows); }
    },
    async deleteAppointment(id) { write(LS.appts, read(LS.appts).filter((a) => a.id !== id)); },

    // Demo "login": a PIN from config.js. Not real security — use Supabase for that.
    async signIn(_email, pin) {
      if (String(pin) !== String(CFG.demoPin || "1234")) throw new Error("Wrong PIN.");
      try { sessionStorage.setItem(LS.session, "1"); } catch (e) { /* ignore */ }
      return true;
    },
    async signOut() { try { sessionStorage.removeItem(LS.session); } catch (e) { /* ignore */ } },
    async isSignedIn() { try { return sessionStorage.getItem(LS.session) === "1"; } catch (e) { return false; } },

    async exportAll() { return { posts: read(LS.posts), appointments: read(LS.appts) }; },
    async importAll(data) {
      if (!data || !Array.isArray(data.posts) || !Array.isArray(data.appointments)) throw new Error("This is not a valid backup file.");
      write(LS.posts, data.posts); write(LS.appts, data.appointments);
    }
  };

  /* ---------------- SUPABASE backend ---------------- */
  let sb = null;
  function check({ data, error }) { if (error) throw new Error(error.message); return data; }

  const remote = {
    mode: "supabase",
    async init() {
      if (!window.supabase) await loadScript(SUPABASE_JS);
      sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    },
    async listPosts({ publishedOnly = false } = {}) {
      let q = sb.from("posts").select("*");
      if (publishedOnly) q = q.eq("status", "published");
      const rows = check(await q);
      return rows.sort((a, b) => (b.published_at || b.updated_at || "").localeCompare(a.published_at || a.updated_at || ""));
    },
    async getPost(slug) {
      const rows = check(await sb.from("posts").select("*").eq("slug", slug).limit(1));
      return rows[0] || null;
    },
    async savePost(p) {
      const data = cleanPost(p);
      const ts = new Date().toISOString();
      const existing = check(await sb.from("posts").select("id").eq("slug", data.slug));
      if (existing.some((r) => r.id !== p.id)) data.slug = `${data.slug}-${Date.now().toString(36).slice(-4)}`;
      if (p.id) {
        const prev = check(await sb.from("posts").select("published_at").eq("id", p.id).single());
        data.published_at = data.status === "published" ? (prev.published_at || ts) : prev.published_at;
        data.updated_at = ts;
        return check(await sb.from("posts").update(data).eq("id", p.id).select().single());
      }
      data.published_at = data.status === "published" ? ts : null;
      return check(await sb.from("posts").insert(data).select().single());
    },
    async deletePost(id) { check(await sb.from("posts").delete().eq("id", id)); },

    async listAppointments() {
      return check(await sb.from("appointments").select("*")
        .order("appt_date", { ascending: true }).order("appt_time", { ascending: true }));
    },
    async bookAppointment(a) {
      // Patients can only insert — they can never read other appointments (see supabase/schema.sql).
      check(await sb.from("appointments").insert(cleanAppointment(a, true)));
      return true;
    },
    async saveAppointment(a) {
      const data = cleanAppointment(a, false);
      if (a.id) check(await sb.from("appointments").update(data).eq("id", a.id));
      else check(await sb.from("appointments").insert(data));
    },
    async setAppointmentStatus(id, status) {
      if (!APPT_STATUSES.includes(status)) return;
      check(await sb.from("appointments").update({ status }).eq("id", id));
    },
    async deleteAppointment(id) { check(await sb.from("appointments").delete().eq("id", id)); },

    async signIn(email, password) {
      check(await sb.auth.signInWithPassword({ email, password }));
      return true;
    },
    async signOut() { await sb.auth.signOut(); },
    async isSignedIn() {
      const { data } = await sb.auth.getSession();
      return !!(data && data.session);
    },
    async exportAll() {
      return { posts: await this.listPosts(), appointments: await this.listAppointments() };
    },
    async importAll() { throw new Error("Import is only available in demo mode. Use the Supabase dashboard to restore data."); }
  };

  window.Store = useSupabase ? remote : local;
  window.Store.slugify = slugify;
  window.Store.isoDate = isoDate;
  window.Store.STATUSES = APPT_STATUSES;
})();
