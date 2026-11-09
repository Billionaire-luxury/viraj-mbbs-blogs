/* Shared helpers: formatting, escaping, markdown, theme. */
(function () {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* dd-Mmm-yy, e.g. 09-Nov-26. Accepts "YYYY-MM-DD" or ISO timestamp or Date. */
  function fmtDate(v) {
    if (!v) return "—";
    let d;
    if (v instanceof Date) d = v;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, dd] = v.split("-").map(Number); d = new Date(y, m - 1, dd); }
    else d = new Date(v);
    if (isNaN(d)) return "—";
    return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  }

  /* "17:30" -> "5:30 pm" */
  function fmtTime(t) {
    if (!/^\d{1,2}:\d{2}$/.test(t || "")) return t || "—";
    let [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
  }

  /* Indian number format: 1,23,456 */
  const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");

  function weekdayName(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short" });
  }

  /* ---------- Small, safe markdown renderer ----------
   * Supports: # ## ### headings, **bold**, *italic*, [link](https://…), - lists, 1. lists,
   * > quotes, --- rules, blank-line paragraphs. All HTML in the input is escaped.
   */
  function inline(s) {
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)/g,
      (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    return s;
  }

  function markdown(src) {
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let para = [], list = null, quote = [];
    const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.type}>`); list = null; } };
    const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${quote.map(inline).join("<br>")}</blockquote>`); quote = []; } };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };

    for (const raw of lines) {
      const line = raw.trimEnd();
      let m;
      if (!line.trim()) { flushAll(); continue; }
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flushAll(); const lv = m[1].length + 1; out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); continue; }
      if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushAll(); out.push("<hr>"); continue; }
      if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
      if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
        flushPara(); flushQuote();
        if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
        list.items.push(m[1]); continue;
      }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara(); flushQuote();
        if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
        list.items.push(m[1]); continue;
      }
      flushList(); flushQuote();
      para.push(line);
    }
    flushAll();
    return out.join("\n");
  }

  function readingTime(text) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  /* ---------- Theme (light / dark) ---------- */
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  function currentTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("drsite.theme", next); } catch (e) { /* ignore */ }
  }
  try { applyTheme(localStorage.getItem("drsite.theme")); } catch (e) { /* ignore */ }

  window.U = { esc, fmtDate, fmtTime, fmtNum, weekdayName, markdown, readingTime, toggleTheme, currentTheme };
})();
