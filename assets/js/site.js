/* Public website: fills in config details, shows blog posts, handles the booking form. */
(function () {
  const CFG = window.SITE_CONFIG || {};
  const { esc, fmtDate, fmtTime, markdown, readingTime } = window.U;
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- Fill in text from config.js ---------- */
  document.querySelectorAll("[data-cfg]").forEach((el) => { el.textContent = CFG[el.dataset.cfg] || ""; });
  document.querySelectorAll("[data-cfg-mail]").forEach((el) => {
    const v = CFG[el.dataset.cfgMail] || ""; el.textContent = v; el.href = "mailto:" + v;
  });
  const yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();
  const ini = $("#initials");
  if (ini) ini.textContent = (CFG.doctorName || "Dr").replace(/^Dr\.?\s*/i, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (CFG.mapLink && /^https?:\/\//.test(CFG.mapLink)) { $("#map-link").href = CFG.mapLink; $("#map-link-wrap").hidden = false; }
  if (document.title === "Doctor | Book an appointment") document.title = `${CFG.doctorName}, ${CFG.qualification} | Book an appointment`;

  /* ---------- Header: theme + mobile menu ---------- */
  function setThemeIcon() {
    document.querySelectorAll(".theme-toggle").forEach((b) => { b.innerHTML = window.icon(U.currentTheme() === "dark" ? "sun" : "moon"); });
  }
  window.hydrateIcons();
  setThemeIcon();
  document.querySelectorAll(".theme-toggle").forEach((b) => b.addEventListener("click", () => { U.toggleTheme(); setThemeIcon(); }));
  const menuBtn = $(".menu-btn"), nav = $("#nav");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open);
      menuBtn.innerHTML = window.icon(open ? "x" : "menu");
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); menuBtn.innerHTML = window.icon("menu");
    }));
  }

  /* ---------- Services ---------- */
  const svcIcons = ["stethoscope", "activity", "shield", "thermometer", "syringe", "apple"];
  const svc = $("#services-list");
  if (svc) {
    svc.innerHTML = (CFG.services || []).map((s, i) => `
      <div class="card"><div class="svc-icon">${icon(svcIcons[i % svcIcons.length], 20)}</div>
      <h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join("");
  }

  /* ---------- Blog cards ---------- */
  function postCard(p) {
    const cover = p.cover_url
      ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">`
      : icon("file", 36);
    return `<a class="card post-card" href="blog.html?post=${encodeURIComponent(p.slug)}">
      <div class="post-cover">${cover}</div>
      <div class="post-body">
        <div class="post-meta"><span class="tag">${esc(p.category)}</span><span>${fmtDate(p.published_at)}</span><span>· ${readingTime(p.content)} min read</span></div>
        <h3>${esc(p.title)}</h3>
        <p class="muted" style="margin:0">${esc(p.excerpt)}</p>
      </div></a>`;
  }

  function showError(el, err) {
    el.innerHTML = `<div class="notice err">${icon("alert")}<span>Could not load articles. ${esc(err.message || "")}</span></div>`;
  }

  async function initHome() {
    const el = $("#latest-posts");
    if (!el) return;
    try {
      const posts = (await Store.listPosts({ publishedOnly: true })).slice(0, 3);
      el.innerHTML = posts.length ? posts.map(postCard).join("") : `<div class="empty" style="grid-column:1/-1">No articles yet. Check back soon.</div>`;
    } catch (e) { showError(el, e); }
  }

  async function initBlog() {
    const root = $("#blog-root");
    if (!root) return;
    const slug = new URLSearchParams(location.search).get("post");
    if (slug) return showPost(slug);

    const list = $("#all-posts"), filters = $("#cat-filters");
    let posts;
    try { posts = await Store.listPosts({ publishedOnly: true }); } catch (e) { return showError(list, e); }
    const cats = ["All", ...Array.from(new Set(posts.map((p) => p.category))).sort()];
    let cat = "All", q = "";
    filters.innerHTML = cats.map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === "All"}">${esc(c)}</button>`).join("") +
      `<input class="search" type="search" placeholder="Search articles" aria-label="Search articles">`;
    function render() {
      const term = q.toLowerCase();
      const rows = posts.filter((p) => (cat === "All" || p.category === cat) &&
        (!term || (p.title + " " + p.excerpt + " " + p.content).toLowerCase().includes(term)));
      list.innerHTML = rows.length ? rows.map(postCard).join("") : `<div class="empty" style="grid-column:1/-1">No articles found.</div>`;
    }
    filters.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]"); if (!b) return;
      cat = b.dataset.cat;
      filters.querySelectorAll("[data-cat]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    });
    filters.querySelector(".search").addEventListener("input", (e) => { q = e.target.value; render(); });
    render();
  }

  async function showPost(slug) {
    $("#list-view").hidden = true;
    const v = $("#post-view"); v.hidden = false;
    v.innerHTML = `<p class="muted">Loading…</p>`;
    let p;
    try { p = await Store.getPost(slug); } catch (e) { return showError(v, e); }
    if (!p || p.status !== "published") {
      v.innerHTML = `<h1>Article not found</h1><p><a href="blog.html">Back to all articles</a></p>`;
      return;
    }
    document.title = `${p.title} | ${CFG.doctorName}`;
    v.innerHTML = `
      <p><a href="blog.html" style="display:inline-flex;gap:6px;align-items:center;text-decoration:none">${icon("arrowLeft", 16)} All articles</a></p>
      <div class="post-meta" style="margin-bottom:12px"><span class="tag">${esc(p.category)}</span><span>${fmtDate(p.published_at)}</span><span>· ${readingTime(p.content)} min read</span></div>
      <h1>${esc(p.title)}</h1>
      <p class="muted" style="font-size:18px">By ${esc(CFG.doctorName)}, ${esc(CFG.qualification)}</p>
      ${p.cover_url ? `<img class="cover" src="${esc(p.cover_url)}" alt="">` : ""}
      <div class="prose">${markdown(p.content)}</div>
      <p class="disclaimer">This article is for general information only and is not a substitute for medical advice. Please consult a doctor about your own health.</p>
      <div class="card" style="margin-top:24px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between">
        <div><h3 style="margin:0">Have a health concern?</h3><p>Book a visit with ${esc(CFG.doctorName)}.</p></div>
        <a class="btn btn-primary" href="index.html#book">${icon("calendar")} Book appointment</a>
      </div>`;
  }

  /* ---------- Booking form ---------- */
  function initBooking() {
    const form = $("#book-form");
    if (!form) return;
    const dateIn = $("#b-date"), slotsEl = $("#b-slots"), msg = $("#b-msg"), btn = $("#b-submit");
    const today = new Date();
    const max = new Date(); max.setDate(max.getDate() + (CFG.maxDaysAhead || 30));
    dateIn.min = Store.isoDate(today);
    dateIn.max = Store.isoDate(max);
    const closed = CFG.closedDays || [];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    $("#b-date-help").textContent = closed.length ? `Clinic closed on ${closed.map((d) => dayNames[d]).join(", ")}.` : "";
    let chosen = "";

    function renderSlots() {
      chosen = "";
      const v = dateIn.value;
      if (!v) { slotsEl.innerHTML = `<span class="muted">Choose a date first.</span>`; return; }
      const [y, m, d] = v.split("-").map(Number);
      const day = new Date(y, m - 1, d);
      const daySlots = (CFG.slotsByDay && CFG.slotsByDay[day.getDay()]) || CFG.slots || [];
      if (closed.includes(day.getDay()) || !daySlots.length) { slotsEl.innerHTML = `<span class="muted">The clinic is closed on ${dayNames[day.getDay()]}s. Please choose another date.</span>`; return; }
      const isToday = v === Store.isoDate(new Date());
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      slotsEl.innerHTML = daySlots.map((s) => {
        const [h, mm] = s.split(":").map(Number);
        const past = isToday && h * 60 + mm <= nowMin + 30;
        return `<button type="button" class="slot" data-slot="${esc(s)}" aria-pressed="false" ${past ? "disabled" : ""}>${fmtTime(s)}</button>`;
      }).join("");
    }
    dateIn.addEventListener("change", renderSlots);
    slotsEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-slot]"); if (!b || b.disabled) return;
      chosen = b.dataset.slot;
      slotsEl.querySelectorAll("[data-slot]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.innerHTML = "";
      const data = Object.fromEntries(new FormData(form));
      data.appt_time = chosen;
      if (data.appt_date && (data.appt_date < dateIn.min || data.appt_date > dateIn.max)) {
        msg.innerHTML = `<div class="notice err">${icon("alert")}<span>Please choose a date between ${fmtDate(dateIn.min)} and ${fmtDate(dateIn.max)}.</span></div>`;
        return;
      }
      btn.disabled = true;
      try {
        await Store.bookAppointment(data);
        msg.innerHTML = `<div class="notice ok">${icon("checkCircle")}<span><b>Request received.</b> Your appointment for ${fmtDate(data.appt_date)} at ${fmtTime(chosen)} is pending. The clinic will call you on ${esc(data.phone)} to confirm.</span></div>`;
        form.reset(); renderSlots();
      } catch (err) {
        msg.innerHTML = `<div class="notice err">${icon("alert")}<span>${esc(err.message)}</span></div>`;
      } finally { btn.disabled = false; }
    });
  }

  Store.init()
    .then(() => { initHome(); initBlog(); initBooking(); })
    .catch((e) => {
      document.querySelectorAll("#latest-posts, #all-posts").forEach((el) => showError(el, e));
      initBooking();
    });
})();
