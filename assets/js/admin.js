/* Doctor's dashboard: appointments + blog. */
(function () {
  const CFG = window.SITE_CONFIG || {};
  const { esc, fmtDate, fmtTime, fmtNum, weekdayName, markdown } = window.U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const today = () => Store.isoDate(new Date());
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return Store.isoDate(d); };

  const STATUS = {
    pending: { label: "Pending", icon: "clock" },
    confirmed: { label: "Confirmed", icon: "checkCircle" },
    completed: { label: "Completed", icon: "check" },
    cancelled: { label: "Cancelled", icon: "xCircle" },
    published: { label: "Published", icon: "checkCircle" },
    draft: { label: "Draft", icon: "pen" }
  };
  const pill = (s) => `<span class="pill ${s}">${icon(STATUS[s].icon, 13)}${STATUS[s].label}</span>`;

  const PERIODS = [
    ["today", "Today"], ["week", "Next 7 days"], ["month", "This month"], ["past", "Past"], ["all", "All dates"]
  ];
  const PAGES = {
    overview: { section: "Clinic", title: "Overview" },
    appointments: { section: "Clinic", title: "Appointments" },
    posts: { section: "Blog", title: "All posts" },
    editor: { section: "Blog", title: "Write a post" }
  };

  // Every visit starts on the first page with default filters (nothing is remembered).
  const state = {
    page: "overview",
    period: "week",
    status: "all",
    search: "",
    postFilter: "all",
    appts: [],
    posts: [],
    edit: null,      // post being edited
    dirty: false,
    tab: "write"
  };

  /* ---------- small UI helpers ---------- */
  function toast(text, kind = "ok") {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `${icon(kind === "ok" ? "checkCircle" : "alert", 16)}<span>${esc(text)}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }
  function msgHtml(kind, text) {
    return `<div class="msg ${kind}">${icon(kind === "ok" ? "checkCircle" : "alert", 16)}<span>${esc(text)}</span></div>`;
  }
  function confirmBox(title, text, yesLabel = "Yes", danger = false) {
    return new Promise((resolve) => {
      const d = $("#confirm-dlg");
      $("#confirm-title").textContent = title;
      $("#confirm-text").textContent = text;
      const yes = $("#confirm-yes"), no = $("#confirm-no");
      yes.textContent = yesLabel;
      yes.className = danger ? "btn btn-danger" : "btn btn-primary";
      const done = (v) => { d.close(); yes.onclick = no.onclick = null; resolve(v); };
      yes.onclick = () => done(true);
      no.onclick = () => done(false);
      d.oncancel = () => done(false);
      d.showModal();
    });
  }
  function hydrate(root = document) {
    $$("[data-i]", root).forEach((el) => { el.outerHTML = icon(el.dataset.i); });
  }
  function phoneLinks(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    const wa = digits.length === 10 ? "91" + digits : digits;
    return `<a href="tel:${esc(String(phone || "").replace(/[^\d+]/g, ""))}">${esc(phone)}</a>` +
      (digits.length >= 10 ? ` · <a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : "");
  }

  /* ---------- data ---------- */
  async function loadData() {
    const [appts, posts] = await Promise.all([Store.listAppointments(), Store.listPosts()]);
    state.appts = appts; state.posts = posts;
    updateBadges();
  }
  function updateBadges() {
    const pending = state.appts.filter((a) => a.status === "pending" && a.appt_date >= today()).length;
    const b = $("#badge-appts");
    b.textContent = fmtNum(pending);
    b.classList.toggle("alert", pending > 0);
    b.title = pending ? `${pending} request(s) waiting for your confirmation` : "No pending requests";
    $("#badge-posts").textContent = fmtNum(state.posts.length);
  }

  function inPeriod(a, period) {
    const t = today();
    if (period === "today") return a.appt_date === t;
    if (period === "week") return a.appt_date >= t && a.appt_date <= addDays(6);
    if (period === "month") return a.appt_date.slice(0, 7) === t.slice(0, 7);
    if (period === "past") return a.appt_date < t;
    return true;
  }

  /* ---------- navigation ---------- */
  async function go(page, opts = {}) {
    if (state.dirty) {
      const ok = await confirmBox("Leave without saving?", "Your changes to this post have not been saved.", "Leave page", true);
      if (!ok) return;
      state.dirty = false;
    }
    state.page = page;
    if (page === "editor") {
      state.edit = opts.post ? { ...opts.post } : { title: "", category: "", excerpt: "", cover_url: "", content: "", status: "draft" };
      state.dirty = false; state.tab = "write";
    }
    $$(".side-link[data-page]").forEach((b) => {
      const on = b.dataset.page === page;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    const meta = PAGES[page];
    $("#page-section").textContent = meta.section;
    $("#page-title").textContent = page === "editor" && state.edit.id ? "Edit post" : meta.title;
    closeMenu();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    ({ overview: renderOverview, appointments: renderAppointments, posts: renderPosts, editor: renderEditor })[state.page]();
  }

  /* ---------- page: overview ---------- */
  function renderOverview() {
    $("#page-tools").innerHTML = `<button class="btn btn-primary" data-act="new-appt">${icon("plus", 16)} New appointment</button>`;
    const t = today();
    const todays = state.appts.filter((a) => a.appt_date === t && a.status !== "cancelled");
    const pending = state.appts.filter((a) => a.status === "pending" && a.appt_date >= t);
    const week = state.appts.filter((a) => inPeriod(a, "week") && a.status !== "cancelled");
    const published = state.posts.filter((p) => p.status === "published");
    const drafts = state.posts.length - published.length;
    const done = todays.filter((a) => a.status === "completed").length;

    $("#view").innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="label">${icon("calendar", 16)}Today's appointments</div><div class="value">${fmtNum(todays.length)}</div><div class="sub">${fmtNum(done)} seen · ${fmtDate(t)}</div></div>
        <div class="kpi"><div class="label">${icon("clock", 16)}Waiting for confirmation</div><div class="value">${fmtNum(pending.length)}</div>
          <div class="sub">${pending.length ? `<span class="pill pending">${icon("alert", 13)}Call to confirm</span>` : `<span class="pill confirmed">${icon("check", 13)}All confirmed</span>`}</div></div>
        <div class="kpi"><div class="label">${icon("users", 16)}Next 7 days</div><div class="value">${fmtNum(week.length)}</div><div class="sub">${fmtDate(t)} to ${fmtDate(addDays(6))}</div></div>
        <div class="kpi"><div class="label">${icon("file", 16)}Published posts</div><div class="value">${fmtNum(published.length)}</div><div class="sub">${fmtNum(drafts)} draft${drafts === 1 ? "" : "s"}</div></div>
      </div>
      <div class="cols-2">
        <div class="card">
          <div class="card-head"><h2>Today's schedule</h2><div class="right"><button class="btn btn-sm" data-go="appointments" data-period="today">See all</button></div></div>
          ${apptTable(todays, { compact: true, hideDate: true, empty: "No appointments today." })}
        </div>
        <div class="card">
          <div class="card-head"><h2>Waiting for confirmation</h2><div class="right"><button class="btn btn-sm" data-go="appointments" data-status="pending">See all</button></div></div>
          ${apptTable(pending.slice(0, 8), { compact: true, empty: "No pending requests." })}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Recent blog posts</h2><div class="right"><button class="btn btn-sm btn-primary" data-go="editor">${icon("pen", 14)} Write a post</button></div></div>
        ${postTable(state.posts.slice(0, 5))}
      </div>`;
  }

  /* ---------- page: appointments ---------- */
  function renderAppointments() {
    $("#page-tools").innerHTML = `
      <div class="segmented" role="group" aria-label="Date period">${PERIODS.map(([k, l]) =>
        `<button type="button" data-period-set="${k}" aria-pressed="${state.period === k}">${l}</button>`).join("")}</div>
      <button class="btn btn-primary" data-act="new-appt">${icon("plus", 16)} New</button>`;

    const inP = state.appts.filter((a) => inPeriod(a, state.period));
    const counts = { all: inP.length };
    Store.STATUSES.forEach((s) => (counts[s] = inP.filter((a) => a.status === s).length));
    const term = state.search.trim().toLowerCase();
    let rows = inP.filter((a) => (state.status === "all" || a.status === state.status) &&
      (!term || `${a.patient_name} ${a.phone} ${a.reason}`.toLowerCase().includes(term)));
    if (state.period === "past") rows = rows.slice().reverse();

    const label = PERIODS.find((p) => p[0] === state.period)[1];
    $("#view").innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="segmented" role="group" aria-label="Status">
            ${["all", ...Store.STATUSES].map((s) => `<button type="button" data-status-set="${s}" aria-pressed="${state.status === s}">
              ${s === "all" ? "All" : STATUS[s].label} <span class="count">${fmtNum(counts[s])}</span></button>`).join("")}
          </div>
          <div class="right"><input class="input" type="search" id="appt-search" placeholder="Search name, phone, reason" value="${esc(state.search)}" aria-label="Search appointments" style="width:240px;max-width:100%"></div>
        </div>
        ${apptTable(rows, { empty: `No appointments for “${label}”${state.status !== "all" ? " with this status" : ""}.` })}
      </div>`;
    const s = $("#appt-search");
    s.addEventListener("input", () => {
      state.search = s.value;
      const pos = s.selectionStart;
      renderAppointments();
      const n = $("#appt-search"); n.focus(); n.setSelectionRange(pos, pos);
    });
  }

  function apptTable(rows, { compact = false, hideDate = false, empty = "Nothing here." } = {}) {
    if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
    return `<table class="table"><thead><tr>
        ${hideDate ? "" : "<th>Date</th>"}<th>Time</th><th>Patient</th>${compact ? "" : "<th>Reason</th>"}<th>Status</th><th style="text-align:right">Actions</th>
      </tr></thead><tbody>${rows.map((a) => {
        const extra = [a.age ? `${a.age} yrs` : "", a.gender].filter(Boolean).join(", ");
        const acts = [];
        if (a.status === "pending") acts.push(`<button class="btn btn-sm" data-status="${a.id}" data-to="confirmed">${icon("check", 14)} Confirm</button>`);
        if (a.status === "confirmed") acts.push(`<button class="btn btn-sm" data-status="${a.id}" data-to="completed">${icon("check", 14)} Mark seen</button>`);
        acts.push(`<button class="btn btn-sm" data-edit-appt="${a.id}" aria-label="Edit">${icon("edit", 14)}${compact ? "" : " Edit"}</button>`);
        if (!compact && (a.status === "pending" || a.status === "confirmed"))
          acts.push(`<button class="btn btn-sm btn-danger" data-status="${a.id}" data-to="cancelled">${icon("x", 14)} Cancel</button>`);
        return `<tr>
          ${hideDate ? "" : `<td data-label="Date"><span class="num">${fmtDate(a.appt_date)}</span><div class="cell-sub">${weekdayName(a.appt_date)}</div></td>`}
          <td data-label="Time"><span class="num">${fmtTime(a.appt_time)}</span></td>
          <td data-label="Patient"><div><div class="cell-main">${esc(a.patient_name)}</div><div class="cell-sub">${phoneLinks(a.phone)}${extra ? " · " + esc(extra) : ""}</div>
            ${compact && a.reason ? `<div class="cell-sub">${esc(a.reason)}</div>` : ""}</div></td>
          ${compact ? "" : `<td data-label="Reason"><div class="reason">${esc(a.reason) || '<span class="muted">—</span>'}${a.notes ? `<div class="cell-sub">${icon("lock", 12)} ${esc(a.notes)}</div>` : ""}</div></td>`}
          <td data-label="Status">${pill(a.status)}</td>
          <td class="no-label"><div class="actions">${acts.join("")}</div></td>
        </tr>`;
      }).join("")}</tbody></table>`;
  }

  /* ---------- appointment dialog ---------- */
  const dlg = $("#appt-dlg"), form = $("#appt-form");
  function openAppt(a) {
    form.reset();
    $("#appt-msg").innerHTML = "";
    $("#appt-dlg-title").textContent = a ? "Edit appointment" : "New appointment";
    const data = a || { appt_date: today(), status: "confirmed" };
    for (const el of form.elements) if (el.name && data[el.name] != null) el.value = data[el.name];
    if (!a) form.elements.id.value = "";
    let del = $("#appt-delete");
    if (del) del.remove();
    if (a) {
      del = document.createElement("button");
      del.type = "button"; del.id = "appt-delete"; del.className = "btn btn-danger"; del.style.marginRight = "auto";
      del.innerHTML = `${icon("trash", 14)} Delete`;
      del.onclick = async () => {
        dlg.close();
        if (!(await confirmBox("Delete appointment?", `This permanently removes ${a.patient_name}'s appointment on ${fmtDate(a.appt_date)}.`, "Delete", true))) return dlg.showModal();
        try { await Store.deleteAppointment(a.id); await loadData(); render(); toast("Appointment deleted"); }
        catch (e) { toast(e.message, "err"); }
      };
      $(".dlg-foot", form).prepend(del);
    }
    dlg.showModal();
    $("#a-name").focus();
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.id) delete data.id;
    try {
      await Store.saveAppointment(data);
      dlg.close();
      await loadData(); render();
      toast("Appointment saved");
    } catch (err) { $("#appt-msg").innerHTML = msgHtml("err", err.message); }
  });
  $$("[data-close]", dlg).forEach((b) => { b.innerHTML = b.textContent.trim() ? b.innerHTML : icon("x"); b.addEventListener("click", () => dlg.close()); });

  /* ---------- page: posts ---------- */
  function renderPosts() {
    const n = (s) => state.posts.filter((p) => s === "all" || p.status === s).length;
    $("#page-tools").innerHTML = `
      <div class="segmented" role="group" aria-label="Post status">
        ${[["all", "All"], ["published", "Published"], ["draft", "Drafts"]].map(([k, l]) =>
          `<button type="button" data-postf="${k}" aria-pressed="${state.postFilter === k}">${l} <span class="count">${fmtNum(n(k))}</span></button>`).join("")}
      </div>
      <button class="btn btn-primary" data-go="editor">${icon("pen", 16)} Write a post</button>`;
    const rows = state.posts.filter((p) => state.postFilter === "all" || p.status === state.postFilter);
    $("#view").innerHTML = `<div class="card">${postTable(rows, true)}</div>`;
  }

  function postTable(rows, full = false) {
    if (!rows.length) return `<div class="empty">No posts yet. <a href="#" data-go="editor">Write your first post</a>.</div>`;
    return `<table class="table"><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>${full ? "Published" : "Date"}</th>${full ? "<th>Last edited</th>" : ""}<th style="text-align:right">Actions</th></tr></thead>
      <tbody>${rows.map((p) => `<tr>
        <td data-label="Title"><div><div class="cell-main">${esc(p.title)}</div><div class="cell-sub mono">/${esc(p.slug)}</div></div></td>
        <td data-label="Category">${esc(p.category)}</td>
        <td data-label="Status">${pill(p.status)}</td>
        <td data-label="${full ? "Published" : "Date"}"><span class="num">${fmtDate(full ? p.published_at : (p.published_at || p.updated_at))}</span></td>
        ${full ? `<td data-label="Edited"><span class="num">${fmtDate(p.updated_at)}</span></td>` : ""}
        <td class="no-label"><div class="actions">
          <button class="btn btn-sm" data-edit-post="${p.id}">${icon("edit", 14)} Edit</button>
          ${p.status === "published" ? `<a class="btn btn-sm" href="blog.html?post=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">${icon("eye", 14)} View</a>` : ""}
          ${full ? `<button class="btn btn-sm btn-danger" data-del-post="${p.id}" aria-label="Delete">${icon("trash", 14)}</button>` : ""}
        </div></td></tr>`).join("")}</tbody></table>`;
  }

  /* ---------- page: editor ---------- */
  function renderEditor() {
    const p = state.edit;
    $("#page-tools").innerHTML = `
      <button class="btn" data-go="posts">${icon("arrowLeft", 16)} All posts</button>
      <button class="btn" data-save="draft">${p.status === "published" ? "Unpublish (move to drafts)" : "Save draft"}</button>
      <button class="btn btn-primary" data-save="published">${icon("checkCircle", 16)} ${p.status === "published" ? "Update post" : "Publish"}</button>`;
    const cats = Array.from(new Set(["General", "Infections", "Diabetes", "Heart health", "Nutrition", "Women's health", "Child health", "Mental health", ...state.posts.map((x) => x.category)]));
    $("#view").innerHTML = `
      <div id="ed-msg" aria-live="polite"></div>
      <div class="editor">
        <div class="card">
          <div style="padding:14px 18px 6px"><input class="title-input" id="ed-title" placeholder="Post title" value="${esc(p.title)}" aria-label="Post title"></div>
          <div class="toolbar" role="toolbar" aria-label="Formatting">
            <button type="button" data-md="h2" title="Heading">H2</button>
            <button type="button" data-md="h3" title="Sub-heading">H3</button>
            <span class="sep"></span>
            <button type="button" data-md="bold" title="Bold"><b>B</b></button>
            <button type="button" data-md="italic" title="Italic"><i>I</i></button>
            <button type="button" data-md="ul" title="Bullet list">• List</button>
            <button type="button" data-md="ol" title="Numbered list">1. List</button>
            <button type="button" data-md="quote" title="Highlight box">❝ Quote</button>
            <button type="button" data-md="link" title="Link">Link</button>
            <div class="segmented tabs" role="tablist">
              <button type="button" role="tab" data-tab="write" aria-pressed="${state.tab === "write"}">Write</button>
              <button type="button" role="tab" data-tab="preview" aria-pressed="${state.tab === "preview"}">Preview</button>
            </div>
          </div>
          <textarea class="content-area" id="ed-content" placeholder="Start writing… Use the buttons above for headings, bold text and lists." ${state.tab === "preview" ? "hidden" : ""}>${esc(p.content)}</textarea>
          <div class="preview" id="ed-preview" ${state.tab === "write" ? "hidden" : ""}></div>
        </div>
        <div class="stack">
          <div class="card card-body stack">
            <div class="field"><label>Status</label><div>${pill(p.status)}</div>
              ${p.published_at ? `<span class="hint">Published ${fmtDate(p.published_at)}</span>` : ""}</div>
            <div class="field"><label for="ed-cat">Category</label><input class="input" id="ed-cat" list="ed-cats" value="${esc(p.category)}" placeholder="e.g. Diabetes">
              <datalist id="ed-cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
            <div class="field"><label for="ed-excerpt">Short summary</label><textarea class="textarea" id="ed-excerpt" rows="3" maxlength="400" placeholder="1–2 sentences shown on the blog list">${esc(p.excerpt)}</textarea></div>
            <div class="field"><label for="ed-cover">Cover image link (optional)</label><input class="input" id="ed-cover" type="url" placeholder="https://…" value="${esc(p.cover_url)}"><span class="hint">Paste a link to an image that starts with https://</span></div>
            <div class="field"><label for="ed-slug">Web address</label><input class="input mono" id="ed-slug" value="${esc(p.slug || "")}" placeholder="made from the title"><span class="hint">blog.html?post=<b id="ed-slug-prev"></b></span></div>
          </div>
          <div class="card card-body">
            <div class="msg warn">${icon("info", 16)}<span>Never include patient names or identifiable details in blog posts.</span></div>
          </div>
          ${p.id ? `<button class="btn btn-danger" data-del-post="${p.id}">${icon("trash", 14)} Delete this post</button>` : ""}
        </div>
      </div>`;
    const ta = $("#ed-content");
    const sync = () => {
      Object.assign(state.edit, {
        title: $("#ed-title").value, content: ta.value, category: $("#ed-cat").value,
        excerpt: $("#ed-excerpt").value, cover_url: $("#ed-cover").value, slug: $("#ed-slug").value
      });
      $("#ed-slug-prev").textContent = Store.slugify(state.edit.slug || state.edit.title);
    };
    ["#ed-title", "#ed-content", "#ed-cat", "#ed-excerpt", "#ed-cover", "#ed-slug"].forEach((s) =>
      $(s).addEventListener("input", () => { state.dirty = true; sync(); }));
    sync();
    if (state.tab === "preview") $("#ed-preview").innerHTML = markdown(p.content) || `<p class="muted">Nothing to preview yet.</p>`;
    if (!p.id) $("#ed-title").focus();
  }

  function mdInsert(kind) {
    const ta = $("#ed-content");
    if (!ta || ta.hidden) return;
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    const sel = v.slice(s, e);
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    let out, cs, ce;
    const wrap = (l, r, ph) => { const t = sel || ph; out = v.slice(0, s) + l + t + r + v.slice(e); cs = s + l.length; ce = cs + t.length; };
    const prefix = (pre) => {
      const block = v.slice(lineStart, e) || "";
      const lines = (block || "List item").split("\n").map((ln, i) => (typeof pre === "function" ? pre(i) : pre) + ln.replace(/^(#{1,3}\s|>\s?|[-*]\s|\d+\.\s)/, ""));
      const t = lines.join("\n");
      out = v.slice(0, lineStart) + t + v.slice(e); cs = lineStart; ce = lineStart + t.length;
    };
    switch (kind) {
      case "bold": wrap("**", "**", "bold text"); break;
      case "italic": wrap("*", "*", "italic text"); break;
      case "link": {
        const url = prompt("Paste the link (https://…)", "https://");
        if (!url || !/^https?:\/\//.test(url)) return;
        wrap("[", `](${url})`, "link text"); break;
      }
      case "h2": prefix("## "); break;
      case "h3": prefix("### "); break;
      case "ul": prefix("- "); break;
      case "ol": prefix((i) => `${i + 1}. `); break;
      case "quote": prefix("> "); break;
    }
    ta.value = out; ta.focus(); ta.setSelectionRange(cs, ce);
    ta.dispatchEvent(new Event("input"));
  }

  async function savePost(status) {
    const msg = $("#ed-msg");
    msg.innerHTML = "";
    const p = { ...state.edit, status };
    if (status === "published" && !p.content.trim()) { msg.innerHTML = msgHtml("err", "Please write something before publishing."); return; }
    try {
      const saved = await Store.savePost(p);
      state.dirty = false;
      await loadData();
      state.edit = { ...saved };
      $("#page-title").textContent = "Edit post";
      render();
      toast(status === "published" ? "Post published — it is live on your blog" : "Saved as draft");
    } catch (e) { msg.innerHTML = msgHtml("err", e.message); }
  }

  /* ---------- global click handling ---------- */
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    const d = t.dataset;
    if (d.page) return go(d.page);
    if (d.go) {
      e.preventDefault();
      if (d.period) state.period = d.period;
      if (d.status && !d.to) { state.status = d.status; state.period = "all"; }
      return go(d.go);
    }
    if (d.act === "new-appt") return openAppt(null);
    if (d.periodSet) { state.period = d.periodSet; return render(); }
    if (d.statusSet) { state.status = d.statusSet; return render(); }
    if (d.postf) { state.postFilter = d.postf; return render(); }
    if (d.editAppt) return openAppt(state.appts.find((a) => a.id === d.editAppt));
    if (d.status && d.to) {
      const a = state.appts.find((x) => x.id === d.status);
      if (d.to === "cancelled" && !(await confirmBox("Cancel appointment?", `Cancel ${a.patient_name}'s appointment on ${fmtDate(a.appt_date)} at ${fmtTime(a.appt_time)}?`, "Cancel appointment", true))) return;
      try { await Store.setAppointmentStatus(d.status, d.to); await loadData(); render(); toast(`Marked as ${STATUS[d.to].label.toLowerCase()}`); }
      catch (err) { toast(err.message, "err"); }
      return;
    }
    if (d.editPost) return go("editor", { post: state.posts.find((p) => p.id === d.editPost) });
    if (d.delPost) {
      const p = state.posts.find((x) => x.id === d.delPost);
      if (!(await confirmBox("Delete post?", `“${p.title}” will be permanently deleted.`, "Delete", true))) return;
      try { await Store.deletePost(p.id); state.dirty = false; await loadData(); go("posts"); toast("Post deleted"); }
      catch (err) { toast(err.message, "err"); }
      return;
    }
    if (d.md) return mdInsert(d.md);
    if (d.tab) {
      state.tab = d.tab;
      $$("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === d.tab));
      $("#ed-content").hidden = d.tab !== "write";
      const pv = $("#ed-preview"); pv.hidden = d.tab !== "preview";
      if (d.tab === "preview") pv.innerHTML = markdown(state.edit.content) || `<p class="muted">Nothing to preview yet.</p>`;
      return;
    }
    if (d.save) return savePost(d.save);
  });

  window.addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- sidebar / theme / menu ---------- */
  function closeMenu() {
    $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show");
    $("#menu-btn").setAttribute("aria-expanded", "false");
  }
  $("#menu-btn").innerHTML = icon("menu");
  $("#menu-btn").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#scrim").classList.toggle("show", open);
    $("#menu-btn").setAttribute("aria-expanded", open);
  });
  $("#scrim").addEventListener("click", closeMenu);
  const themeIcon = () => { $("#theme-btn").innerHTML = icon(U.currentTheme() === "dark" ? "sun" : "moon"); };
  $("#theme-btn").addEventListener("click", () => { U.toggleTheme(); themeIcon(); });
  themeIcon();

  $("#btn-logout").addEventListener("click", async () => {
    if (state.dirty && !(await confirmBox("Sign out?", "Your unsaved post changes will be lost.", "Sign out", true))) return;
    state.dirty = false;
    await Store.signOut(); location.reload();
  });
  $("#btn-export").addEventListener("click", async () => {
    try {
      const data = await Store.exportAll();
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `clinic-backup-${fmtDate(new Date())}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("Backup downloaded");
    } catch (e) { toast(e.message, "err"); }
  });
  $("#btn-import").addEventListener("click", () => {
    if (Store.mode !== "local") return toast("Restore works only in demo mode. Your database is backed up by Supabase.", "err");
    $("#import-file").click();
  });
  $("#import-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!(await confirmBox("Restore backup?", "This replaces all appointments and posts in this browser with the backup file.", "Restore", true))) return;
    try { await Store.importAll(JSON.parse(await f.text())); await loadData(); go("overview"); toast("Backup restored"); }
    catch (err) { toast(err.message || "Could not read that file", "err"); }
  });

  /* ---------- start ---------- */
  function fillBrand() {
    $("#brand-mark").innerHTML = icon("stethoscope", 18);
    $("#login-mark").innerHTML = icon("stethoscope", 18);
    $("#brand-name").textContent = `${CFG.doctorName || "Doctor"}, ${CFG.qualification || ""}`;
    document.title = `Dashboard | ${CFG.doctorName || "Clinic"}`;
    $("#source").innerHTML = Store.mode === "supabase"
      ? `${icon("database", 16)}<div><b>Live database</b>Connected to Supabase</div>`
      : `${icon("monitor", 16)}<div><b>Demo mode</b>Saved in this browser only</div>`;
    hydrate();
  }

  async function showApp() {
    $("#login").hidden = true; $("#app").hidden = false;
    try { await loadData(); }
    catch (e) { $("#view").innerHTML = msgHtml("err", "Could not load data: " + e.message); return; }
    go("overview");
  }

  function showLogin() {
    $("#login").hidden = false; $("#app").hidden = true;
    const demo = Store.mode === "local";
    $("#login-email-wrap").hidden = demo;
    $("#login-pass-label").textContent = demo ? "PIN" : "Password";
    $("#login-pass").setAttribute("autocomplete", demo ? "off" : "current-password");
    $("#login-help").textContent = demo
      ? "Demo mode: enter the PIN from config.js (default 1234)."
      : "Sign in with the doctor account you created in Supabase.";
    $("#login-form").onsubmit = async (e) => {
      e.preventDefault();
      $("#login-msg").innerHTML = "";
      try { await Store.signIn($("#login-email").value.trim(), $("#login-pass").value); showApp(); }
      catch (err) { $("#login-msg").innerHTML = msgHtml("err", err.message); }
    };
    (demo ? $("#login-pass") : $("#login-email")).focus();
  }

  (async function start() {
    try { await Store.init(); }
    catch (e) { document.body.innerHTML = `<div class="login"><div class="card">${msgHtml("err", "Could not connect to the database: " + e.message)}</div></div>`; return; }
    fillBrand();
    if (await Store.isSignedIn()) showApp(); else showLogin();
  })();
})();
