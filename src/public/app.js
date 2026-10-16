/* Lakeze Go — client app (vanilla JS, no build step) */
(() => {
  "use strict";

  /* =========================================================
     Utilities
     ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const parseTime = (s) => (!s ? null : s.includes("T") ? new Date(s) : new Date(s.replace(" ", "T") + "Z"));
  const fmtDate = (s) => (s ? parseTime(s).toLocaleDateString("zh-TW", { year: "numeric", month: "short", day: "numeric" }) : "—");
  const fmtTime = (s) => (s ? parseTime(s).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
  const ago = (s) => {
    if (!s) return "—";
    const d = (Date.now() - parseTime(s).getTime()) / 1000;
    if (d < 60) return "剛剛";
    if (d < 3600) return `${Math.floor(d / 60)} 分鐘前`;
    if (d < 86400) return `${Math.floor(d / 3600)} 小時前`;
    if (d < 86400 * 7) return `${Math.floor(d / 86400)} 天前`;
    return fmtDate(s);
  };
  const money = (n) => `NT$${Number(n || 0).toLocaleString("zh-TW")}`;
  const num = (n) => Number(n || 0).toLocaleString("zh-TW");
  const isUrl = (u) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(String(u || "").trim());
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const ukey = (k) => `lg:${state.me?.user?.id ?? 0}:${k}`;
  const sessionGet = (k) => { try { return JSON.parse(sessionStorage.getItem(k) ?? "null"); } catch { return null; } };
  const sessionSet = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
  const sessionDel = (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } };

  const ICON_PATHS = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    hash: '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3"/>',
    click: '<path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    facebook: '<path fill="currentColor" stroke="none" d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z"/>',
    instagram: '<rect width="20" height="20" x="2" y="2" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    branch: '<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>',
    list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
    msgbtn: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8"/>',
    corner: '<polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',
    minus: '<path d="M5 12h14"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    video: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    workflow: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;

  let toastTimer;
  function toast(msg, isErr = false) {
    const t = $("#toast");
    t.innerHTML = `${icon(isErr ? "alert" : "check")}<span>${esc(msg)}</span>`;
    t.className = "toast" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), isErr ? 6000 : 2800);
  }

  async function api(path, opts = {}) {
    const res = await fetch("/api" + path, {
      headers: { "content-type": "application/json" },
      ...opts,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401 && !path.startsWith("/auth")) {
      state.me = { ...(state.me || {}), authenticated: false };
      renderAuth("login");
      throw new Error("未登入");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `發生錯誤（HTTP ${res.status}）`);
    return data;
  }

  /** 按鈕執行非同步動作時顯示 loading */
  async function busy(btn, fn) {
    if (!btn || btn.disabled) return;
    const html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${btn.dataset.busy ? `<span>${esc(btn.dataset.busy)}</span>` : ""}`;
    try {
      return await fn();
    } finally {
      btn.disabled = false;
      btn.innerHTML = html;
    }
  }

  function modal({ title, body, foot = "", size = "" }) {
    const wrap = document.createElement("div");
    wrap.className = "modal-scrim";
    wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="btn btn-ghost icon-btn" data-close aria-label="關閉">${icon("x")}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}</div>`;
    const close = () => wrap.remove();
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-close]")) close();
    });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    });
    document.body.appendChild(wrap);
    return { el: wrap, close };
  }

  function confirmDialog(title, text, okLabel = "確認", danger = false) {
    return new Promise((resolve) => {
      const m = modal({
        title,
        size: "sm",
        body: `<p class="muted">${esc(text)}</p>`,
        foot: `<button class="btn" data-close>取消</button><button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="cf-ok">${esc(okLabel)}</button>`,
      });
      m.el.addEventListener("click", (e) => {
        if (e.target.closest("[data-close]")) resolve(false);
      });
      $("#cf-ok", m.el).onclick = () => {
        m.close();
        resolve(true);
      };
    });
  }

  const copyField = (value) =>
    `<div class="copy-field"><code>${esc(value)}</code><button type="button" data-copy="${esc(value)}">${icon("copy")}複製</button></div>`;
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-copy]");
    if (!c) return;
    const done = () => {
      const old = c.innerHTML;
      c.innerHTML = `${icon("check")}已複製`;
      setTimeout(() => (c.innerHTML = old), 1500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(c.dataset.copy).then(done, () => toast("無法複製，請手動選取", true));
  });

  const platformBadge = (p) =>
    p === "instagram"
      ? '<span class="badge instagram">Instagram</span>'
      : p === "messenger"
        ? '<span class="badge messenger">Messenger</span>'
        : '<span class="badge">Messenger + IG</span>';

  const state = { me: null, overview: null };
  const isOwner = () => state.me?.user?.role === "owner";
  const appName = () => state.me?.app_name || "Lakeze Go";

  /* =========================================================
     Auth
     ========================================================= */
  function renderAuth(mode) {
    const me = state.me || {};
    const first = me.needs_setup;
    if (first) mode = "signup";
    if (mode === "signup" && !first && me.allow_signup === false) mode = "login";
    const trial = me.trial_days > 0 ? `${me.trial_days} 天免費試用，不需信用卡` : "立即開始使用";
    $("#root").innerHTML = `
      <div class="auth">
        <div class="auth-main">
          <img class="brand-logo" src="/brand/logo.png" alt="Lakeze 人客多" />
          <div class="auth-form-wrap">
            <form class="auth-form" id="auth-form" novalidate>
              <h1>${mode === "signup" ? (first ? "建立平台擁有者帳號" : "建立你的帳號") : "歡迎回來"}</h1>
              <p class="lead">${mode === "signup" ? (first ? "你是第一位註冊者，將成為這個平台的管理員。" : trial) : `登入 ${esc(appName())}`}</p>
              <div class="stack">
                ${mode === "signup" ? `<label class="field"><span class="label">名字或品牌名稱</span><input class="input" id="f-name" autocomplete="organization" placeholder="例如：小美咖啡"/></label>` : ""}
                <label class="field"><span class="label">Email</span><input class="input" id="f-email" type="email" autocomplete="email" placeholder="you@company.com"/></label>
                <label class="field"><span class="label">密碼</span><input class="input" id="f-password" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" placeholder="${mode === "signup" ? "至少 8 個字元" : ""}"/></label>
                <p class="error-text small" id="f-error" role="alert" style="color:var(--danger);min-height:1em"></p>
                <button class="btn btn-primary btn-lg btn-block" type="submit">${mode === "signup" ? "建立帳號" : "登入"}</button>
              </div>
              ${!first && me.allow_signup !== false ? `<p class="auth-switch">${mode === "signup" ? '已經有帳號？<a data-mode="login">登入</a>' : '還沒有帳號？<a data-mode="signup">免費註冊</a>'}</p>` : ""}
            </form>
          </div>
          <p class="auth-foot">© ${new Date().getFullYear()} Lakeze 人客多</p>
        </div>
        <aside class="auth-side">
          <div class="auth-side-inner">
            <h2>有人點了你的 Meta 廣告，<br/>3 秒內自動回覆，直接帶去下單頁。</h2>
            <ul class="points">
              <li>${icon("check")}<span>用 Facebook 登入，一鍵連接粉絲專頁與 Instagram</span></li>
              <li>${icon("check")}<span>選好要導去的網址，自動回覆就設定完成</span></li>
              <li>${icon("check")}<span>每一位從廣告來的客人、每一次點擊都看得到</span></li>
            </ul>
            ${phoneMock({
              sys: "透過 Facebook 廣告開啟對話",
              bubbles: [{ text: "嗨 小明 👋 謝謝你對我們的新品有興趣！點下方按鈕看完整介紹與優惠。", buttons: ["立即查看優惠"] }],
            })}
          </div>
        </aside>
      </div>`;
    $$("[data-mode]").forEach((a) => (a.onclick = () => renderAuth(a.dataset.mode)));
    $("#auth-form").onsubmit = async (e) => {
      e.preventDefault();
      const err = $("#f-error");
      err.textContent = "";
      const btn = e.submitter || $("#auth-form button[type=submit]");
      const body = { email: $("#f-email").value.trim(), password: $("#f-password").value };
      if (mode === "signup") body.name = $("#f-name").value.trim();
      if (!body.email || !body.password) return (err.textContent = "請填寫 Email 與密碼");
      try {
        await busy(btn, () => api(`/auth/${mode}`, { method: "POST", body }));
        state.me = await api("/auth/me");
        const target = isOwner() && first ? "#setup" : location.hash || "#home";
        if (location.hash !== target) history.replaceState(null, "", target);
        startApp();
      } catch (ex) {
        err.textContent = ex.message;
      }
    };
    setTimeout(() => (mode === "signup" ? $("#f-name") : $("#f-email"))?.focus(), 0);
  }

  /* =========================================================
     Shell
     ========================================================= */
  const NAV = [
    { id: "home", label: "首頁", icon: "home" },
    { id: "automations", label: "自動回覆", icon: "zap" },
    { id: "contacts", label: "聯絡人", icon: "users" },
    { id: "connections", label: "連接帳號", icon: "plug" },
    { id: "activity", label: "活動記錄", icon: "activity" },
    { id: "billing", label: "方案與付款", icon: "card" },
  ];
  const ADMIN_NAV = [
    { id: "setup", label: "平台設定", icon: "sliders" },
    { id: "admin-users", label: "用戶", icon: "shield" },
    { id: "admin-orders", label: "訂單", icon: "receipt" },
  ];

  function renderShell() {
    const u = state.me.user;
    const initials = (u.name || u.email).trim().slice(0, 1).toUpperCase();
    $("#root").innerHTML = `
      <div class="app">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand"><a href="#home"><img src="/brand/logo.png" alt="Lakeze 人客多"/></a></div>
          <nav class="sidebar-nav" aria-label="主選單">
            ${NAV.map((n) => `<a class="nav-item" href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join("")}
            ${isOwner() ? `<div class="nav-label">管理</div>${ADMIN_NAV.map((n) => `<a class="nav-item" href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join("")}` : ""}
          </nav>
          <div class="sidebar-foot">
            <div id="plan-chip"></div>
            <div class="user-menu" id="user-menu" tabindex="0" role="button" aria-haspopup="menu">
              <div class="avatar">${esc(initials)}</div>
              <div class="who"><b>${esc(u.name || u.email)}</b><span>${esc(u.email)}</span></div>
            </div>
          </div>
        </aside>
        <div class="main">
          <header class="topbar-mobile">
            <button class="btn btn-ghost icon-btn" id="menu-btn" aria-label="開啟選單">${icon("menu")}</button>
            <img src="/brand/logo.png" alt="Lakeze 人客多"/>
            <span style="width:32px"></span>
          </header>
          <main id="page"></main>
        </div>
      </div>`;
    renderPlanChip();
    $("#menu-btn").onclick = () => toggleSidebar(true);
    const um = $("#user-menu");
    um.onclick = () => openUserMenu();
    um.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && openUserMenu();
  }
  function toggleSidebar(open) {
    $("#sidebar").classList.toggle("open", open);
    $(".scrim")?.remove();
    if (open) {
      const s = document.createElement("div");
      s.className = "scrim";
      s.onclick = () => toggleSidebar(false);
      document.body.appendChild(s);
    }
  }
  function openUserMenu() {
    if ($("#user-pop")) return $("#user-pop").remove();
    const pop = document.createElement("div");
    pop.className = "menu";
    pop.id = "user-pop";
    pop.setAttribute("role", "menu");
    pop.innerHTML = `<a href="#account" role="menuitem">${icon("user")}帳號設定</a><a href="#billing" role="menuitem">${icon("card")}方案與付款</a><button id="logout-btn" role="menuitem">${icon("logout")}登出</button>`;
    $("#sidebar").appendChild(pop);
    $("#logout-btn").onclick = async () => {
      await api("/auth/logout", { method: "POST" });
      state.me = await api("/auth/me");
      renderAuth("login");
    };
    setTimeout(() => {
      document.addEventListener("click", function off(e) {
        if (!e.target.closest("#user-pop") && !e.target.closest("#user-menu")) {
          pop.remove();
          document.removeEventListener("click", off);
        }
      });
    }, 0);
  }
  function renderPlanChip() {
    const el = $("#plan-chip");
    if (!el) return;
    const sub = state.me.user.subscription;
    const total = state.me.trial_days || 14;
    let html = "";
    if (sub.source === "owner") html = `<div class="plan-chip"><div class="top"><span>平台擁有者</span><span class="badge brand">不限</span></div><div class="sub">所有功能皆可使用</div></div>`;
    else if (sub.source === "trial")
      html = `<a class="plan-chip" href="#billing" style="display:block;text-decoration:none;color:inherit"><div class="top"><span>免費試用</span><span class="muted">剩 ${sub.days_left} 天</span></div><div class="bar"><span style="width:${Math.max(4, Math.min(100, (sub.days_left / total) * 100))}%"></span></div><div class="sub">升級以在試用後繼續使用 →</div></a>`;
    else if (sub.source === "paid") html = `<div class="plan-chip"><div class="top"><span>付費方案</span><span class="badge success">使用中</span></div><div class="sub">${fmtDate(sub.until)} 到期</div></div>`;
    else html = `<a class="plan-chip" href="#billing" style="display:block;text-decoration:none;border-color:#f4c7c7;background:var(--danger-soft)"><div class="top" style="color:var(--danger)"><span>方案已到期</span></div><div class="sub" style="color:#8a1d1d">自動回覆已暫停，立即續約 →</div></a>`;
    el.innerHTML = html;
  }
  async function refreshMe() {
    state.me = await api("/auth/me");
    renderPlanChip();
  }

  /* =========================================================
     Router
     ========================================================= */
  const ALIASES = { overview: "home", channels: "connections", settings: "setup", events: "activity" };
  function parseHash() {
    const raw = (location.hash || "#home").slice(1);
    const [path, query = ""] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    let page = parts[0] || "home";
    page = ALIASES[page] || page;
    return { page, args: parts.slice(1), query: new URLSearchParams(query) };
  }
  const PAGES = {};
  async function route() {
    if (!state.me?.authenticated) return;
    const { page, args, query } = parseHash();
    if (page === "simulate") {
      location.hash = "#automations";
      return openTestModal();
    }
    $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === page));
    toggleSidebar(false);
    $("#user-pop")?.remove();
    if (query.get("error")) toast(query.get("error"), true);
    if (query.get("paid")) {
      toast("付款成功，方案已延長 🎉");
      refreshMe().catch(() => {});
    }
    const fn = PAGES[page] || PAGES.home;
    const el = $("#page");
    el.oninput = el.onchange = el.onclick = null;
    document.body.classList.remove("focus-mode");
    try {
      await fn(el, args, query);
      window.scrollTo(0, 0);
    } catch (err) {
      if (err.message !== "未登入") {
        el.innerHTML = `<div class="page narrow"><div class="card"><div class="empty"><div class="ic">${icon("alert")}</div><h3>頁面載入失敗</h3><p>${esc(err.message)}</p><div class="row"><button class="btn" onclick="location.reload()">${icon("refresh")}重新整理</button></div></div></div></div>`;
      }
    }
  }
  window.addEventListener("hashchange", route);

  const pageHead = (title, desc, actions = "") =>
    `<div class="page-head"><div><h1>${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ""}</div>${actions ? `<div class="row">${actions}</div>` : ""}</div>`;
  const backLink = (href, label) => `<a class="back-link" href="${href}">${icon("left")}${esc(label)}</a>`;
  const empty = (ic, title, text, actions = "") =>
    `<div class="empty"><div class="ic">${icon(ic)}</div><h3>${esc(title)}</h3><p>${text}</p>${actions ? `<div class="row">${actions}</div>` : ""}</div>`;

  /* =========================================================
     Phone simulator
     - phoneShell(): 擬真手機外框（Messenger / Instagram 外觀）
     - script: [{kind:"ad"|"sys"|"user"|"bot"|"meta"|"delay", ...}]
     - mountPhone(): 可播放動畫、點按鈕 / 選項走分支、開啟網址預覽
     ========================================================= */
  const demoName = (s) => String(s || "").replace(/\{\{\s*(first_name|full_name)\s*\}\}/g, "小明").replace(/\{\{[^}]*\}\}/g, "");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const STATUS_ICONS = `<svg viewBox="0 0 18 12" width="17" height="11" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg viewBox="0 0 16 12" width="15" height="11" fill="currentColor" aria-hidden="true"><path d="M8 2.5c2.3 0 4.4.9 6 2.4l1.2-1.3C13.3 1.7 10.8.7 8 .7S2.7 1.7.8 3.6L2 4.9c1.6-1.5 3.7-2.4 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3C11.4 5 9.8 4.3 8 4.3S4.6 5 3.4 6.1l1.2 1.3C5.5 6.6 6.7 6.1 8 6.1zm0 3.5c.5 0 1 .2 1.3.5L8 11.5 6.7 10.1c.3-.3.8-.5 1.3-.5z"/></svg>
    <svg viewBox="0 0 27 12" width="25" height="12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor"/><path d="M24 4v4c.8-.3 1.3-1.1 1.3-2S24.8 4.3 24 4z" fill="currentColor" opacity=".45"/></svg>`;

  function phoneShell({ platform = "messenger", size = "", body = "" } = {}) {
    const name = esc(state.me?.user?.name || "你的品牌");
    const ig = platform === "instagram";
    return `<div class="device ${size} skin-${platform}">
      <div class="device-screen">
        <div class="status-bar"><span class="sb-time">9:41</span><span class="island"></span><span class="sb-icons">${STATUS_ICONS}</span></div>
        <div class="app-bar">
          <span class="ab-back">${icon("left")}</span>
          <div class="ab-avatar"><img src="/brand/mark.svg" alt=""/>${ig ? "" : '<i class="online"></i>'}</div>
          <div class="ab-who"><b>${name}</b><span data-sub>${ig ? "Instagram 商業帳號" : "通常會立即回覆"}</span></div>
          <span class="ab-icons">${icon("phone")}${icon("video")}</span>
        </div>
        <div class="chat" data-chat>${body}</div>
        <div class="composer"><span class="cp-btn">${icon("plus")}</span><span class="cp-input" data-ph>${ig ? "傳送訊息⋯" : "Aa"}</span><span class="cp-btn like">${ig ? icon("smile") : "👍"}</span></div>
        <div class="sheet" data-sheet aria-hidden="true"></div>
      </div>
    </div>`;
  }

  function renderEvent(ev) {
    switch (ev.kind) {
      case "ad":
        return `<div class="ad-ctx"><div class="ad-thumb">${icon("megaphone")}</div><div class="ad-tx"><b>${esc(ev.title || "你的 Facebook 廣告")}</b><span>贊助 · 點擊「傳送訊息」開啟對話</span></div></div>`;
      case "sys":
        return `<div class="chat-sys">${esc(ev.text)}</div>`;
      case "meta":
        return `<div class="chat-meta">${ev.icon ? icon(ev.icon) : ""}${esc(ev.text)}</div>`;
      case "user":
        return `<div class="msg out"><div class="bb">${esc(ev.text)}</div></div>`;
      case "bot": {
        const b = ev.bubble || {};
        const stepAttr = ev.step != null ? ` data-step="${ev.step}"` : "";
        if (b.image) return `<div class="msg in"${stepAttr}><span class="mav"><img src="/brand/mark.svg" alt=""/></span><div class="img-bb" style="background-image:url('${esc(b.image)}')">${b.image ? "" : icon("image")}</div></div>`;
        const text = esc(b.text || "").trim() || '<span class="ph">（訊息內容）</span>';
        const buttons = (b.buttons || []).map((x) => (typeof x === "string" ? { title: x, kind: "url" } : x));
        const quick = (b.quick || []).map((x) => (typeof x === "string" ? { title: x } : x));
        const bubble = buttons.length
          ? `<div class="bb card"><div class="tx">${text}</div>${buttons
              .map((x) => `<button type="button" class="cb" data-kind="${x.kind || "url"}" data-url="${esc(x.url || "")}" data-payload="${esc(x.payload || "")}" data-title="${esc(x.title || "")}">${esc(x.title || "按鈕")}${x.kind === "postback" ? "" : ""}</button>`)
              .join("")}</div>`
          : `<div class="bb">${text}</div>`;
        return `<div class="msg in"${stepAttr}><span class="mav"><img src="/brand/mark.svg" alt=""/></span>${bubble}</div>${
          quick.length ? `<div class="qr-row"${stepAttr}>${quick.map((q) => `<button type="button" class="qr" data-qr data-payload="${esc(q.payload || q.title || "")}" data-title="${esc(q.title || "")}">${esc(q.title || "選項")}</button>`).join("")}</div>` : ""
        }`;
      }
      default:
        return "";
    }
  }

  /** 舊版靜態預覽介面：{ sys, userText, bubbles } → 擬真手機 */
  function phoneMock({ sys, userText, bubbles, size = "sm", platform = "messenger" } = {}) {
    const script = [];
    if (sys && /廣告/.test(sys)) script.push({ kind: "ad" });
    else if (sys) script.push({ kind: "sys", text: sys });
    if (userText) script.push({ kind: "user", text: userText });
    for (const b of bubbles || []) script.push(b.meta ? { kind: "meta", text: b.meta } : { kind: "bot", bubble: b });
    if (!(bubbles || []).length) script.push({ kind: "meta", text: "還沒有回覆內容" });
    return phoneShell({ platform, size, body: script.map(renderEvent).join("") });
  }
  function graphMessagesToBubbles(messages) {
    return (messages || []).map((m) => {
      if (m.attachment?.type === "template") return { text: m.attachment.payload.text, buttons: (m.attachment.payload.buttons || []).map((b) => ({ title: b.title, kind: b.type === "postback" ? "postback" : "url", url: b.url })) };
      if (m.attachment?.type === "image") return { image: m.attachment.payload.url };
      return { text: m.text, quick: (m.quick_replies || []).map((q) => ({ title: q.title, payload: q.payload })) };
    });
  }

  /** 把自動回覆的步驟轉成手機劇本；goto 會展開成目標流程的內容 */
  function stepsToScript(steps, all = [], depth = 0) {
    const out = [];
    (steps || []).forEach((s, i) => {
      const step = depth === 0 ? i : null;
      switch (s.type) {
        case "text":
          out.push({ kind: "bot", step, bubble: { text: demoName(s.text) } });
          break;
        case "buttons":
          out.push({ kind: "bot", step, bubble: { text: demoName(s.text), buttons: (s.buttons || []).map((b) => ({ title: demoName(b.title), kind: b.type === "postback" ? "postback" : "url", url: b.url, payload: b.payload })) } });
          break;
        case "quick_replies":
          out.push({ kind: "bot", step, bubble: { text: demoName(s.text), quick: (s.replies || []).map((r) => ({ title: demoName(r.title), payload: r.payload || r.title })) } });
          break;
        case "image":
          out.push({ kind: "bot", step, bubble: { image: s.url } });
          break;
        case "delay":
          out.push({ kind: "delay", step, seconds: Number(s.seconds) || 0 });
          break;
        case "tag":
          if (s.tag) out.push({ kind: "meta", step, icon: "tag", text: `已幫客人加上標籤「${s.tag}」（客人看不到）` });
          break;
        case "goto": {
          const t = all.find((x) => x.id === Number(s.automation_id));
          if (t && depth < 4) out.push(...stepsToScript(t.steps, all, depth + 1));
          else out.push({ kind: "meta", step, text: "接續另一個自動回覆" });
          break;
        }
      }
    });
    return out;
  }
  function triggerScript(a) {
    const first = (a.trigger_value || "").split(/[,，]/)[0].trim();
    switch (a.trigger_type) {
      case "any_ad":
      case "ad":
      case "ref":
        return [{ kind: "ad" }];
      case "keyword":
        return [{ kind: "user", text: first || "關鍵字" }];
      case "get_started":
        return [{ kind: "sys", text: "新朋友開啟了對話" }, { kind: "user", text: "開始使用" }];
      case "default":
        return [{ kind: "user", text: "你好，想問一下" }];
      case "postback":
        return [{ kind: "user", text: "（點選了一個選項）" }];
      default:
        return [];
    }
  }
  /** 依 payload 找出對應的「按鈕回傳」自動回覆 */
  function branchScript(all, payload) {
    const t = all.find((x) => x.trigger_type === "postback" && x.trigger_value === payload);
    if (!t) return [{ kind: "meta", icon: "alert", text: "這個選項還沒有設定回覆" }];
    const s = stepsToScript(t.steps, all, 1);
    if (!t.enabled) s.unshift({ kind: "meta", text: `「${stripExample(t.name)}」尚未啟用，實際不會送出` });
    return s;
  }

  function mountPhone(host, { platform = "messenger", size = "", getAll = () => [] } = {}) {
    let pl = platform;
    let token = 0;
    host.innerHTML = phoneShell({ platform: pl, size });
    const chat = () => $("[data-chat]", host);
    const sheet = () => $("[data-sheet]", host);
    const scroll = () => { const c = chat(); c.scrollTop = c.scrollHeight; };
    async function run(script, my, append) {
      if (!append) chat().innerHTML = "";
      for (const ev of script) {
        if (my !== token) return;
        if (ev.kind === "bot" || ev.kind === "delay") {
          chat().insertAdjacentHTML("beforeend", '<div class="msg in typing"><span class="mav"><img src="/brand/mark.svg" alt=""/></span><div class="bb"><i></i><i></i><i></i></div></div>');
          scroll();
          await sleep(ev.kind === "delay" ? Math.min(ev.seconds, 4) * 600 + 300 : 700);
          $(".typing", chat())?.remove();
          if (my !== token) return;
          if (ev.kind === "delay") continue;
        } else await sleep(ev.kind === "ad" ? 150 : 350);
        if (my !== token) return; // 等待期間被新的播放或預覽取代
        chat().insertAdjacentHTML("beforeend", renderEvent(ev).replace(/class="(msg|qr-row|ad-ctx|chat-meta|chat-sys)/, 'class="pop $1'));
        scroll();
      }
    }
    const api = {
      setPlatform(p) {
        pl = p;
        const d = $(".device", host);
        d.className = d.className.replace(/skin-\w+/, `skin-${p}`);
        $("[data-sub]", host).textContent = p === "instagram" ? "Instagram 商業帳號" : "通常會立即回覆";
        $("[data-ph]", host).textContent = p === "instagram" ? "傳送訊息⋯" : "Aa";
      },
      show(script, highlight) {
        token++;
        api.closeSheet();
        chat().innerHTML = script.map(renderEvent).join("") || '<div class="chat-meta">還沒有回覆內容</div>';
        if (highlight != null) {
          const els = $$(`[data-step="${highlight}"]`, chat());
          els.forEach((e) => e.classList.add("hl"));
          els[0]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else scroll();
      },
      play(script) { api.closeSheet(); return run(script, ++token, false); },
      append(script) { return run(script, ++token, true); },
      stop() { token++; },
      closeSheet() { const s = sheet(); s.classList.remove("open"); s.setAttribute("aria-hidden", "true"); },
      openUrl(url) {
        const s = sheet();
        let hostName = url;
        try { hostName = new URL(url).hostname; } catch { /* ignore */ }
        s.innerHTML = `<div class="sh-bar"><button type="button" data-close-sheet>完成</button><span class="sh-url">${icon("lock")}${esc(hostName || "（尚未填寫網址）")}</span><span></span></div>
          <div class="sh-body"><div class="sh-hero"></div><div class="sk w80"></div><div class="sk w60"></div><div class="sk w90"></div>
          <div class="sh-note">${icon("external")}<div><b>客人會被帶到這個網址</b><span>${esc(url || "還沒有填寫網址")}</span></div></div></div>`;
        s.classList.add("open");
        s.setAttribute("aria-hidden", "false");
      },
    };
    host.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-sheet]")) return api.closeSheet();
      const qr = e.target.closest("[data-qr]");
      const btn = e.target.closest("[data-kind]");
      if (qr || btn?.dataset.kind === "postback") {
        const t = qr || btn;
        $$(".qr-row", chat()).forEach((r) => r.remove());
        api.append([{ kind: "user", text: t.dataset.title || "選項" }, ...branchScript(getAll(), t.dataset.payload)]);
      } else if (btn) api.openUrl(btn.dataset.url);
    });
    return api;
  }

  /* =========================================================
     Home / onboarding
     ========================================================= */
  /** 步驟列：steps = [{ label, done }]，cur = 目前步驟（0 起算）；canGo(i) 決定能不能點 */
  const stepper = (steps, cur, canGo = () => false) =>
    `<div class="steps-bar" role="list">${steps
      .map((st, i) => `${i ? `<span class="line ${steps[i - 1].done || i <= cur ? "done" : ""}"></span>` : ""}<button type="button" role="listitem" class="st ${i === cur ? "cur" : st.done ? "done" : ""}" ${canGo(i) && i !== cur ? `data-go="${i}"` : "disabled"} ${i === cur ? 'aria-current="step"' : ""}><span class="n">${st.done && i !== cur ? icon("check") : i + 1}</span><span class="lb">${esc(st.label)}</span></button>`)
      .join("")}</div>`;
  /** 手機欄：情境說明 + 手機 + 外觀切換 / 重播 */
  const phoneCol = (id, caption = "") =>
    `<div class="wiz-phone"><div class="phone-cap" id="${id}-cap">${caption}</div><div id="${id}"></div>
      <div class="phone-ctl"><div class="seg sm" id="${id}-skin"><button type="button" data-skin="messenger" class="on">Messenger</button><button type="button" data-skin="instagram">Instagram</button></div><button type="button" class="btn btn-sm btn-ghost" id="${id}-replay">${icon("refresh")}重播</button></div></div>`;
  function wirePhone(id, phone, replay) {
    $(`#${id}-replay`).onclick = replay;
    $(`#${id}-skin`).onclick = (e) => {
      const k = e.target.closest("[data-skin]")?.dataset.skin;
      if (!k) return;
      phone.setPlatform(k);
      $$(`#${id}-skin button`).forEach((b) => b.classList.toggle("on", b.dataset.skin === k));
    };
  }
  const DEMO_AD = { trigger_type: "any_ad", trigger_value: "", steps: [{ type: "buttons", text: "嗨 {{first_name}} 👋 謝謝你對我們的廣告有興趣！\n現在下單享首購 9 折，點下方按鈕直接選購 👇", buttons: [{ type: "url", title: "立即選購", url: "" }] }] };

  /* =========================================================
     Home / onboarding：一次只顯示「現在要做的那一步」
     ========================================================= */
  PAGES.home = async (el) => {
    const [o, list] = await Promise.all([api("/overview"), api("/automations").catch(() => [])]);
    state.overview = o;
    const s = o.stats;
    const mine = list.filter((a) => !a.is_example);
    const live = mine.find((a) => a.enabled) || mine[0];
    const adDone = !!store.get(ukey("ad_done"));
    const steps = [
      { label: "連接粉絲專頁", done: o.channels.length > 0 },
      { label: "建立自動回覆", done: mine.length > 0 },
      { label: "投放訊息廣告", done: adDone },
    ];
    const cur = steps.findIndex((t) => !t.done);
    const allDone = cur === -1;
    const greeting = state.me.user.name ? `嗨，${esc(state.me.user.name)}` : "歡迎";
    const ownerBanner = isOwner() && (!o.app_configured || !o.payuni_configured)
      ? `<div class="banner brand">${icon("sliders")}<div class="grow"><b>還有平台設定沒完成。</b> ${!o.app_configured ? "完成 Meta App 設定後，用戶才能連接粉絲專頁。" : "完成 PayUni 設定後，用戶才能線上付款。"}</div><a class="btn btn-sm btn-primary" href="#setup">前往設定</a></div>`
      : "";

    if (allDone) {
      el.innerHTML = `<div class="page">
        ${pageHead(greeting, "一切就緒，自動回覆正在運作。", `<a class="btn" href="#automations">${icon("zap")}管理自動回覆</a>`)}
        ${ownerBanner}${subBanner()}${healthBanner(o)}
        <div class="stack">
          <div class="grid-4">
            ${stat("今日新聯絡人", num(s.contacts_today))}
            ${stat("來自廣告的聯絡人", num(s.contacts_from_ads))}
            ${stat("自動回覆次數", num(s.triggered))}
            ${stat("導購連結點擊", num(s.link_clicks))}
          </div>
          ${o.platform ? `<div class="card"><div class="card-head"><div><h3>平台概況</h3><p>所有用戶的總計</p></div><a class="btn btn-sm" href="#admin-users">查看用戶</a></div><div class="stat-row">${statPlain("註冊用戶", num(o.platform.users))}${statPlain("付費中用戶", num(o.platform.paying_users))}${statPlain("累計營收", money(o.platform.revenue))}${statPlain("已連接頻道", num(o.platform.channels))}</div></div>` : ""}
        </div>
      </div>`;
      return;
    }

    const connectAction = o.app_configured
      ? `<a class="btn btn-fb btn-lg" href="/auth/facebook">${icon("facebook")}連接 Facebook</a>`
      : isOwner()
        ? `<a class="btn btn-primary btn-lg" href="#setup/meta">先完成平台設定</a>`
        : `<span class="badge warning">等待平台管理員完成設定</span>`;
    const NOW = [
      {
        title: "連接你的 Facebook 粉絲專頁",
        desc: "用 Facebook 登入，選擇要自動回覆的專頁。有綁定的 Instagram 會一起連上。",
        action: connectAction,
        alt: steps[1].done ? "" : `<a href="#automations/new">先跳過，直接建立自動回覆 →</a>`,
        cap: "連接後，客人點了你的廣告就會看到這個畫面",
        a: live || DEMO_AD,
      },
      {
        title: "建立第一個自動回覆",
        desc: "寫一句歡迎詞、放上要導去的網址，大約 2 分鐘。",
        action: `<a class="btn btn-primary btn-lg" href="#automations/new">${icon("plus")}開始建立</a>`,
        alt: "",
        cap: "像這樣：客人點廣告 → 立刻收到回覆 → 點按鈕到你的網站",
        a: DEMO_AD,
      },
      {
        title: "投放「訊息」目標的廣告",
        desc: live && AD_TRIGGER(live.trigger_type)
          ? `到廣告管理員建立 <b>互動 → 訊息</b> 目標的廣告。先取得廣告 JSON 貼進廣告，客人一點廣告就會直接看到你的訊息。`
          : `到廣告管理員建立 <b>互動 → 訊息</b> 目標的廣告，訊息應用程式選 Messenger 或 Instagram。`,
        action: `${live && AD_TRIGGER(live.trigger_type) ? `<button class="btn btn-primary btn-lg" id="task-json">${icon("code")}取得廣告 JSON</button><a class="btn btn-lg" href="https://adsmanager.facebook.com/" target="_blank" rel="noopener">${icon("external")}開啟廣告管理員</a>` : `<a class="btn btn-primary btn-lg" href="https://adsmanager.facebook.com/" target="_blank" rel="noopener">${icon("external")}開啟廣告管理員</a>`}<button class="btn btn-lg" id="task-ad">${icon("check")}我已完成</button>`,
        alt: "",
        cap: live ? `廣告上線後，客人會收到「${esc(stripExample(live.name))}」` : "",
        a: live || DEMO_AD,
      },
    ][cur];

    el.innerHTML = `<div class="page">
      ${pageHead(greeting, "跟著 3 個步驟，大約 5 分鐘就能上線。")}
      ${ownerBanner}${subBanner()}${healthBanner(o)}
      ${stepper(steps, cur)}
      <div class="wiz">
        <div class="wiz-main">
          <div class="eyebrow">現在要做 · 第 ${cur + 1} 步，共 3 步</div>
          <h2 class="wiz-title">${NOW.title}</h2>
          <p class="wiz-desc">${NOW.desc}</p>
          <div class="row" style="margin-top:24px">${NOW.action}</div>
          ${NOW.alt ? `<p class="small" style="margin-top:16px">${NOW.alt}</p>` : ""}
        </div>
        ${phoneCol("home-phone", NOW.cap)}
      </div>
    </div>`;
    const phone = mountPhone($("#home-phone"), { size: "md", getAll: () => list });
    const play = () => phone.play([...triggerScript(NOW.a), ...stepsToScript(NOW.a.steps, list)]);
    wirePhone("home-phone", phone, play);
    play();
    $("#task-ad") && ($("#task-ad").onclick = () => { store.set(ukey("ad_done"), true); PAGES.home(el); });
    $("#task-json") && ($("#task-json").onclick = () => openAdJson(live));
  };
  const stat = (k, v) => `<div class="card stat"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
  const statPlain = (k, v) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
  function subBanner() {
    const sub = state.me.user.subscription;
    if (sub.source === "expired" || sub.source === "none")
      return `<div class="banner danger">${icon("alert")}<div class="grow"><b>方案已到期，自動回覆已暫停。</b> 客人的訊息仍會被記錄，續約後立即恢復。</div><a class="btn btn-sm btn-primary" href="#billing">立即續約</a></div>`;
    if (sub.source === "trial" && sub.days_left <= 3)
      return `<div class="banner warning">${icon("info")}<div class="grow">免費試用剩 <b>${sub.days_left} 天</b>，升級後自動回覆不會中斷。</div><a class="btn btn-sm" href="#billing">查看方案</a></div>`;
    if (sub.source === "paid" && sub.days_left <= 7)
      return `<div class="banner warning">${icon("info")}<div class="grow">方案將於 <b>${fmtDate(sub.until)}</b> 到期。</div><a class="btn btn-sm" href="#billing">續約</a></div>`;
    return "";
  }

  /** 連線失效、和專頁原本的自動回覆衝突時的提醒 */
  function healthBanner(o) {
    const broken = (o.channels || []).filter((c) => c.status === "broken");
    if (broken.length)
      return `<div class="banner danger">${icon("alert")}<div class="grow"><b>${broken.map((c) => esc(c.name)).join("、")} 的連線失效了，</b>自動回覆送不出去。重新連接 Facebook 就會恢復。</div><a class="btn btn-sm btn-primary" href="/auth/facebook">${icon("facebook")}重新連接</a></div>`;
    if (o.conflicts_7d > 0 && !store.get(ukey("conflict_ack")))
      return `<div class="banner warning">${icon("info")}<div class="grow"><b>客人收到了兩則回覆。</b> 最近 7 天有 ${o.conflicts_7d} 次，專頁原本的自動回覆也同時回覆了客人。到 Meta 商業套件關掉「即時回覆」就不會重複。</div><a class="btn btn-sm" href="${BIZ_AUTOMATIONS}" target="_blank" rel="noopener">${icon("external")}前往關閉</a><button class="btn btn-sm btn-ghost icon-btn" data-ack-conflict aria-label="知道了">${icon("x")}</button></div>`;
    return "";
  }
  const BIZ_AUTOMATIONS = "https://business.facebook.com/latest/inbox/automations";
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ack-conflict]");
    if (!b) return;
    store.set(ukey("conflict_ack"), true);
    b.closest(".banner")?.remove();
  });

  /** 讓客人一點廣告就看到這則訊息：產生 Messenger 廣告的 JSON */
  async function openAdJson(a, onChange) {
    let r;
    try {
      r = await api(`/automations/${a.id}/ad-json`);
    } catch (err) {
      return toast(err.message, true);
    }
    const text = JSON.stringify(r.json, null, 2);
    const m = modal({
      title: "放進廣告：客人一點就看到",
      body: `<p class="muted" style="margin-bottom:16px">把「${esc(stripExample(a.name))}」的第一則訊息直接放進 Messenger 廣告。客人點廣告打開對話，馬上就看到訊息和前往網址的按鈕，不用先傳訊息。</p>
        <ol class="guide compact">
          <li><div><b>複製這段 JSON</b>${copyBlock(text)}</div></li>
          <li><div><b>貼到廣告裡</b><p class="muted small">在廣告管理員編輯廣告（目標選「互動 → 訊息 → Messenger」），到廣告層級的「訊息範本」→「建立」→ 設定方式選 <b>JSON</b>，貼上後發布。部分版面的 JSON 選項在「進階選項」裡。</p></div></li>
          <li><div><b>打開這個開關</b><label class="row" style="gap:10px;cursor:pointer;margin-top:6px"><span class="switch"><input type="checkbox" id="aj-on" ${r.ad_json ? "checked" : ""}/><span class="slider"></span></span><span class="small">已經放進廣告了：客人從廣告進來時，<b>不要再重複送出</b>第一則訊息（標籤和後續訊息照常）</span></label></div></li>
        </ol>
        ${r.warnings.length ? `<div class="note warn">${r.warnings.map((w) => `<div>${icon("info")}<span>${esc(w)}</span></div>`).join("")}</div>` : ""}
        <p class="small muted" style="margin-top:12px">之後修改這則訊息，記得重新複製 JSON 更新廣告。Instagram 廣告不支援 JSON，會照原本方式自動回覆。</p>`,
      foot: `<a class="btn" href="https://adsmanager.facebook.com/" target="_blank" rel="noopener">${icon("external")}開啟廣告管理員</a><button class="btn btn-primary" data-close>完成</button>`,
    });
    $("#aj-on", m.el).onchange = async (e) => {
      try {
        await api(`/automations/${a.id}/ad-json`, { method: "PATCH", body: { enabled: e.target.checked } });
        toast(e.target.checked ? "已設定：客人從廣告進來不會重複收到第一則訊息" : "已關閉");
        onChange?.(e.target.checked);
      } catch (err) {
        e.target.checked = !e.target.checked;
        toast(err.message, true);
      }
    };
  }
  const AD_TRIGGER = (t) => t === "any_ad" || t === "ad" || t === "ref";

  /** 從廣告帳號挑選廣告（需要另外允許讀取廣告） */
  async function openAdPicker(selected, onPick, returnHash) {
    const m = modal({ title: "選擇廣告", body: `<div class="muted small" id="ap-body"><span class="spinner"></span> 讀取廣告中…</div>`, foot: `<button class="btn" data-close>取消</button><button class="btn btn-primary" id="ap-ok" disabled>使用選取的廣告</button>` });
    let r;
    try {
      r = await api("/meta/ads");
    } catch (err) {
      $("#ap-body", m.el).innerHTML = `<div class="result-err">${icon("alert")}<span>${esc(err.message)}</span></div>`;
      return;
    }
    if (!r.authorized) {
      $("#ap-body", m.el).innerHTML = `<div class="stack-sm"><p>${r.expired ? "Facebook 授權已過期，" : ""}要先允許讀取你的廣告清單，才能直接挑選廣告（只會讀取廣告名稱、ID 和狀態）。</p>
        <p class="small muted">按下後會開啟 Facebook，允許後自動回到這裡，你填到一半的內容會保留。</p></div>`;
      $("#ap-ok", m.el).outerHTML = `<button class="btn btn-fb" id="ap-auth">${icon("facebook")}允許讀取廣告</button>`;
      $("#ap-auth", m.el).onclick = () => {
        onPick(null);
        location.href = `/auth/facebook?ads=1&return=${encodeURIComponent(returnHash)}`;
      };
      return;
    }
    const chosen = new Set(selected);
    const STATUS = { ACTIVE: ["投放中", "success"], PAUSED: ["已暫停", ""], CAMPAIGN_PAUSED: ["行銷活動暫停", ""], ADSET_PAUSED: ["廣告組合暫停", ""], PENDING_REVIEW: ["審查中", "info"], IN_PROCESS: ["處理中", "info"], WITH_ISSUES: ["有問題", "warning"] };
    const draw = (q = "") => {
      const list = r.ads.filter((a) => !q || `${a.name} ${a.campaign || ""} ${a.id}`.toLowerCase().includes(q.toLowerCase()));
      $("#ap-list", m.el).innerHTML = list.length
        ? list.map((a) => `<label class="ad-pick ${chosen.has(a.id) ? "on" : ""}"><input type="checkbox" value="${esc(a.id)}" ${chosen.has(a.id) ? "checked" : ""}/>
            <span class="grow"><b>${esc(a.name)}</b><span class="small muted">${esc(a.campaign || a.account)} · ID ${esc(a.id)}</span></span>
            ${a.contacts ? `<span class="small muted nowrap">帶來 ${num(a.contacts)} 位</span>` : ""}<span class="badge ${STATUS[a.status]?.[1] ?? ""}">${STATUS[a.status]?.[0] ?? esc(a.status)}</span></label>`).join("")
        : `<p class="small muted">${r.ads.length ? "找不到符合的廣告" : "你的廣告帳號裡還沒有廣告。"}</p>`;
      $$("#ap-list input", m.el).forEach((i) => (i.onchange = () => { i.checked ? chosen.add(i.value) : chosen.delete(i.value); i.closest(".ad-pick").classList.toggle("on", i.checked); $("#ap-ok", m.el).disabled = !chosen.size; }));
    };
    $("#ap-body", m.el).outerHTML = `<div class="stack-sm"><div class="input-icon">${icon("search")}<input class="input" id="ap-q" placeholder="搜尋廣告名稱或 ID"/></div><div class="ad-pick-list" id="ap-list"></div></div>`;
    $("#ap-q", m.el).oninput = (e) => draw(e.target.value);
    $("#ap-ok", m.el).disabled = !chosen.size;
    $("#ap-ok", m.el).onclick = () => { onPick([...chosen]); m.close(); };
    draw();
  }

  /* =========================================================
     Automations
     ========================================================= */
  const TRIGGERS = {
    any_ad: { t: "任何廣告點擊", d: "從任何一支訊息廣告點進來的人", tag: "推薦" },
    ad: { t: "指定廣告", d: "只回應特定的廣告 ID", needs: "廣告 ID", ph: "例如 120211234567890，多個用逗號分隔", help: "在廣告管理員的廣告層級可以看到廣告 ID。" },
    ref: { t: "廣告參數 ref", d: "依廣告裡設定的 ref 分流", needs: "ref 值", ph: "例如 spring_sale", help: "在廣告的「訊息範本 → 進階選項 → 參數」填入相同的值。" },
    keyword: { t: "關鍵字", d: "訊息裡包含特定字詞", needs: "關鍵字", ph: "例如 價格, 多少錢, 優惠", help: "不分大小寫，多個用逗號分隔。" },
    get_started: { t: "首次開啟對話", d: "新朋友按下「開始使用」" },
    default: { t: "其他所有訊息", d: "沒有命中其他規則時的預設回覆" },
    postback: { t: "按鈕回傳", d: "客人按下帶 payload 的按鈕", needs: "payload", ph: "例如 WANT_PRICE", help: "需和按鈕設定的 payload 完全相同。" },
  };
  const triggerSummary = (a) => {
    const T = TRIGGERS[a.trigger_type];
    return `${esc(T?.t || a.trigger_type)}${a.trigger_value ? `<span class="muted">：${esc(a.trigger_value)}</span>` : ""}`;
  };

  /* ---- guidance content ---- */
  const TRIGGER_EXAMPLES = {
    any_ad: { scene: "你投放了一支「秋季新品 8 折」的訊息廣告。有人按下廣告上的「傳送訊息」，Messenger 一打開就會收到這則回覆。", tip: "只跑一支廣告，或所有廣告都導到同一頁時，選這個最簡單。" },
    ad: { scene: "你同時跑「咖啡豆」和「濾掛包」兩支廣告，想把客人分別帶到不同的商品頁。", tip: "廣告 ID 在廣告管理員 → 廣告層級的「廣告 ID」欄位，可以多個用逗號分開。" },
    ref: { scene: "你在「講座報名」廣告的訊息範本裡設定參數 event_signup，這裡就填 event_signup。", tip: "比廣告 ID 好管理：之後換新廣告，只要沿用同一個 ref 就不用改這裡。" },
    keyword: { scene: "客人傳「請問多少錢？」，因為裡面有「多少錢」，就會自動回覆價格頁。", tip: "多放幾種常見說法，用逗號分開。" },
    get_started: { scene: "第一次私訊你的新朋友，按下「開始使用」時收到。從廣告進來的人會優先收到廣告的回覆。", tip: "" },
    default: { scene: "客人傳的訊息都沒有符合其他規則時送出，例如「收到囉！我們會盡快回覆你」。", tip: "一個帳號只需要設定一個。" },
  };
  const USE_CASES = [
    { k: "shop", t: "電商導購", msg: "嗨 {{first_name}} 👋 謝謝你對我們的商品有興趣！\n現在下單享首購 9 折，點下方按鈕直接選購 👇", btn: "立即選購" },
    { k: "consult", t: "預約諮詢", msg: "{{first_name}} 你好！想了解更多細節嗎？\n留下資料，專人會在 24 小時內聯絡你 😊", btn: "預約免費諮詢" },
    { k: "event", t: "活動報名", msg: "嗨 {{first_name}}，名額有限！\n點下方按鈕完成報名，我們會寄送行前通知給你 📩", btn: "立即報名" },
    { k: "coupon", t: "領取優惠", msg: "🎁 {{first_name}}，這是給你的專屬優惠！\n點下方按鈕領取，限時 3 天有效。", btn: "領取優惠券" },
    { k: "download", t: "免費下載", msg: "謝謝 {{first_name}}！你要的資料在這裡 👇\n有任何問題都可以直接回覆這則訊息。", btn: "免費下載" },
    { k: "line", t: "導到 LINE", msg: "想更快收到回覆嗎？\n加入我們的 LINE 官方帳號，專人一對一服務 💬", btn: "加入 LINE" },
  ];
  const BUTTON_IDEAS = ["立即選購", "了解更多", "預約諮詢", "立即報名", "領取優惠", "加入 LINE"];
  const UTM = "utm_source=meta&utm_medium=messenger&utm_campaign=auto_reply";
  const stripExample = (name) => String(name || "").replace(/^【範例】/, "");
  const smallIcon = (n) => icon(n).replace("<svg", '<svg style="width:14px;height:14px;vertical-align:-2px;flex:none"');

  let previewAll = [];
  function previewModal(a) {
    modal({
      title: stripExample(a.name),
      size: "sm",
      body: `<p class="small muted" style="margin-bottom:12px">觸發條件：${triggerSummary(a)}。可以點手機裡的按鈕和選項試試看。</p><div id="pv-phone"></div>`,
      foot: `<button class="btn" data-close>關閉</button><button class="btn" id="pv-replay">${icon("refresh")}重播</button><a class="btn" href="#automations/flow/${a.id}">${icon("workflow")}視覺編輯</a><a class="btn btn-primary" href="#automations/edit/${a.id}">使用這個範例</a>`,
    });
    const ph = mountPhone($("#pv-phone"), { size: "md", getAll: () => previewAll });
    const run = () => ph.play([...triggerScript(a), ...stepsToScript(a.steps, previewAll)]);
    $("#pv-replay").onclick = run;
    run();
  }

  PAGES.automations = async (el, args, query) => {
    if (args[0] === "new") return renderEditor(el, { template: args[1] || "ad", restore: query?.get("ads") === "granted" });
    if (args[0] === "edit" && args[1] && query?.get("ads") === "granted") return renderEditor(el, { id: Number(args[1]), restore: true });
    if (args[0] === "edit" && args[1]) return renderEditor(el, { id: Number(args[1]), advanced: args[2] === "advanced" });
    if (args[0] === "flow" && args[1]) return renderEditor(el, { id: Number(args[1]), advanced: true });

    const [list, o] = await Promise.all([api("/automations"), api("/overview")]);
    state.overview = o;
    previewAll = list;
    const mine = list.filter((a) => !a.is_example);
    const examples = list.filter((a) => a.is_example).sort((x, y) => x.id - y.id);
    const exampleRows = examples
      .map(
        (a) => `<div class="ex-row">
          <div class="ex-main"><b>${esc(stripExample(a.name))}</b><div class="small muted">${triggerSummary(a)}</div></div>
          <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-preview="${a.id}">${icon("play")}看情境</button><a class="btn btn-sm" href="#automations/edit/${a.id}">使用</a><button class="btn btn-ghost btn-sm icon-btn btn-danger" data-del="${a.id}" aria-label="刪除範例">${icon("trash")}</button></div>
        </div>`,
      )
      .join("");
    el.innerHTML = `<div class="page">
      ${pageHead("自動回覆", "客人點廣告或傳訊息時，自動送出的內容。", mine.length ? `<button class="btn" id="open-test">${icon("play")}測試</button><a class="btn btn-primary" href="#automations/new">${icon("plus")}新增</a>` : "")}
      ${subBanner()}
      ${healthBanner(o)}
      ${o.channels.length === 0 && mine.length ? `<div class="banner info">${icon("info")}<div class="grow">還沒連接粉絲專頁，自動回覆要連接後才會生效。</div><a class="btn btn-sm" href="#connections">連接帳號</a></div>` : ""}
      ${mine.length
        ? `<div class="stack">
          <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>名稱</th><th>什麼時候回覆</th><th class="nowrap">已觸發</th><th>啟用</th><th></th></tr></thead><tbody>
          ${mine
            .map(
              (a) => `<tr>
              <td class="primary-cell"><a href="#automations/edit/${a.id}" style="color:inherit">${esc(a.name)}</a>${a.platform !== "any" ? ` ${platformBadge(a.platform)}` : ""}${a.ad_json ? ' <span class="badge brand" title="第一則訊息已放進 Messenger 廣告">已放進廣告</span>' : ""}</td>
              <td>${triggerSummary(a)}</td>
              <td>${num(a.triggered_count)} 次</td>
              <td><label class="switch" title="${a.enabled ? "已啟用" : "已停用"}"><input type="checkbox" data-toggle="${a.id}" ${a.enabled ? "checked" : ""} aria-label="啟用 ${esc(a.name)}"/><span class="slider"></span></label></td>
              <td class="actions">${AD_TRIGGER(a.trigger_type) ? `<button class="btn btn-ghost btn-sm" data-adjson="${a.id}" title="讓客人一點廣告就看到這則訊息">${icon("code")}廣告 JSON</button>` : ""}<a class="btn btn-ghost btn-sm" href="#automations/edit/${a.id}">${icon("edit")}編輯</a><a class="btn btn-ghost btn-sm icon-btn" href="#automations/flow/${a.id}" title="在視覺流程編輯器開啟" aria-label="視覺流程編輯器">${icon("workflow")}</a><button class="btn btn-ghost btn-sm btn-danger icon-btn" data-del="${a.id}" aria-label="刪除">${icon("trash")}</button></td>
            </tr>`,
            )
            .join("")}</tbody></table></div></div>
          ${examples.length ? `<details class="adv"><summary>${icon("right")}參考範例（${examples.length}）</summary><div class="card" style="margin-top:12px">${exampleRows}</div></details>` : ""}
          </div>`
        : `<div class="wiz">
            <div class="wiz-main">
              <div class="eyebrow">第一步</div>
              <h2 class="wiz-title">建立你的第一個自動回覆</h2>
              <p class="wiz-desc">選什麼時候回覆、寫訊息放網址、確認上線。3 個步驟，大約 2 分鐘。</p>
              <div class="row" style="margin-top:24px"><a class="btn btn-primary btn-lg" href="#automations/new">${icon("plus")}開始建立</a></div>
              ${examples.length ? `<div class="section-title" style="margin-top:40px">或從範例改起</div><p class="section-desc" style="margin-bottom:10px">範例不會自動回覆，改成你的內容後才會啟用。</p><div class="card">${exampleRows}</div>` : ""}
            </div>
            ${phoneCol("list-phone", "客人點廣告 → 立刻收到回覆 → 點按鈕到你的網站")}
          </div>`}
    </div>`;
    if (!mine.length) {
      const phone = mountPhone($("#list-phone"), { size: "md", getAll: () => list });
      let cur = examples[0] || DEMO_AD;
      const play = () => phone.play([...triggerScript(cur), ...stepsToScript(cur.steps, list)]);
      wirePhone("list-phone", phone, play);
      play();
      // 在空狀態下「看情境」直接播在旁邊的手機
      $$("[data-preview]", el).forEach((b) => (b.onclick = () => {
        cur = list.find((a) => a.id === Number(b.dataset.preview));
        $("#list-phone-cap").textContent = `情境：${stripExample(cur.name)}`;
        $$(".ex-row", el).forEach((r) => r.classList.toggle("on", r.contains(b)));
        play();
        if (window.innerWidth <= 1000) $("#list-phone").scrollIntoView({ behavior: "smooth", block: "center" });
      }));
    } else $$("[data-preview]", el).forEach((b) => (b.onclick = () => previewModal(list.find((a) => a.id === Number(b.dataset.preview)))));
    $("#open-test") && ($("#open-test").onclick = () => openTestModal());
    const reload = () => PAGES.automations(el, [], new URLSearchParams());
    $$("[data-adjson]", el).forEach((b) => (b.onclick = () => openAdJson(list.find((a) => a.id === Number(b.dataset.adjson)), reload)));
    const autoJson = Number(query?.get("adjson"));
    if (autoJson && mine.some((a) => a.id === autoJson)) {
      history.replaceState(null, "", "#automations");
      openAdJson(mine.find((a) => a.id === autoJson), reload);
    }
    $$("[data-toggle]", el).forEach((inp) => {
      inp.onchange = async () => {
        try {
          await api(`/automations/${inp.dataset.toggle}/enabled`, { method: "PATCH", body: { enabled: inp.checked } });
          toast(inp.checked ? "已啟用" : "已停用");
        } catch (err) {
          inp.checked = !inp.checked;
          toast(err.message, true);
        }
      };
    });
    $$("[data-del]", el).forEach((b) => {
      b.onclick = async () => {
        const a = list.find((x) => x.id === Number(b.dataset.del));
        if (!(await confirmDialog(a.is_example ? "刪除範例" : "刪除自動回覆", `確定刪除「${stripExample(a.name)}」？這個動作無法復原。`, "刪除", true))) return;
        await api(`/automations/${a.id}`, { method: "DELETE" });
        toast("已刪除");
        reload();
      };
    });
  };

  /** 新增時依觸發條件預先填好的內容 */
  const TEMPLATES = {
    ad: { name: "廣告點擊自動回覆", trigger_type: "any_ad", message: USE_CASES[0].msg, buttons: [{ title: USE_CASES[0].btn, url: "" }], tag: "廣告名單" },
    keyword: { name: "詢問價格", trigger_type: "keyword", trigger_value: "價格, 多少錢, 費用", message: "{{first_name}} 你好！所有方案與價格都整理在這裡 👇", buttons: [{ title: "查看價格", url: "" }], tag: "" },
    welcome: { name: "歡迎訊息", trigger_type: "get_started", message: "歡迎 {{first_name}}！我們是 {{brand}}，有任何問題都可以直接留言 😊", buttons: [], tag: "" },
    fallback: { name: "預設回覆", trigger_type: "default", message: "收到你的訊息囉！我們會盡快回覆你 😊", buttons: [], tag: "" },
  };
  const TEMPLATE_FOR = { any_ad: "ad", ad: "ad", ref: "ad", keyword: "keyword", get_started: "welcome", default: "fallback" };
  const fromTemplate = (k) => {
    const d = JSON.parse(JSON.stringify(TEMPLATES[k]));
    d.message = d.message.replace("{{brand}}", state.me.user.name || "我們");
    return { enabled: 1, priority: k === "ad" ? 10 : 0, platform: "any", trigger_value: "", ...d };
  };

  /* ---- simple <-> automation mapping ---- */
  function simpleToAutomation(f) {
    const steps = [];
    const buttons = f.buttons.filter((b) => b.title.trim() || b.url.trim());
    if (buttons.length) steps.push({ type: "buttons", text: f.message, buttons: buttons.map((b) => ({ type: "url", title: b.title.trim(), url: b.url.trim(), track: true })) });
    else steps.push({ type: "text", text: f.message });
    if (f.tag.trim()) steps.push({ type: "tag", tag: f.tag.trim() });
    return {
      name: stripExample(f.name).trim() || TRIGGERS[f.trigger_type].t,
      enabled: f.enabled,
      priority: f.priority,
      platform: f.platform,
      channel_id: null,
      trigger_type: f.trigger_type,
      trigger_value: TRIGGERS[f.trigger_type].needs ? f.trigger_value.trim() : "",
      steps,
    };
  }
  function automationToSimple(a) {
    const tags = a.steps.filter((s) => s.type === "tag");
    const rest = a.steps.filter((s) => s.type !== "tag");
    if (tags.length > 1 || rest.length !== 1 || a.channel_id || a.trigger_type === "postback") return null;
    const s = rest[0];
    if (s.type === "buttons" && s.buttons.some((b) => b.type !== "url")) return null;
    if (s.type !== "text" && s.type !== "buttons") return null;
    return {
      id: a.id,
      name: a.name,
      enabled: a.enabled ? 1 : 0,
      priority: a.priority,
      platform: a.platform,
      trigger_type: a.trigger_type,
      trigger_value: a.trigger_value,
      message: s.text,
      buttons: s.type === "buttons" ? s.buttons.map((b) => ({ title: b.title, url: b.url })) : [],
      tag: tags[0]?.tag || "",
    };
  }

  async function renderEditor(el, { id, template, advanced, restore }) {
    let a = null;
    if (id) a = await api(`/automations/${id}`);
    let simple = null;
    if (a && !advanced) simple = automationToSimple(a);
    if (!a && template !== "blank") simple = fromTemplate(TEMPLATES[template] ? template : "ad");
    // 從 Facebook 授權回來：還原填到一半的內容並打開廣告挑選器
    const draft = restore ? sessionGet("wizard_draft") : null;
    if (draft && simple && (draft.id || null) === (simple.id || null)) {
      Object.assign(simple, draft.f);
      simple._openPicker = true;
    }
    sessionDel("wizard_draft");
    if (simple) return renderSimpleEditor(el, simple, a);
    const adv = a ? JSON.parse(JSON.stringify(a)) : { name: "", enabled: 1, priority: 0, platform: "any", channel_id: null, trigger_type: "any_ad", trigger_value: "", steps: [{ type: "text", text: "" }] };
    return renderFlowBuilder(el, adv);
  }

  /* ---- 3 步驟精靈：什麼時候回覆 → 回覆什麼 → 確認上線 ---- */
  const splitIds = (v) => String(v || "").split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
  const TRIGGER_MAIN = ["any_ad", "keyword", "get_started"];
  const TRIGGER_MORE = ["ad", "ref", "default"];
  const TRIGGER_ASK = { any_ad: "有人點了我的廣告", keyword: "客人傳了特定字詞", get_started: "新朋友第一次私訊", ad: "只回應某一支廣告", ref: "依廣告參數 ref 分流", default: "其他所有訊息" };
  const WIZ_STEPS = ["什麼時候回覆", "回覆什麼", "確認上線"];

  async function renderSimpleEditor(el, f, original) {
    const isNew = !f.id;
    const isExample = !!original?.is_example;
    const fresh = isNew || isExample;
    if (!f.buttons) f.buttons = [];
    const o = state.overview || (await api("/overview").catch(() => ({ channels: [] })));
    let step = fresh ? 0 : 1;
    let reached = fresh ? 0 : 2;
    const showErr = [false, false];
    let autoMsg = isNew ? f.message : null; // 還是範本內容時，換觸發條件會一起換文案
    let autoName = isNew ? f.name : null;

    el.innerHTML = `<div class="page">
      ${backLink("#automations", "自動回覆")}
      ${isExample ? `<div class="banner brand">${icon("book")}<div class="grow"><b>這是範例，目前不會自動回覆。</b> 改成你的內容後按「使用並啟用」。</div></div>` : ""}
      <div id="w-stepper"></div>
      <div class="wiz">
        <div class="wiz-main" id="w-main"></div>
        <div class="wiz-foot" id="w-foot"></div>
        ${phoneCol("w-phone")}
      </div></div>`;

    /* ---- 手機 ---- */
    const phone = mountPhone($("#w-phone"), { size: "md" });
    const script = () => { const x = simpleToAutomation(f); return [...triggerScript(x), ...stepsToScript(x.steps)]; };
    let showTimer;
    const play = () => { clearTimeout(showTimer); phone.play(script()); };
    const preview = () => { clearTimeout(showTimer); showTimer = setTimeout(() => phone.show(script()), 250); };
    const caption = () => ($("#w-phone-cap").innerHTML = `<b>情境</b>${esc(TRIGGER_EXAMPLES[f.trigger_type]?.scene || "")}`);
    wirePhone("w-phone", phone, play);

    /* ---- 檢查 ---- */
    const errors = (i) => {
      const e = {};
      if (i === 0) {
        const T = TRIGGERS[f.trigger_type];
        if (T.needs && !f.trigger_value.trim()) e.tv = `請填寫「${T.needs}」`;
      }
      if (i === 1) {
        if (!f.message.trim()) e.message = "請輸入訊息內容";
        f.buttons.forEach((b, j) => {
          if (!b.title.trim() && !b.url.trim()) return;
          if (!b.title.trim()) e[`bt${j}`] = "請輸入按鈕文字";
          if (!isUrl(b.url)) e[`bu${j}`] = "請輸入完整網址，例如 https://your-site.com";
          else if (/example\.com/i.test(b.url)) e[`bu${j}`] = "這是範例網址，請換成你自己的網址";
        });
      }
      return e;
    };
    const ok = (i) => !Object.keys(errors(i)).length;
    const markErrors = () => {
      if (step > 1 || !showErr[step]) return;
      for (const [k, msg] of Object.entries(errors(step))) {
        const inp = $(`[data-err="${k}"]`);
        if (!inp) continue;
        inp.classList.add("invalid");
        const out = $(`[data-err-for="${k}"]`);
        if (out) out.textContent = msg;
      }
    };
    const clearErr = (inp) => {
      inp.classList.remove("invalid");
      const out = $(`[data-err-for="${inp.dataset.err}"]`);
      if (out) out.textContent = "";
    };

    /* ---- 第 1 步 ---- */
    const choice = (k) => `<label class="pick ${f.trigger_type === k ? "selected" : ""}">
        <input type="radio" name="trig" value="${k}" ${f.trigger_type === k ? "checked" : ""}/><span class="dot"></span>
        <span class="pk"><b>${TRIGGER_ASK[k]}</b><span>${TRIGGERS[k].d}</span></span>${TRIGGERS[k].tag ? `<span class="badge brand">${TRIGGERS[k].tag}</span>` : ""}
      </label>`;
    const step0 = () => {
      const T = TRIGGERS[f.trigger_type];
      return `<div class="eyebrow">第 1 步，共 3 步</div>
        <h2 class="wiz-title">什麼時候自動回覆？</h2>
        <p class="wiz-desc">選一個情況，手機畫面會播放客人實際看到的樣子。</p>
        <div class="pick-list">${TRIGGER_MAIN.map(choice).join("")}</div>
        <details class="adv" style="margin-top:12px" ${TRIGGER_MORE.includes(f.trigger_type) ? "open" : ""}><summary>${icon("right")}其他情況</summary><div class="pick-list" style="margin-top:10px">${TRIGGER_MORE.map(choice).join("")}</div></details>
        ${T.needs ? `<label class="field" style="margin-top:20px"><span class="label">${T.needs}</span><input class="input" id="s-tv" data-err="tv" value="${esc(f.trigger_value)}" placeholder="${esc(T.ph)}"/><span class="error-text" data-err-for="tv"></span><span class="help">${T.help}</span></label>` : ""}
        ${f.trigger_type === "ad" ? `<button type="button" class="btn btn-sm" id="pick-ad" style="margin-top:8px">${icon("search")}從我的廣告帳號選擇</button>` : ""}
        <p class="small muted" style="margin-top:24px">需要多則訊息、選單或分支？<a href="#automations/${original ? `flow/${original.id}` : "new/blank"}" id="to-advanced">改用視覺流程編輯器 →</a></p>`;
    };
    const wire0 = () => {
      $$("input[name=trig]").forEach((r) => {
        r.onchange = () => {
          f.trigger_type = r.value;
          f.trigger_value = "";
          if (isNew && f.message === autoMsg) {
            const t = fromTemplate(TEMPLATE_FOR[r.value]);
            const url = f.buttons[0]?.url || "";
            f.message = autoMsg = t.message;
            f.buttons = t.buttons.map((b, j) => ({ ...b, url: j === 0 ? url : "" }));
            f.trigger_value = t.trigger_value || "";
            f.priority = t.priority;
            f.tag = t.tag;
            if (f.name === autoName) f.name = autoName = t.name;
          }
          renderStep();
        };
      });
      const tv = $("#s-tv");
      if (tv) tv.oninput = () => { f.trigger_value = tv.value; clearErr(tv); preview(); };
      const openPicker = () =>
        openAdPicker(
          splitIds(f.trigger_value),
          (ids) => {
            if (!ids) return sessionSet("wizard_draft", { id: f.id || null, f });
            f.trigger_value = ids.join(", ");
            renderStep();
            toast(`已選擇 ${ids.length} 支廣告`);
          },
          f.id ? `#automations/edit/${f.id}` : "#automations/new",
        );
      $("#pick-ad") && ($("#pick-ad").onclick = openPicker);
      if (f._openPicker) {
        delete f._openPicker;
        setTimeout(openPicker, 0);
      }
      if (!original) {
        $("#to-advanced").onclick = (e) => {
          e.preventDefault();
          renderFlowBuilder(el, { ...simpleToAutomation(f), id: undefined });
        };
      }
    };

    /* ---- 第 2 步 ---- */
    const buttonRow = (b, j) => `<div class="btn-edit">
        <div class="be-head"><b class="small">按鈕${f.buttons.length > 1 ? ` ${j + 1}` : ""}</b><button type="button" class="btn btn-ghost btn-sm icon-btn" data-rm="${j}" aria-label="移除按鈕">${icon("x")}</button></div>
        <div class="be-grid">
          <label class="field"><span class="label">按鈕文字</span><div class="input-group"><input class="input" data-bt="${j}" data-err="bt${j}" maxlength="20" value="${esc(b.title)}" placeholder="立即選購"/><span class="counter" data-cnt="${j}">${b.title.length}/20</span></div><span class="error-text" data-err-for="bt${j}"></span></label>
          <label class="field"><span class="label">客人點了會去哪裡</span><input class="input" data-bu="${j}" data-err="bu${j}" type="url" inputmode="url" value="${esc(b.url)}" placeholder="https://your-site.com/landing"/><span class="error-text" data-err-for="bu${j}"></span>
            <span class="help"><a href="#" data-utm="${j}">加上追蹤參數</a>，在 GA 看得到從 Messenger 來的流量。</span></label>
        </div></div>`;
    const step1 = () => `<div class="eyebrow">第 2 步，共 3 步</div>
        <h2 class="wiz-title">回覆什麼？</h2>
        <p class="wiz-desc">一則訊息，加上帶客人去你網站的按鈕。手機會即時更新。</p>
        ${original?.ad_json ? `<div class="note warn" style="margin-top:16px"><div>${icon("info")}<span>這則訊息已經放進廣告。修改後，儲存時會再給你一次新的 JSON，記得更新到廣告。</span></div></div>` : ""}
        <div class="preset-line"><span class="small muted">不知道怎麼寫？套用：</span>${USE_CASES.map((u) => `<button type="button" class="preset" data-case="${u.k}">${u.t}</button>`).join("")}</div>
        <div class="field" style="margin-top:16px">
          <div class="row between"><label class="label" for="s-message">訊息</label><button type="button" class="var-chip" data-var="{{first_name}}">${icon("plus")}插入客人名字</button></div>
          <textarea class="input" id="s-message" data-err="message" maxlength="640" placeholder="嗨 {{first_name}}，謝謝你的詢問！">${esc(f.message)}</textarea>
          <span class="row between"><span class="error-text" data-err-for="message"></span><span class="small subtle" id="msg-count">${f.message.length}/640</span></span>
        </div>
        <div id="btn-list" class="stack-sm" style="margin-top:8px">${f.buttons.map(buttonRow).join("")}</div>
        ${f.buttons.length < 3 ? `<button type="button" class="btn btn-sm" id="add-btn" style="margin-top:12px">${icon("plus")}${f.buttons.length ? "再加一個按鈕" : "加上前往網址的按鈕"}</button>` : ""}`;
    const wire1 = () => {
      const msg = $("#s-message");
      msg.oninput = () => { f.message = msg.value; $("#msg-count").textContent = `${msg.value.length}/640`; clearErr(msg); preview(); };
      $("[data-var]").onclick = (e) => {
        const v = e.currentTarget.dataset.var;
        const start = msg.selectionStart ?? msg.value.length;
        msg.value = msg.value.slice(0, start) + v + msg.value.slice(msg.selectionEnd ?? start);
        msg.focus();
        msg.selectionStart = msg.selectionEnd = start + v.length;
        msg.oninput();
      };
      $$("[data-case]").forEach((b) => {
        b.onclick = () => {
          const u = USE_CASES.find((x) => x.k === b.dataset.case);
          f.message = u.msg;
          if (!f.buttons.length) f.buttons.push({ title: u.btn, url: "" });
          else f.buttons[0].title = u.btn;
          renderStep();
          $(`[data-case="${u.k}"]`).classList.add("on");
          toast(`已套用「${u.t}」，記得填入你的網址`);
          if (!f.buttons[0].url) setTimeout(() => $('[data-bu="0"]')?.focus(), 50);
        };
      });
      $$("[data-bt]").forEach((inp) => (inp.oninput = () => { f.buttons[inp.dataset.bt].title = inp.value; clearErr(inp); $(`[data-cnt="${inp.dataset.bt}"]`).textContent = `${inp.value.length}/20`; preview(); }));
      $$("[data-bu]").forEach((inp) => (inp.oninput = () => { f.buttons[inp.dataset.bu].url = inp.value; clearErr(inp); preview(); }));
      $$("[data-rm]").forEach((b) => (b.onclick = () => { f.buttons.splice(Number(b.dataset.rm), 1); renderStep(); }));
      $("#add-btn") && ($("#add-btn").onclick = () => { f.buttons.push({ title: "", url: "" }); renderStep(); $(`[data-bt="${f.buttons.length - 1}"]`)?.focus(); });
      $$("[data-utm]").forEach((a) => (a.onclick = (e) => {
        e.preventDefault();
        const inp = $(`[data-bu="${a.dataset.utm}"]`);
        const u = inp.value.trim();
        if (!isUrl(u)) return toast("請先填好網址，再加上追蹤參數", true);
        if (u.includes("utm_source=")) return toast("這個網址已經有追蹤參數了");
        const [base, hash = ""] = u.split("#");
        inp.value = `${base}${base.includes("?") ? "&" : "?"}${UTM}${hash ? `#${hash}` : ""}`;
        inp.oninput();
        toast("已加上追蹤參數");
      }));
    };

    /* ---- 第 3 步 ---- */
    const checkItems = () => {
      const T = TRIGGERS[f.trigger_type];
      const filled = f.buttons.filter((b) => b.title.trim() || b.url.trim());
      return [
        { s: "ok", t: `什麼時候回覆：${TRIGGER_ASK[f.trigger_type]}${T.needs && f.trigger_value.trim() ? `（${esc(f.trigger_value.trim())}）` : ""}` },
        { s: "ok", t: "訊息內容已寫好" },
        filled.length ? { s: "ok", t: `${filled.length} 個按鈕都會帶客人到你的網址` } : { s: "info", t: "沒有按鈕，客人只會看到文字" },
        o.channels?.length ? { s: "ok", t: `已連接 ${o.channels.length} 個帳號` } : { s: "warn", t: '還沒連接粉絲專頁：可以先儲存，<a href="#connections">連接帳號</a>後才會生效' },
      ];
    };
    const ICON_FOR = { ok: "check", todo: "x", warn: "alert", info: "info" };
    const step2 = () => `<div class="eyebrow">第 3 步，共 3 步</div>
        <h2 class="wiz-title">確認後上線</h2>
        <p class="wiz-desc">手機正在播放完整情境，可以點裡面的按鈕試試。</p>
        <ul class="checks" style="margin-top:4px">${checkItems().map((c) => `<li class="chk ${c.s}"><span class="ci">${icon(ICON_FOR[c.s])}</span><span>${c.t}</span></li>`).join("")}</ul>
        ${AD_TRIGGER(f.trigger_type) ? `<div class="tip-card">${icon("rocket")}<div><b>讓客人一點廣告就看到這則訊息</b><span>${original && !isExample ? "可以把它放進 Messenger 廣告，客人不用先傳訊息。" : "儲存後會產生一段廣告 JSON，貼進 Messenger 廣告，客人不用先傳訊息就會看到。"}</span>${original && !isExample ? `<button type="button" class="btn btn-sm" id="w-json" style="margin-top:8px">${icon("code")}取得廣告 JSON</button>` : ""}</div></div>` : ""}
        <label class="field" style="margin-top:24px"><span class="label">幫它取個名字</span><input class="input" id="s-name" value="${esc(stripExample(f.name))}" placeholder="給自己看的名字"/></label>
        <details class="adv" style="margin-top:16px"><summary>${icon("right")}更多設定（選填）</summary>
          <div class="stack" style="margin-top:16px">
            <label class="field"><span class="label">平台</span><select class="input" id="s-platform">
              <option value="any" ${f.platform === "any" ? "selected" : ""}>Messenger 與 Instagram</option>
              <option value="messenger" ${f.platform === "messenger" ? "selected" : ""}>只有 Messenger</option>
              <option value="instagram" ${f.platform === "instagram" ? "selected" : ""}>只有 Instagram</option>
            </select></label>
            <label class="field"><span class="label">幫客人加上標籤</span><input class="input" id="s-tag" value="${esc(f.tag)}" placeholder="例如：春季活動"/><span class="help">方便在聯絡人頁面辨識客人從哪來。</span></label>
            <label class="field"><span class="label">優先順序</span><input class="input" type="number" id="s-priority" value="${f.priority}"/><span class="help">同時符合多個規則時，數字大的先用。</span></label>
          </div>
        </details>`;
    const wire2 = () => {
      $("#w-json") && ($("#w-json").onclick = () => openAdJson(original));
      $("#s-name").oninput = (e) => (f.name = e.target.value);
      $("#s-platform").onchange = (e) => (f.platform = e.target.value);
      $("#s-tag").oninput = (e) => { f.tag = e.target.value; preview(); };
      $("#s-priority").oninput = (e) => (f.priority = Number(e.target.value) || 0);
    };

    /* ---- 換步驟 ---- */
    const saveLabel = isExample ? "使用並啟用" : isNew ? "儲存並啟用" : "儲存變更";
    const goTo = (target) => {
      for (let i = step; i < target; i++) {
        if (!ok(i)) {
          showErr[i] = true;
          step = i;
          renderStep();
          return toast("還有欄位需要填寫，請看標示紅色的地方", true);
        }
      }
      step = target;
      reached = Math.max(reached, step);
      renderStep();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    function renderStep() {
      $("#w-stepper").innerHTML = stepper(WIZ_STEPS.map((label, i) => ({ label, done: i < reached || (!fresh && i !== step) })), step, (i) => i <= reached);
      $("#w-main").innerHTML = [step0, step1, step2][step]();
      [wire0, wire1, wire2][step]();
      const back = step > 0 ? `<button class="btn" data-step-go="${step - 1}">${icon("left")}上一步</button>` : `<a class="btn" href="#automations">取消</a>`;
      const next = step < 2 ? `<button class="btn ${fresh ? "btn-primary" : ""}" data-step-go="${step + 1}">下一步：${WIZ_STEPS[step + 1]}${icon("right")}</button>` : "";
      const saveBtn = step === 2 || !fresh ? `<button class="btn btn-primary" id="s-save" data-busy="儲存中">${icon("check")}${saveLabel}</button>` : "";
      $("#w-foot").innerHTML = `${back}<span class="grow"></span>${next}${saveBtn}`;
      $$("[data-step-go]").forEach((b) => (b.onclick = () => goTo(Number(b.dataset.stepGo))));
      $$("#w-stepper [data-go]").forEach((b) => (b.onclick = () => goTo(Number(b.dataset.go))));
      $("#s-save") && ($("#s-save").onclick = (e) => save(e.currentTarget));
      markErrors();
      caption();
      play();
    }

    const save = (btn) =>
      busy(btn, async () => {
        for (const i of [0, 1]) {
          if (!ok(i)) {
            showErr[i] = true;
            step = i;
            renderStep();
            return toast("還有欄位需要填寫，請看標示紅色的地方", true);
          }
        }
        const body = simpleToAutomation(f);
        body.enabled = f.id && !isExample ? !!f.enabled : true;
        try {
          const saved = f.id ? await api(`/automations/${f.id}`, { method: "PUT", body }) : await api("/automations", { method: "POST", body });
          toast(isExample || isNew ? "自動回覆已啟用 🎉" : "已儲存");
          // 廣告觸發的新回覆（或已放進廣告的回覆被修改）→ 直接給廣告 JSON
          const offerJson = AD_TRIGGER(saved.trigger_type) && (isNew || isExample || original?.ad_json);
          location.hash = offerJson ? `#automations?adjson=${saved.id}` : "#automations";
        } catch (err) {
          toast(err.message, true);
        }
      });

    renderStep();
  }

  /* ---- visual flow builder ---- */
  const BLOCKS = {
    text: { label: "文字訊息", desc: "一則文字", icon: "message", color: "#1781c4" },
    buttons: { label: "訊息 + 按鈕", desc: "導到網址或分支", icon: "msgbtn", color: "#e95b17" },
    quick_replies: { label: "選單（快速回覆）", desc: "讓客人點選項", icon: "list", color: "#2f9a9e" },
    image: { label: "圖片", desc: "商品或活動圖", icon: "image", color: "#8a5cf6" },
    delay: { label: "等待", desc: "停幾秒再送下一則", icon: "clock", color: "#6e6e7a" },
    tag: { label: "加標籤", desc: "標記這位客人", icon: "tag", color: "#16794a" },
    goto: { label: "接續流程", desc: "跳到另一個自動回覆", icon: "corner", color: "#4f46e5" },
  };
  const STEP_LABEL = Object.fromEntries(Object.entries(BLOCKS).map(([k, v]) => [k, v.label]));
  const newPayload = () => `OPT_${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;
  function newBlock(type, all, selfId) {
    switch (type) {
      case "text": return { type, text: "" };
      case "buttons": return { type, text: "", buttons: [{ type: "url", title: "立即查看", url: "", track: true }] };
      case "quick_replies": return { type, text: "想了解哪一個呢？", replies: [{ title: "選項 A", payload: newPayload() }, { title: "選項 B", payload: newPayload() }] };
      case "image": return { type, url: "" };
      case "delay": return { type, seconds: 2 };
      case "tag": return { type, tag: "" };
      case "goto": return { type, automation_id: all.find((x) => x.id !== selfId)?.id ?? 0 };
    }
  }
  function blockErrors(s) {
    const e = [];
    if (["text", "buttons", "quick_replies"].includes(s.type) && !String(s.text || "").trim()) e.push("請輸入訊息內容");
    if (s.type === "buttons") {
      if (!s.buttons.length) e.push("至少要有一個按鈕");
      s.buttons.forEach((b, j) => {
        if (!b.title.trim()) e.push(`按鈕 ${j + 1} 沒有文字`);
        if (b.type === "url" && !isUrl(b.url)) e.push(`按鈕 ${j + 1} 的網址不完整`);
        else if (b.type === "url" && /example\.com/i.test(b.url)) e.push(`按鈕 ${j + 1} 還是範例網址`);
      });
    }
    if (s.type === "quick_replies") {
      if (!s.replies.length) e.push("至少要有一個選項");
      if (s.replies.some((r) => !r.title.trim())) e.push("有選項沒有文字");
    }
    if (s.type === "image" && !isUrl(s.url)) e.push("請填寫圖片網址");
    if (s.type === "tag" && !String(s.tag || "").trim()) e.push("請填寫標籤名稱");
    return e;
  }
  /** 區塊在畫布上的視覺化內容 */
  function blockBody(s, others) {
    const t = (x) => esc(demoName(x)).trim() || '<span class="ph">（還沒有內容）</span>';
    switch (s.type) {
      case "text": return `<div class="nb-bubble">${t(s.text)}</div>`;
      case "buttons": return `<div class="nb-bubble card"><div class="tx">${t(s.text)}</div>${s.buttons.map((b) => `<span class="nb-btn">${b.type === "postback" ? icon("branch") : icon("link")}${esc(b.title || "按鈕")}</span>`).join("")}</div>`;
      case "quick_replies": return `<div class="nb-bubble">${t(s.text)}</div><div class="nb-qr">${s.replies.map((r) => `<span>${esc(r.title || "選項")}</span>`).join("")}</div>`;
      case "image": return isUrl(s.url) ? `<div class="nb-img" style="background-image:url('${esc(s.url)}')"></div>` : `<div class="nb-img empty">${icon("image")}<span>填寫圖片網址</span></div>`;
      case "delay": return `<div class="nb-line">${icon("clock")}等待 <b>${Number(s.seconds) || 0} 秒</b>，客人會看到「輸入中⋯」</div>`;
      case "tag": return `<div class="nb-line">${icon("tag")}加上標籤 <b>${esc(s.tag || "（未命名）")}</b></div>`;
      case "goto": { const g = others.find((x) => x.id === Number(s.automation_id)); return `<div class="nb-line">${icon("corner")}接續 <b>${esc(g ? stripExample(g.name) : "（請選擇）")}</b></div>`; }
    }
    return "";
  }

  async function renderFlowBuilder(el, a) {
    const [allRaw, chans] = await Promise.all([api("/automations"), api("/channels")]);
    let all = allRaw;
    const isExample = !!a.is_example;
    if (isExample) a.enabled = 1;
    a.steps = a.steps || [];
    // 補上沒有 payload 的選項 / 分支按鈕
    for (const s of a.steps) {
      if (s.type === "quick_replies") s.replies.forEach((r) => (r.payload = r.payload || newPayload()));
      if (s.type === "buttons") s.buttons.forEach((b) => b.type === "postback" && (b.payload = b.payload || newPayload()));
    }
    // 小螢幕上編輯面板是底部抽屜，一開始先不打開以免蓋住畫布
    let sel = window.innerWidth <= 1000 ? null : "trigger";
    let dirty = false;
    let zoom = Number(store.get(ukey("flow_zoom"))) || 1;
    let pan = { x: 0, y: 0 };
    let platform = a.platform === "instagram" ? "instagram" : "messenger";
    const others = () => all.filter((x) => x.id !== a.id);
    const allWithCurrent = () => [...others(), { ...a, id: a.id ?? -1 }];
    const simpleOk = a.id && automationToSimple(a);

    document.body.classList.add("focus-mode");
    el.innerHTML = `<div class="builder">
      <div class="b-top">
        <a class="btn btn-ghost btn-sm" href="#automations" id="b-back">${icon("left")}<span class="hide-sm">自動回覆</span></a>
        <div class="b-title"><input class="b-name" id="b-name" value="${esc(stripExample(a.name))}" placeholder="為這個流程命名" aria-label="流程名稱"/><span class="badge" id="b-state"></span></div>
        <div class="grow"></div>
        ${simpleOk ? `<a class="btn btn-ghost btn-sm hide-sm" href="#automations/edit/${a.id}">簡易模式</a>` : ""}
        <label class="b-toggle"><span class="switch"><input type="checkbox" id="b-enabled" ${a.enabled !== 0 ? "checked" : ""}/><span class="slider"></span></span><span class="hide-sm">啟用</span></label>
        <button class="btn btn-sm" id="b-play">${icon("play")}<span class="hide-sm">播放</span></button>
        <button class="btn btn-primary btn-sm" id="b-save" data-busy="儲存中">${icon("check")}${isExample ? "使用並啟用" : "儲存"}</button>
      </div>
      ${isExample ? `<div class="b-banner">${icon("book")}<span><b>這是範例。</b>拖動、修改成你的內容，按「使用並啟用」就會開始運作。</span></div>` : ""}
      <div class="b-main" id="b-main">
        <aside class="b-palette" aria-label="區塊">
          <div class="pal-title">拖曳區塊到流程</div>
          ${Object.entries(BLOCKS).map(([k, b]) => `<button type="button" class="pal-item" data-block="${k}" style="--c:${b.color}"><span class="pi">${icon(b.icon)}</span><span class="pt"><b>${b.label}</b><small>${b.desc}</small></span></button>`).join("")}
          <p class="pal-hint">${icon("info")}拖到流程中的虛線位置；也可以直接點一下加到最後。</p>
        </aside>
        <section class="b-canvas" id="b-canvas" aria-label="流程畫布">
          <div class="b-stage" id="b-stage"></div>
          <div class="b-zoom" role="group" aria-label="縮放"><button data-z="-" aria-label="縮小">${icon("minus")}</button><span id="b-zl"></span><button data-z="+" aria-label="放大">${icon("plus")}</button><button data-z="fit" aria-label="回到中央">${icon("maximize")}</button></div>
          <div class="b-insp" id="b-insp"></div>
        </section>
        <aside class="b-phone" aria-label="手機模擬">
          <div class="b-phone-head">
            <div class="seg" id="b-skin"><button data-skin="messenger" class="${platform === "messenger" ? "on" : ""}">Messenger</button><button data-skin="instagram" class="${platform === "instagram" ? "on" : ""}">Instagram</button></div>
            <button class="btn btn-ghost btn-sm icon-btn" id="b-replay" title="重新播放" aria-label="重新播放">${icon("refresh")}</button>
          </div>
          <div id="b-phone"></div>
          <p class="b-phone-tip">${icon("click")}點手機裡的按鈕和選項，體驗客人實際的操作</p>
        </aside>
      </div>
      <div class="b-tabs"><button data-tab="flow" class="on">${icon("workflow")}流程</button><button data-tab="phone">${icon("phone")}手機預覽</button></div>
    </div>`;

    const canvas = $("#b-canvas");
    const stage = $("#b-stage");
    const phone = mountPhone($("#b-phone"), { platform, getAll: allWithCurrent });
    const markDirty = () => { dirty = true; updateState(); };
    const updateState = () => {
      const st = $("#b-state");
      const errs = a.steps.reduce((n, s) => n + (blockErrors(s).length ? 1 : 0), 0) + (TRIGGERS[a.trigger_type].needs && !a.trigger_value.trim() ? 1 : 0);
      st.className = `badge ${errs ? "warning" : dirty ? "info" : "success"}`;
      st.textContent = errs ? `${errs} 個區塊待完成` : dirty ? "尚未儲存" : a.id ? "已儲存" : "新流程";
    };
    const applyTransform = () => {
      stage.style.transform = `translate(calc(-50% + ${pan.x}px), ${pan.y}px) scale(${zoom})`;
      $("#b-zl").textContent = `${Math.round(zoom * 100)}%`;
    };
    let phoneTimer;
    const refreshPhone = () => {
      clearTimeout(phoneTimer);
      phoneTimer = setTimeout(() => phone.show([...triggerScript(a), ...stepsToScript(a.steps, allWithCurrent())], typeof sel === "number" ? sel : null), 120);
    };
    const findBranch = (payload) => all.find((x) => x.trigger_type === "postback" && x.trigger_value === payload && x.id !== a.id);

    /* ---------- stage ---------- */
    const dz = (i) => `<div class="dz" data-dz="${i}"><span class="dz-line"></span><button type="button" class="dz-add" data-insert="${i}" aria-label="在這裡新增區塊">${icon("plus")}</button><span class="dz-drop">放在這裡</span></div>`;
    function renderStage() {
      const T = TRIGGERS[a.trigger_type];
      const trigErr = T.needs && !a.trigger_value.trim();
      stage.innerHTML = `
        <div class="node trigger ${sel === "trigger" ? "sel" : ""} ${trigErr ? "err" : ""}" data-node="trigger" style="--c:#e95b17">
          <div class="nh"><span class="ni">${icon("zap")}</span><span class="nt">觸發條件</span></div>
          <div class="nb"><div class="trig-name">${esc(T.t)}</div>${a.trigger_value ? `<div class="trig-val">${esc(a.trigger_value)}</div>` : trigErr ? `<div class="n-err">${icon("alert")}請填寫${esc(T.needs)}</div>` : `<div class="small muted">${esc(T.d)}</div>`}
            <div class="trig-pf">${a.platform === "instagram" ? icon("instagram") + "Instagram" : a.platform === "messenger" ? icon("facebook") + "Messenger" : icon("facebook") + icon("instagram") + "Messenger 與 Instagram"}</div></div>
        </div>
        ${dz(0)}
        ${a.steps
          .map((s, i) => {
            const B = BLOCKS[s.type];
            const errs = blockErrors(s);
            const branches =
              s.type === "quick_replies" ? s.replies.map((r, j) => ({ j, title: r.title, payload: r.payload }))
                : s.type === "buttons" ? s.buttons.map((b, j) => (b.type === "postback" ? { j, title: b.title, payload: b.payload } : null)).filter(Boolean) : [];
            return `<div class="node ${sel === i ? "sel" : ""} ${errs.length ? "err" : ""}" data-node="${i}" style="--c:${B.color}">
              <div class="nh" data-drag="${i}" title="拖曳可調整順序"><span class="grip">${icon("grip")}</span><span class="ni">${icon(B.icon)}</span><span class="nt">${B.label}</span>
                <span class="na"><button type="button" data-dup="${i}" aria-label="複製區塊" title="複製">${icon("copy")}</button><button type="button" data-delnode="${i}" aria-label="刪除區塊" title="刪除">${icon("trash")}</button></span></div>
              <div class="nb">${blockBody(s, others())}${errs.length ? `<div class="n-err">${icon("alert")}${esc(errs[0])}</div>` : ""}</div>
              ${branches.length ? `<div class="branches">${branches
                .map((b) => {
                  const t = findBranch(b.payload);
                  return `<div class="br"><span class="br-opt">${esc(b.title || "選項")}</span><span class="br-arrow">${icon("right")}</span>${t ? `<button type="button" class="br-target" data-open="${t.id}">${icon("corner")}${esc(stripExample(t.name))}</button>` : `<button type="button" class="br-new" data-branch="${i}:${b.j}">${icon("plus")}設定這個選項的回覆</button>`}</div>`;
                })
                .join("")}</div>` : ""}
            </div>${dz(i + 1)}`;
          })
          .join("")}
        <div class="node-end">${a.steps.length ? icon("check") + "流程結束" : "從左邊拖一個區塊到這裡開始"}</div>`;
      updateState();
    }

    /* ---------- inspector ---------- */
    const insp = $("#b-insp");
    function renderInspector() {
      if (sel === null) { insp.classList.remove("open"); canvas.classList.remove("insp-open"); insp.innerHTML = ""; return; }
      insp.classList.add("open");
      canvas.classList.add("insp-open");
      let title, body;
      if (sel === "trigger") {
        title = "觸發條件";
        const T = TRIGGERS[a.trigger_type];
        const ex = TRIGGER_EXAMPLES[a.trigger_type];
        body = `<div class="field"><span class="label">什麼時候開始這個流程？</span><div class="insp-choices">
            ${Object.entries(TRIGGERS).map(([k, t]) => `<label class="ic-row ${a.trigger_type === k ? "on" : ""}"><input type="radio" name="itrig" value="${k}" ${a.trigger_type === k ? "checked" : ""}/><span><b>${t.t}</b><small>${t.d}</small></span></label>`).join("")}
          </div></div>
          ${T.needs ? `<label class="field"><span class="label">${T.needs}</span><input class="input" data-a="trigger_value" value="${esc(a.trigger_value)}" placeholder="${esc(T.ph)}"/><span class="help">${T.help}</span></label>` : ""}
          ${ex ? `<div class="scenario"><div class="sc-label">${smallIcon("info")} 實際情境</div><p>${esc(ex.scene)}</p>${ex.tip ? `<p class="sc-tip">${esc(ex.tip)}</p>` : ""}</div>` : ""}
          <label class="field"><span class="label">平台</span><select class="input" data-a="platform"><option value="any" ${a.platform === "any" ? "selected" : ""}>Messenger 與 Instagram</option><option value="messenger" ${a.platform === "messenger" ? "selected" : ""}>只有 Messenger</option><option value="instagram" ${a.platform === "instagram" ? "selected" : ""}>只有 Instagram</option></select></label>
          <div class="grid-2"><label class="field"><span class="label">限定帳號</span><select class="input" data-a="channel_id"><option value="">全部</option>${chans.map((c) => `<option value="${c.id}" ${a.channel_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
          <label class="field"><span class="label">優先順序</span><input class="input" type="number" data-a="priority" value="${a.priority}"/></label></div>`;
      } else {
        const i = sel;
        const s = a.steps[i];
        const p = (k) => `${i}.${k}`;
        title = BLOCKS[s.type].label;
        switch (s.type) {
          case "text":
            body = msgField(s, p) + presetRow();
            break;
          case "buttons":
            body = msgField(s, p) + `<div class="field"><span class="label">按鈕（最多 3 個）</span><div class="stack-sm">
              ${s.buttons.map((b, j) => `<div class="insp-card">
                <div class="row between"><div class="seg sm" data-bkind="${i}.${j}"><button type="button" data-v="url" class="${b.type === "url" ? "on" : ""}">${icon("link")}開網址</button><button type="button" data-v="postback" class="${b.type === "postback" ? "on" : ""}">${icon("branch")}分支</button></div><button type="button" class="btn btn-ghost btn-sm icon-btn" data-rmb="${i}.${j}" aria-label="移除按鈕">${icon("x")}</button></div>
                <input class="input" data-s="${p(`buttons.${j}.title`)}" maxlength="20" value="${esc(b.title)}" placeholder="按鈕文字"/>
                <div class="idea-chips">${BUTTON_IDEAS.map((t) => `<button type="button" class="idea" data-idea="${i}.${j}">${t}</button>`).join("")}</div>
                ${b.type === "url" ? `<input class="input" data-s="${p(`buttons.${j}.url`)}" type="url" value="${esc(b.url)}" placeholder="https://your-site.com"/><a href="#" class="small" data-utm="${i}.${j}">加上追蹤參數</a>` : `<p class="small muted">客人點了會走到這個按鈕的分支回覆，可以在畫布上設定。</p>`}
              </div>`).join("")}
              ${s.buttons.length < 3 ? `<button type="button" class="btn btn-sm" data-addb="${i}">${icon("plus")}新增按鈕</button>` : ""}</div></div>`;
            break;
          case "quick_replies":
            body = msgField(s, p) + `<div class="field"><span class="label">選項</span><span class="help">每個選項都可以接到不同的回覆，在畫布上的分支設定。</span><div class="stack-sm">
              ${s.replies.map((r, j) => `<div class="row" style="flex-wrap:nowrap"><input class="input" data-s="${p(`replies.${j}.title`)}" maxlength="20" value="${esc(r.title)}" placeholder="選項文字"/><button type="button" class="btn btn-ghost btn-sm icon-btn" data-rmq="${i}.${j}" aria-label="移除選項">${icon("x")}</button></div>`).join("")}
              ${s.replies.length < 11 ? `<button type="button" class="btn btn-sm" data-addq="${i}">${icon("plus")}新增選項</button>` : ""}</div></div>`;
            break;
          case "image":
            body = `<label class="field"><span class="label">圖片網址</span><input class="input" data-s="${p("url")}" type="url" value="${esc(s.url)}" placeholder="https://your-site.com/photo.jpg"/><span class="help">支援 JPG、PNG、GIF。圖片需要是公開網址。</span></label>`;
            break;
          case "delay":
            body = `<label class="field"><span class="label">等待 <b id="dl-v">${s.seconds}</b> 秒</span><input type="range" min="1" max="15" value="${s.seconds}" data-s="${p("seconds")}" data-num class="range"/><span class="help">讓對話節奏更自然，客人會看到「輸入中⋯」。</span></label>`;
            break;
          case "tag":
            body = `<label class="field"><span class="label">標籤名稱</span><input class="input" data-s="${p("tag")}" value="${esc(s.tag)}" placeholder="例如：想了解價格"/><span class="help">客人看不到。可以在聯絡人頁面看到誰有這個標籤。</span></label>`;
            break;
          case "goto":
            body = `<label class="field"><span class="label">接續到哪個自動回覆</span><select class="input" data-s="${p("automation_id")}" data-num>${others().map((x) => `<option value="${x.id}" ${x.id === Number(s.automation_id) ? "selected" : ""}>${esc(stripExample(x.name))}</option>`).join("")}</select><span class="help">送完這裡的內容後，接著送出所選流程的內容。</span></label>`;
            break;
        }
      }
      insp.innerHTML = `<div class="insp-head"><b>${esc(title)}</b><button type="button" class="btn btn-ghost btn-sm icon-btn" id="insp-x" aria-label="關閉">${icon("x")}</button></div><div class="insp-body stack">${body}</div>`;
    }
    const msgField = (s, p) => `<label class="field"><span class="label">訊息內容</span><textarea class="input" data-s="${p("text")}" maxlength="640" placeholder="嗨 {{first_name}}⋯">${esc(s.text)}</textarea>
      <span class="var-chips"><button type="button" class="var-chip" data-var="{{first_name}}">客人名字</button><button type="button" class="var-chip" data-var="{{full_name}}">客人全名</button></span></label>`;
    const presetRow = () => `<div class="preset-box"><div class="small" style="font-weight:500;margin-bottom:8px">${smallIcon("sparkles")} 套用範例文案</div><div class="preset-chips">${USE_CASES.map((u) => `<button type="button" class="preset" data-case="${u.k}">${u.t}</button>`).join("")}</div></div>`;

    const select = (v) => {
      sel = v;
      renderStage();
      renderInspector();
      refreshPhone();
    };
    const changed = (rerenderInspector = false) => {
      markDirty();
      renderStage();
      if (rerenderInspector) renderInspector();
      refreshPhone();
    };
    const insertAt = (idx, type) => {
      a.steps.splice(idx, 0, newBlock(type, all, a.id));
      sel = idx;
      changed(true);
    };
    const moveTo = (from, to) => {
      if (to === from || to === from + 1) return;
      const [s] = a.steps.splice(from, 1);
      const dest = to > from ? to - 1 : to;
      a.steps.splice(dest, 0, s);
      sel = dest;
      changed(true);
    };

    /* ---------- inspector events ---------- */
    insp.addEventListener("input", (e) => {
      const t = e.target;
      if (t.name === "itrig") return;
      if (t.dataset.a) {
        let v = t.value;
        if (t.dataset.a === "priority") v = Number(v) || 0;
        if (t.dataset.a === "channel_id") v = v === "" ? null : Number(v);
        a[t.dataset.a] = v;
        if (t.dataset.a === "platform" && v !== "any") { platform = v; setSkin(v); }
        return changed();
      }
      if (t.dataset.s) {
        const path = t.dataset.s.split(".");
        let o = a.steps;
        for (const k of path.slice(0, -1)) o = o[k];
        o[path[path.length - 1]] = t.dataset.num !== undefined ? Number(t.value) : t.value;
        if (t.type === "range") $("#dl-v").textContent = t.value;
        changed();
      }
    });
    insp.addEventListener("change", (e) => {
      const t = e.target;
      if (t.name === "itrig") { a.trigger_type = t.value; if (!TRIGGERS[t.value].needs) a.trigger_value = ""; return changed(true); }
      if (t.tagName === "SELECT") insp.dispatchEvent(new Event("input", { bubbles: true })) || null;
    });
    insp.addEventListener("click", (e) => {
      const b = e.target.closest("button, a");
      if (!b) return;
      if (b.id === "insp-x") return select(null);
      const pair = (v) => v.split(".").map(Number);
      if (b.dataset.var) {
        const ta = $("textarea", insp);
        const st = ta.selectionStart ?? ta.value.length;
        ta.value = ta.value.slice(0, st) + b.dataset.var + ta.value.slice(ta.selectionEnd ?? st);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
        return;
      }
      if (b.dataset.case) {
        const u = USE_CASES.find((x) => x.k === b.dataset.case);
        a.steps[sel].text = u.msg;
        return changed(true);
      }
      if (b.dataset.idea) { const [i, j] = pair(b.dataset.idea); a.steps[i].buttons[j].title = b.textContent; return changed(true); }
      if (b.dataset.addb) { a.steps[Number(b.dataset.addb)].buttons.push({ type: "url", title: "", url: "", track: true }); return changed(true); }
      if (b.dataset.rmb) { const [i, j] = pair(b.dataset.rmb); a.steps[i].buttons.splice(j, 1); return changed(true); }
      if (b.dataset.addq) { a.steps[Number(b.dataset.addq)].replies.push({ title: "", payload: newPayload() }); return changed(true); }
      if (b.dataset.rmq) { const [i, j] = pair(b.dataset.rmq); a.steps[i].replies.splice(j, 1); return changed(true); }
      if (b.closest("[data-bkind]") && b.dataset.v) {
        const [i, j] = pair(b.closest("[data-bkind]").dataset.bkind);
        const cur = a.steps[i].buttons[j];
        a.steps[i].buttons[j] = b.dataset.v === "postback" ? { type: "postback", title: cur.title, payload: newPayload() } : { type: "url", title: cur.title, url: "", track: true };
        return changed(true);
      }
      if (b.dataset.utm) {
        e.preventDefault();
        const [i, j] = pair(b.dataset.utm);
        const btn = a.steps[i].buttons[j];
        if (!isUrl(btn.url)) return toast("請先填好網址", true);
        if (btn.url.includes("utm_source=")) return toast("已經有追蹤參數了");
        const [base, hash = ""] = btn.url.split("#");
        btn.url = `${base}${base.includes("?") ? "&" : "?"}${UTM}${hash ? `#${hash}` : ""}`;
        toast("已加上追蹤參數");
        return changed(true);
      }
    });

    /* ---------- stage events ---------- */
    stage.addEventListener("click", async (e) => {
      const t = e.target;
      const ins = t.closest("[data-insert]");
      if (ins) return openInsertMenu(ins, Number(ins.dataset.insert));
      const dup = t.closest("[data-dup]");
      if (dup) { const i = Number(dup.dataset.dup); a.steps.splice(i + 1, 0, JSON.parse(JSON.stringify(a.steps[i]))); sel = i + 1; return changed(true); }
      const del = t.closest("[data-delnode]");
      if (del) { const i = Number(del.dataset.delnode); a.steps.splice(i, 1); sel = null; return changed(true); }
      const open = t.closest("[data-open]");
      if (open) return leaveTo(`#automations/flow/${open.dataset.open}`);
      const br = t.closest("[data-branch]");
      if (br) return createBranch(...br.dataset.branch.split(":").map(Number));
      const node = t.closest("[data-node]");
      if (node) select(node.dataset.node === "trigger" ? "trigger" : Number(node.dataset.node));
    });
    function openInsertMenu(anchor, idx) {
      $(".insert-menu")?.remove();
      const m = document.createElement("div");
      m.className = "insert-menu";
      m.innerHTML = Object.entries(BLOCKS).map(([k, b]) => `<button type="button" data-k="${k}" style="--c:${b.color}"><span class="pi">${icon(b.icon)}</span>${b.label}</button>`).join("");
      document.body.appendChild(m);
      const r = anchor.getBoundingClientRect();
      m.style.left = `${Math.min(window.innerWidth - 220, r.left + r.width / 2 - 100)}px`;
      m.style.top = `${Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 6)}px`;
      m.onclick = (ev) => { const k = ev.target.closest("[data-k]")?.dataset.k; if (k) { m.remove(); insertAt(idx, k); } };
      setTimeout(() => document.addEventListener("pointerdown", function off(ev) { if (!ev.target.closest(".insert-menu")) { m.remove(); document.removeEventListener("pointerdown", off); } }), 0);
    }

    /* ---------- drag & drop（滑鼠與觸控都可） ---------- */
    function startDrag(e, { label, color, iconName, from, onClick, onDrop }) {
      if (e.button !== undefined && e.button !== 0) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let ghost = null;
      let target = null;
      const srcNode = from != null ? $(`[data-node="${from}"]`, stage) : null;
      const move = (ev) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          ghost = document.createElement("div");
          ghost.className = "drag-ghost";
          ghost.style.setProperty("--c", color);
          ghost.innerHTML = `<span class="pi">${icon(iconName)}</span>${esc(label)}`;
          document.body.appendChild(ghost);
          canvas.classList.add("dragging");
          srcNode?.classList.add("drag-src");
        }
        ev.preventDefault();
        ghost.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 10}px)`;
        const cr = canvas.getBoundingClientRect();
        const inside = ev.clientX >= cr.left && ev.clientX <= cr.right && ev.clientY >= cr.top && ev.clientY <= cr.bottom;
        let best = null;
        let bd = Infinity;
        if (inside) for (const z of $$(".dz", stage)) { const r = z.getBoundingClientRect(); const d = Math.abs(ev.clientY - (r.top + r.height / 2)); if (d < bd) { bd = d; best = z; } }
        $$(".dz.hot", stage).forEach((z) => z !== best && z.classList.remove("hot"));
        best?.classList.add("hot");
        target = best ? Number(best.dataset.dz) : null;
        // 拖到畫布邊緣時自動捲動
        if (inside && ev.clientY > cr.bottom - 40) { pan.y -= 12; applyTransform(); }
        if (inside && ev.clientY < cr.top + 40) { pan.y += 12; applyTransform(); }
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        canvas.classList.remove("dragging");
        srcNode?.classList.remove("drag-src");
        $$(".dz.hot", stage).forEach((z) => z.classList.remove("hot"));
        if (!ghost) return onClick?.();
        ghost.remove();
        if (target != null) onDrop(target);
      };
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    }
    $$(".pal-item", el).forEach((p) => {
      const k = p.dataset.block;
      const B = BLOCKS[k];
      p.addEventListener("pointerdown", (e) => { e.preventDefault(); startDrag(e, { label: B.label, color: B.color, iconName: B.icon, onClick: () => insertAt(a.steps.length, k), onDrop: (to) => insertAt(to, k) }); });
      p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); insertAt(a.steps.length, k); } });
    });
    stage.addEventListener("pointerdown", (e) => {
      const h = e.target.closest("[data-drag]");
      if (!h || e.target.closest("button")) return;
      e.preventDefault();
      const i = Number(h.dataset.drag);
      const B = BLOCKS[a.steps[i].type];
      startDrag(e, { label: B.label, color: B.color, iconName: B.icon, from: i, onClick: () => select(i), onDrop: (to) => moveTo(i, to) });
    });

    /* ---------- pan & zoom ---------- */
    canvas.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".node, .dz-add, .b-insp, .b-zoom, .insert-menu")) return;
      const sx = e.clientX - pan.x;
      const sy = e.clientY - pan.y;
      canvas.classList.add("panning");
      const move = (ev) => { pan.x = ev.clientX - sx; pan.y = ev.clientY - sy; applyTransform(); };
      const up = () => { canvas.classList.remove("panning"); document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
    canvas.addEventListener("wheel", (e) => {
      if (e.target.closest(".b-insp")) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) setZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92));
      else { pan.x -= e.deltaX; pan.y -= e.deltaY; applyTransform(); }
    }, { passive: false });
    const setZoom = (z) => { zoom = Math.min(1.5, Math.max(0.5, z)); store.set(ukey("flow_zoom"), zoom); applyTransform(); };
    $(".b-zoom").onclick = (e) => {
      const z = e.target.closest("[data-z]")?.dataset.z;
      if (z === "+") setZoom(zoom + 0.1);
      if (z === "-") setZoom(zoom - 0.1);
      if (z === "fit") { pan = { x: 0, y: 0 }; setZoom(1); }
    };

    /* ---------- phone & top bar ---------- */
    const setSkin = (p) => { platform = p; phone.setPlatform(p); $$("#b-skin button").forEach((b) => b.classList.toggle("on", b.dataset.skin === p)); };
    $("#b-skin").onclick = (e) => { const s = e.target.closest("[data-skin]")?.dataset.skin; if (s) setSkin(s); };
    const play = () => { clearTimeout(phoneTimer); showTab("phone"); phone.play([...triggerScript(a), ...stepsToScript(a.steps, allWithCurrent())]); store.set(ukey("tested"), true); };
    $("#b-play").onclick = play;
    $("#b-replay").onclick = play;
    $("#b-name").oninput = (e) => { a.name = e.target.value; markDirty(); };
    $("#b-enabled").onchange = (e) => { a.enabled = e.target.checked ? 1 : 0; markDirty(); };
    const showTab = (t) => {
      $("#b-main").dataset.tab = t;
      $$(".b-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    };
    $(".b-tabs").onclick = (e) => { const t = e.target.closest("[data-tab]")?.dataset.tab; if (t) showTab(t); };
    async function leaveTo(hash) {
      if (dirty && !(await confirmDialog("還有變更沒有儲存", "要離開這個流程嗎？未儲存的變更會消失。", "離開", true))) return;
      dirty = false;
      location.hash = hash;
    }
    $("#b-back").onclick = (e) => { e.preventDefault(); leaveTo("#automations"); };

    function validateAll() {
      if (TRIGGERS[a.trigger_type].needs && !a.trigger_value.trim()) return "trigger";
      const i = a.steps.findIndex((s) => blockErrors(s).length);
      if (i >= 0) return i;
      if (!a.steps.length) return "empty";
      return null;
    }
    async function save({ silent = false } = {}) {
      const bad = validateAll();
      if (bad === "empty") { toast("流程裡還沒有任何區塊", true); return null; }
      if (bad !== null) { select(bad); toast("有區塊需要完成，已幫你打開", true); return null; }
      const body = { ...a, name: stripExample($("#b-name").value).trim() || TRIGGERS[a.trigger_type].t, enabled: !!a.enabled };
      try {
        const r = a.id ? await api(`/automations/${a.id}`, { method: "PUT", body }) : await api("/automations", { method: "POST", body });
        const wasNew = !a.id;
        Object.assign(a, { id: r.id, is_example: 0, name: r.name });
        all = [...others(), r];
        dirty = false;
        updateState();
        $("#b-save").innerHTML = `${icon("check")}儲存`;
        $(".b-banner")?.remove();
        if (wasNew) history.replaceState(null, "", `#automations/flow/${r.id}`);
        if (!silent) toast(a.enabled ? "已儲存並啟用 🎉" : "已儲存（目前未啟用）");
        return r;
      } catch (err) {
        toast(err.message, true);
        return null;
      }
    }
    $("#b-save").onclick = (e) => busy(e.currentTarget, () => save());

    async function createBranch(i, j) {
      const s = a.steps[i];
      const opt = s.type === "quick_replies" ? s.replies[j] : s.buttons[j];
      if (!opt.title.trim()) { select(i); return toast("請先替這個選項取名字", true); }
      if (!(await confirmDialog("設定選項的回覆", `會先儲存目前的流程，接著建立客人點「${opt.title}」之後要收到的回覆。`, "建立"))) return;
      const saved = await save({ silent: true });
      if (!saved) return;
      try {
        const created = await api("/automations", {
          method: "POST",
          body: { name: `選項回覆：${opt.title}`, enabled: true, priority: 0, platform: a.platform, channel_id: null, trigger_type: "postback", trigger_value: opt.payload, steps: [{ type: "text", text: `你選了「${opt.title}」，以下是相關資訊 👇` }] },
        });
        toast("已建立選項的回覆");
        location.hash = `#automations/flow/${created.id}`;
      } catch (err) {
        toast(err.message, true);
      }
    }

    applyTransform();
    renderStage();
    renderInspector();
    refreshPhone();
    if (!a.id && !a.steps.length) setTimeout(() => toast("從左邊拖一個區塊到流程中開始吧"), 300);
  }

  /* ---- test modal ---- */
  function openTestModal(a) {
    const scen = a && a.trigger_type === "keyword" ? "message" : a && a.trigger_type === "postback" ? "postback" : "ad";
    const m = modal({
      title: "測試自動回覆",
      body: `<div class="grid-2" style="align-items:start">
        <div class="stack">
          <p class="muted small">模擬一位客人的行為，看看會收到什麼。不會真的傳送訊息。</p>
          <div class="field"><span class="label">模擬情境</span>
            <div class="stack-sm" id="t-scen">
              ${[["ad", "從廣告點進來"], ["message", "傳了一則訊息"], ["postback", "按下某個按鈕"]].map(([k, l]) => `<label class="check"><input type="radio" name="scen" value="${k}" ${k === scen ? "checked" : ""}/>${l}</label>`).join("")}
            </div></div>
          <div id="t-fields" class="stack"></div>
          <label class="field"><span class="label">平台</span><select class="input" id="t-platform"><option value="messenger">Messenger</option><option value="instagram">Instagram</option></select></label>
          <button class="btn btn-primary" id="t-run">${icon("play")}執行測試</button>
        </div>
        <div><div id="t-result">${phoneMock({ bubbles: [{ meta: "按「執行測試」看結果" }] })}</div><div id="t-matched" class="small" style="margin-top:10px"></div></div>
      </div>`,
    });
    const fields = () => {
      const s = $("input[name=scen]:checked", m.el).value;
      $("#t-fields", m.el).innerHTML =
        s === "ad"
          ? `<label class="field"><span class="label">廣告 ID（選填）</span><input class="input" id="t-ad" value="${esc(a?.trigger_type === "ad" ? a.trigger_value.split(/[,，]/)[0].trim() : "")}" placeholder="不填代表任何廣告"/></label>
             <label class="field"><span class="label">ref 參數（選填）</span><input class="input" id="t-ref" value="${esc(a?.trigger_type === "ref" ? a.trigger_value.split(/[,，]/)[0].trim() : "")}"/></label>`
          : s === "message"
            ? `<label class="field"><span class="label">客人傳的訊息</span><input class="input" id="t-text" value="${esc(a?.trigger_type === "keyword" ? a.trigger_value.split(/[,，]/)[0].trim() : "你好")}"/></label>`
            : `<label class="field"><span class="label">按鈕 payload</span><input class="input" id="t-pb" value="${esc(a?.trigger_type === "postback" ? a.trigger_value : "")}"/></label>`;
    };
    $$("input[name=scen]", m.el).forEach((r) => (r.onchange = fields));
    fields();
    $("#t-run", m.el).onclick = (e) =>
      busy(e.currentTarget, async () => {
        const s = $("input[name=scen]:checked", m.el).value;
        const body = { platform: $("#t-platform", m.el).value };
        if (s === "ad") { body.ad_id = $("#t-ad", m.el).value.trim() || "TEST_AD"; body.ref = $("#t-ref", m.el).value.trim(); }
        if (s === "message") body.text = $("#t-text", m.el).value.trim();
        if (s === "postback") body.postback_payload = $("#t-pb", m.el).value.trim();
        try {
          const r = await api("/simulate", { method: "POST", body });
          const sys = s === "ad" ? "透過廣告開啟對話" : null;
          const userText = s === "message" ? body.text : s === "postback" ? `（按下 ${body.postback_payload}）` : null;
          $("#t-result", m.el).innerHTML = phoneMock({ sys, userText, bubbles: r.matched ? graphMessagesToBubbles(r.messages) : [{ meta: "沒有任何自動回覆被觸發" }] });
          $("#t-matched", m.el).innerHTML = r.matched
            ? `<div class="result-ok">${icon("check")}觸發了「${esc(r.matched.name)}」</div>`
            : `<div class="result-err">${icon("alert")}<span>沒有符合的規則。檢查觸發條件，或新增一個「其他所有訊息」的預設回覆。</span></div>`;
          if (r.matched) store.set(ukey("tested"), true);
        } catch (err) {
          toast(err.message, true);
        }
      });
  }

  /* =========================================================
     Connections
     ========================================================= */
  PAGES.connections = async (el, args) => {
    if (args[0] === "connect" && args[1]) return renderConnect(el, args[1]);
    const [list, o] = await Promise.all([api("/channels"), api("/overview")]);
    const connectBtn = o.app_configured ? `<a class="btn btn-fb" href="/auth/facebook">${icon("facebook")}連接 Facebook</a>` : "";
    const broken = list.filter((c) => c.status === "broken");
    el.innerHTML = `<div class="page narrow">
      ${pageHead("連接帳號", "連接粉絲專頁與 Instagram 後，自動回覆才會生效。", list.length ? connectBtn : "")}
      ${broken.length && o.app_configured ? `<div class="banner danger">${icon("alert")}<div class="grow"><b>有 ${broken.length} 個帳號的連線失效，</b>自動回覆送不出去。常見原因：改了 Facebook 密碼、移除了 App 授權，或你不再是專頁管理員。重新連接就會恢復。</div><a class="btn btn-sm btn-primary" href="/auth/facebook">${icon("facebook")}重新連接</a></div>` : ""}
      ${!o.app_configured ? (isOwner() ? `<div class="banner brand">${icon("sliders")}<div class="grow">要先完成 Meta App 設定，才能連接粉絲專頁。</div><a class="btn btn-sm btn-primary" href="#setup/meta">前往設定</a></div>` : `<div class="banner warning">${icon("info")}<div class="grow">平台管理員還沒完成設定，暫時無法連接。</div></div>`) : ""}
      <div class="card">
        ${list.length
          ? list
              .map(
                (c) => `<div class="conn">
                  <div class="ci ${c.platform === "instagram" ? "ig" : "fb"}">${icon(c.platform === "instagram" ? "instagram" : "facebook")}</div>
                  <div class="cm"><b>${esc(c.name)}</b><span>${c.platform === "instagram" ? "Instagram 專業帳號" : "Facebook 粉絲專頁"} · ID ${esc(c.external_id)}</span>${c.status === "broken" && c.last_error ? `<span class="conn-err">${esc(c.last_error)}</span>` : ""}</div>
                  ${c.status === "broken" ? '<span class="badge danger"><span class="bdot"></span>需要重新連接</span>' : '<span class="badge success"><span class="bdot"></span>已連接</span>'}
                  <div class="row" style="gap:2px">
                    <button class="btn btn-ghost btn-sm" data-test="${c.id}" data-busy="檢查中">檢查</button>
                    ${c.platform === "messenger" ? `<button class="btn btn-ghost btn-sm" data-sub="${c.id}" data-busy="處理中" title="重新訂閱 Webhook 並設定開始使用按鈕">修復</button>` : ""}
                    <button class="btn btn-ghost btn-sm btn-danger icon-btn" data-del="${c.id}" aria-label="移除">${icon("trash")}</button>
                  </div></div>`,
              )
              .join("")
          : empty(
              "plug",
              "連接你的 Facebook 粉絲專頁",
              "按下按鈕會開啟 Facebook，選擇要連接的粉絲專頁並允許權限即可。綁定在專頁上的 Instagram 專業帳號會一起連上。",
              connectBtn || `<button class="btn" disabled>${icon("facebook")}連接 Facebook</button>`,
            )}
      </div>
      ${list.length ? "" : `<div class="grid-2" style="margin-top:16px">
        ${miniInfo("shield", "安全", "我們只取得傳送訊息需要的權限，不會在你的專頁發文。")}
        ${miniInfo("zap", "全自動", "連接後會自動完成 Webhook 訂閱與「開始使用」按鈕設定。")}
      </div>`}
      <div class="stack-sm" style="margin-top:16px">${IG_CHECKLIST(list.some((c) => c.platform === "instagram"))}${CONFLICT_TIP}</div>
      <details class="adv" style="margin-top:24px"><summary>${icon("right")}進階：用存取權杖手動新增</summary>
        <div class="card" style="margin-top:12px"><div class="card-body stack">
          <div class="grid-2">
            <label class="field"><span class="label">平台</span><select class="input" id="ch-platform"><option value="messenger">Facebook 粉絲專頁</option><option value="instagram">Instagram</option></select></label>
            <label class="field"><span class="label">專頁或帳號 ID</span><input class="input" id="ch-id"/></label>
          </div>
          <label class="field"><span class="label">顯示名稱</span><input class="input" id="ch-name"/></label>
          <label class="field"><span class="label">存取權杖</span><input class="input" type="password" id="ch-token"/></label>
          <label class="check"><input type="checkbox" id="ch-iglogin"/>這是「Instagram 登入」取得的權杖</label>
          <div><button class="btn" id="ch-save" data-busy="儲存中">儲存</button></div>
        </div></div>
      </details>
    </div>`;
    $("#ch-save").onclick = (e) =>
      busy(e.currentTarget, async () => {
        try {
          await api("/channels", { method: "POST", body: { platform: $("#ch-platform").value, external_id: $("#ch-id").value, name: $("#ch-name").value, access_token: $("#ch-token").value, instagram_login: $("#ch-iglogin").checked } });
          toast("已新增");
          PAGES.connections(el, []);
        } catch (err) {
          toast(err.message, true);
        }
      });
    $$("[data-test]", el).forEach((b) => (b.onclick = () => busy(b, async () => {
      try { const r = await api(`/channels/${b.dataset.test}/test`, { method: "POST" }); toast(`連線正常：${r.result.name || r.result.id}${r.resubscribed ? "（已自動補上訂閱設定）" : ""}`); }
      catch (err) { toast(`連線有問題：${err.message}。請重新連接 Facebook。`, true); }
      PAGES.connections(el, []);
    })));
    $$("[data-sub]", el).forEach((b) => (b.onclick = () => busy(b, async () => {
      try { await api(`/channels/${b.dataset.sub}/subscribe`, { method: "POST" }); toast("已重新設定完成"); } catch (err) { toast(err.message, true); }
    })));
    $$("[data-del]", el).forEach((b) => (b.onclick = async () => {
      const c = list.find((x) => x.id === Number(b.dataset.del));
      if (!(await confirmDialog("移除連接", `移除「${c.name}」後，這個帳號的訊息就不會再自動回覆。`, "移除", true))) return;
      await api(`/channels/${c.id}`, { method: "DELETE" });
      toast("已移除");
      PAGES.connections(el, []);
    }));
  };
  /** Instagram 收不到自動回覆時最常見的三個原因 */
  const IG_CHECKLIST = (open = false) => `<details class="adv check-box" ${open ? "" : ""}><summary>${icon("right")}${icon("instagram").replace("<svg", '<svg style="width:16px;height:16px;color:#d62976"')}Instagram 收不到自動回覆？檢查這 3 件事</summary>
      <ol class="todo-list num">
        <li><b>切換成專業帳號：</b>Instagram App →「設定和動態 → 帳號類型和工具」→ 切換為商業或創作者帳號。</li>
        <li><b>綁定到粉絲專頁：</b>在 Meta 商業套件或粉絲專頁「設定 → 已連結的帳號」連結這個 Instagram，再回來重新連接 Facebook。</li>
        <li><b>允許存取訊息（最常漏掉）：</b>Instagram App →「設定和動態 → 訊息和限時動態回覆 → 訊息控制 → 已連結的工具」→ 打開「允許存取訊息」。</li>
      </ol></details>`;
  const CONFLICT_TIP = `<details class="adv check-box"><summary>${icon("right")}${icon("message").replace("<svg", '<svg style="width:16px;height:16px;color:var(--brand)"')}避免客人收到兩則回覆</summary>
      <p class="small muted" style="margin:10px 0 0">如果專頁在 Meta 商業套件開著「即時回覆」「常見問題」或「離開訊息」，客人會同時收到它和這裡的回覆。到 <a href="${BIZ_AUTOMATIONS}" target="_blank" rel="noopener">Meta 商業套件 → 收件匣 → 自動化</a> 把它們關掉。小編在收件匣回覆客人時，這裡會自動暫停那位客人的自動回覆 30 分鐘。</p></details>`;
  const miniInfo = (ic, t, d) => `<div class="card card-body" style="padding:16px 18px"><div class="row" style="gap:8px;margin-bottom:4px;color:var(--text)">${icon(ic).replace("<svg", '<svg style="width:16px;height:16px;color:var(--brand)"')}<b>${t}</b></div><p class="small muted">${d}</p></div>`;

  async function renderConnect(el, pendingId) {
    let pages, missing, missingIg;
    try {
      ({ pages, missing, missing_instagram: missingIg } = await api(`/facebook/pending/${pendingId}`));
    } catch (err) {
      toast(err.message, true);
      location.hash = "#connections";
      return;
    }
    el.innerHTML = `<div class="page narrow">
      ${backLink("#connections", "連接帳號")}
      ${pageHead("選擇要連接的粉絲專頁", "勾選後按「連接」，其餘設定會自動完成。")}
      ${missing.length ? `<div class="banner danger">${icon("alert")}<div class="grow"><b>授權時沒有允許：${missing.map((m) => esc(m.label)).join("、")}。</b> 少了這些權限，自動回覆無法運作。按「重新授權」，在 Facebook 視窗把所有項目都打開。</div><a class="btn btn-sm btn-primary" href="/auth/facebook?rerequest=1">重新授權</a></div>` : ""}
      ${!missing.length && missingIg.length ? `<div class="banner warning">${icon("instagram")}<div class="grow"><b>沒有允許 Instagram 的權限（${missingIg.map((m) => esc(m.label)).join("、")}），</b>Instagram 的私訊不會自動回覆。只用 Messenger 的話可以忽略。</div><a class="btn btn-sm" href="/auth/facebook?rerequest=1">重新授權</a></div>` : ""}
      <div class="card"><div class="card-body stack-sm" id="pick">
        ${pages
          .map(
            (p) => `<label class="page-pick" ${p.connected_by_other ? 'style="opacity:.55;cursor:not-allowed"' : ""}>
              <input type="checkbox" value="${esc(p.id)}" ${p.connected_by_other ? "disabled" : p.already_connected ? "" : "checked"}/>
              <div class="pi">${esc((p.name || "?").slice(0, 1))}</div>
              <div style="flex:1;min-width:0"><b>${esc(p.name)}</b>
                <div class="small muted">${p.instagram ? `+ Instagram ${esc(p.instagram.username ? "@" + p.instagram.username : p.instagram.id)}` : "沒有綁定 Instagram"}</div></div>
              ${p.connected_by_other ? '<span class="badge warning">已被其他帳號使用</span>' : p.already_connected ? '<span class="badge success">已連接</span>' : ""}
            </label>`,
          )
          .join("")}
      </div><div class="card-foot"><a class="btn" href="#connections">取消</a><button class="btn btn-primary" id="go" data-busy="連接中">連接</button></div></div>
      <div id="connect-result" style="margin-top:16px"></div>
    </div>`;
    $("#go").onclick = (e) =>
      busy(e.currentTarget, async () => {
        const ids = $$("#pick input:checked").map((i) => i.value);
        if (!ids.length) return toast("請至少選一個專頁", true);
        try {
          const r = await api("/facebook/connect", { method: "POST", body: { pending_id: pendingId, page_ids: ids } });
          const ok = r.results.every((x) => x.subscribed && !x.errors.length);
          const hasIg = r.results.some((x) => x.instagram);
          el.innerHTML = `<div class="page narrow"><div class="card">${empty(
            ok ? "check" : "alert",
            ok ? "連接完成" : "已連接，但有部分設定沒完成",
            r.results.map((x) => `<b>${esc(x.name)}</b>${x.instagram ? ` 與 Instagram @${esc(x.instagram)}` : ""}${x.errors.length ? `<br/><span style="color:var(--danger)">${x.errors.map(esc).join("<br/>")}</span>` : ""}`).join("<br/>"),
            `<a class="btn btn-primary" href="#automations/new">${icon("plus")}建立自動回覆</a><a class="btn" href="#connections">查看連接</a>`,
          )}</div>
          <div class="card card-body" style="margin-top:16px"><div class="section-title">上線前再確認 ${hasIg ? "2" : "1"} 件事</div>
            <ol class="todo-list num" style="margin-top:10px">
              <li><b>關掉專頁原本的自動回覆：</b>到 <a href="${BIZ_AUTOMATIONS}" target="_blank" rel="noopener">Meta 商業套件 → 自動化</a> 關閉「即時回覆」「常見問題」，客人才不會收到兩則。</li>
              ${hasIg ? `<li><b>Instagram 允許存取訊息：</b>Instagram App →「設定和動態 → 訊息和限時動態回覆 → 訊息控制 → 已連結的工具」→ 打開「允許存取訊息」。</li>` : ""}
            </ol></div></div>`;
        } catch (err) {
          toast(err.message, true);
        }
      });
  }

  /* =========================================================
     Contacts
     ========================================================= */
  PAGES.contacts = async (el, args) => {
    if (args[0]) return renderContact(el, Number(args[0]));
    const list = await api("/contacts");
    el.innerHTML = `<div class="page">
      ${pageHead("聯絡人", "所有傳過訊息或從廣告點進來的人。")}
      <div class="card">${
        list.length
          ? `<div class="table-wrap"><table class="table"><thead><tr><th>名字</th><th>平台</th><th>來源</th><th>標籤</th><th>最後互動</th></tr></thead><tbody>
            ${list
              .map(
                (c) => `<tr style="cursor:pointer" data-href="#contacts/${c.id}">
                <td class="primary-cell"><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="avatar" style="width:28px;height:28px;font-size:12px">${esc((c.first_name || "?").slice(0, 1))}</div>${esc([c.first_name, c.last_name].filter(Boolean).join(" ") || "（未取得名字）")}</div></td>
                <td>${platformBadge(c.platform)}</td>
                <td>${c.source_ad_id ? `<span class="badge brand">廣告 ${esc(c.source_ad_id)}</span>` : c.source_ref ? `<span class="badge info">ref ${esc(c.source_ref)}</span>` : '<span class="muted">直接訊息</span>'}</td>
                <td>${c.tags.map((t) => `<span class="badge">${esc(t)}</span>`).join(" ") || '<span class="subtle">—</span>'}</td>
                <td class="muted nowrap">${ago(c.last_seen)}</td></tr>`,
              )
              .join("")}</tbody></table></div>`
          : empty("users", "還沒有聯絡人", "連接粉絲專頁並開始投放廣告後，客人會出現在這裡。", `<a class="btn" href="#connections">連接帳號</a>`)
      }</div></div>`;
    $$("[data-href]", el).forEach((tr) => (tr.onclick = () => (location.hash = tr.dataset.href)));
  };
  async function renderContact(el, id) {
    const { contact: c, events: evs } = await api(`/contacts/${id}`);
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "（未取得名字）";
    const paused = c.paused_until && Date.parse(c.paused_until) > Date.now();
    el.innerHTML = `<div class="page">
      ${backLink("#contacts", "聯絡人")}
      ${paused ? `<div class="banner info">${icon("pause")}<div class="grow"><b>小編接手中，</b>這位客人的自動回覆暫停到 ${fmtTime(c.paused_until)}。</div><button class="btn btn-sm" id="c-resume">${icon("play")}現在恢復自動回覆</button></div>` : ""}
      ${pageHead(name, `${platformBadge(c.platform)} · 第一次互動 ${fmtDate(c.first_seen)}`, `<button class="btn btn-danger" id="c-del">${icon("trash")}刪除</button>`)}
      <div class="editor" style="grid-template-columns:minmax(0,1fr) 340px">
        <div class="card"><div class="card-head"><h3>互動記錄</h3></div>${evs.length ? `<div class="timeline">${evs.map(tlItem).join("")}</div>` : empty("activity", "沒有記錄", "")}</div>
        <div class="stack">
          <div class="card card-body"><dl class="kv">
            <dt>來源廣告</dt><dd>${esc(c.source_ad_id) || "—"}</dd>
            <dt>ref 參數</dt><dd>${esc(c.source_ref) || "—"}</dd>
            <dt>標籤</dt><dd>${c.tags.map((t) => `<span class="badge">${esc(t)}</span>`).join(" ") || "—"}</dd>
            <dt>最後互動</dt><dd>${fmtTime(c.last_seen)}</dd>
          </dl></div>
          <div class="card card-body stack-sm">
            <b>傳送訊息</b><p class="small muted">Meta 規定只能在客人最後一次互動後 24 小時內主動傳訊息。</p>
            <textarea class="input" id="m-text" placeholder="輸入訊息…" style="min-height:80px"></textarea>
            <div class="row end"><button class="btn btn-primary btn-sm" id="m-send" data-busy="傳送中">傳送</button></div>
          </div>
        </div>
      </div></div>`;
    $("#m-send").onclick = (e) => busy(e.currentTarget, async () => {
      try { await api(`/contacts/${id}/send`, { method: "POST", body: { text: $("#m-text").value } }); toast("已傳送"); renderContact(el, id); } catch (err) { toast(err.message, true); }
    });
    $("#c-resume") && ($("#c-resume").onclick = async () => { await api(`/contacts/${id}/resume`, { method: "POST" }); toast("已恢復自動回覆"); renderContact(el, id); });
    $("#c-del").onclick = async () => {
      if (!(await confirmDialog("刪除聯絡人", "會刪除這位聯絡人的資料，無法復原。", "刪除", true))) return;
      await api(`/contacts/${id}`, { method: "DELETE" });
      location.hash = "#contacts";
    };
  }

  /* =========================================================
     Activity
     ========================================================= */
  const EV = {
    automation: ["自動回覆", "brand"], sent: ["已送出", "success"], message: ["收到訊息", ""], postback: ["按下按鈕", ""], referral: ["廣告進入", "info"],
    click: ["點擊連結", "success"], info: ["系統", "info"], warning: ["注意", "warning"], error: ["錯誤", "danger"],
    handover: ["小編接手", "info"], paused: ["暫停中", ""], conflict: ["重複回覆", "warning"],
  };
  const tlItem = (e) => {
    const [label, cls] = EV[e.type] || [e.type, ""];
    return `<div class="tl-item"><div class="when">${fmtTime(e.created_at)}</div><div><span class="badge ${cls}">${label}</span> <span>${esc(e.summary)}</span></div></div>`;
  };
  PAGES.activity = async (el, _args, query) => {
    const all = isOwner() && query.get("scope") === "all";
    const [evs, lk] = await Promise.all([api(`/events${all ? "?scope=all" : ""}`), api("/links")]);
    el.innerHTML = `<div class="page">
      ${pageHead("活動記錄", "收到的訊息、送出的回覆與任何問題，都記錄在這裡。", `${isOwner() ? `<a class="btn btn-sm" href="${all ? "#activity" : "#activity?scope=all"}">${all ? "只看我的" : "看全平台"}</a>` : ""}<button class="btn btn-sm" id="ref">${icon("refresh")}重新整理</button>`)}
      <div class="editor" style="grid-template-columns:minmax(0,1fr) 340px">
        <div class="card">${evs.length ? `<div class="timeline">${evs.map((e) => tlItem(e).replace('<span>' + esc(e.summary) + "</span>", `<span>${esc(e.summary)}</span>${e.contact_id ? ` <a class="small" href="#contacts/${e.contact_id}">查看聯絡人</a>` : ""}`)).join("")}</div>` : empty("activity", "還沒有活動", "有人傳訊息或點廣告後，這裡就會開始出現記錄。")}</div>
        <div class="card"><div class="card-head"><div><h3>導購連結</h3><p>按鈕連結的點擊次數</p></div></div>
          ${lk.length ? `<div class="timeline">${lk.map((l) => `<div class="tl-item" style="grid-template-columns:1fr auto"><div class="small" style="word-break:break-all">${esc(l.url)}</div><b>${num(l.clicks)}</b></div>`).join("")}</div>` : `<div class="card-body small muted">建立含按鈕的自動回覆後，會自動產生追蹤連結。</div>`}
        </div>
      </div></div>`;
    $("#ref").onclick = () => PAGES.activity(el, [], query);
  };

  /* =========================================================
     Billing
     ========================================================= */
  PAGES.billing = async (el) => {
    const b = await api("/billing");
    state.me.user.subscription = b.subscription;
    renderPlanChip();
    const sub = b.subscription;
    const status = {
      owner: ["平台擁有者", "brand", "你不受方案限制。下面的購買按鈕可用來測試付款流程。"],
      paid: ["付費方案", "success", `到期日 ${fmtDate(sub.until)}，剩 ${sub.days_left} 天。再次購買會從到期日往後延長。`],
      trial: ["免費試用", "info", `試用到 ${fmtDate(sub.until)}，剩 ${sub.days_left} 天。購買後從今天起算。`],
      expired: ["已到期", "danger", `已於 ${fmtDate(sub.until)} 到期，自動回覆已暫停。購買後立即恢復。`],
      none: ["尚未開通", "danger", "購買方案以開始使用。"],
    }[sub.source];
    const best = b.plans.reduce((m, p) => (p.months > (m?.months || 0) ? p : m), null);
    const features = ["無限自動回覆", "Messenger 與 Instagram", "導購連結點擊追蹤", "聯絡人與來源記錄"];
    el.innerHTML = `<div class="page">
      ${pageHead("方案與付款", "")}
      <div class="stack">
        <div class="card card-body row between"><div><div class="row"><b style="font-size:15px">目前方案</b><span class="badge ${status[1]}">${status[0]}</span></div><p class="muted" style="margin-top:4px">${status[2]}</p></div></div>
        ${!b.payuni_configured ? `<div class="banner warning">${icon("info")}<div class="grow">${isOwner() ? "還沒設定 PayUni 金流，用戶無法線上付款。" : "線上付款暫時無法使用，請聯絡平台管理員。"}</div>${isOwner() ? '<a class="btn btn-sm btn-primary" href="#setup/payuni">前往設定</a>' : ""}</div>` : b.payuni_sandbox ? `<div class="banner info">${icon("flask")}<div class="grow">金流目前是<b>測試模式</b>，不會真的扣款。</div></div>` : ""}
        <div class="plan-grid">
          ${b.plans
            .map((p) => {
              const featured = best && p.id === best.id && b.plans.length > 1;
              return `<div class="plan-card ${featured ? "featured" : ""}">
                ${featured ? '<span class="badge brand tag">最划算</span>' : ""}
                <div class="pn">${esc(p.name)}</div>
                <div class="pp">${money(p.price)} <small>/ ${p.months === 1 ? "月" : p.months === 12 ? "年" : `${p.months} 個月`}</small></div>
                <div class="small muted">${p.months > 1 ? `相當於每月 ${money(Math.round(p.price / p.months))}` : "單月購買，到期前會提醒續約"}</div>
                <ul class="feat">${features.map((f) => `<li>${icon("check")}${f}</li>`).join("")}</ul>
                <button class="btn ${featured ? "btn-primary" : ""} btn-block" data-buy="${p.id}" data-busy="前往付款" ${b.payuni_configured ? "" : "disabled"}>${sub.source === "paid" ? "延長" : "選擇此方案"}</button>
              </div>`;
            })
            .join("") || '<p class="muted">目前沒有可購買的方案。</p>'}
        </div>
        <p class="small muted">${icon("shield").replace("<svg", '<svg style="width:14px;height:14px;vertical-align:-2px"')} 付款由 PAYUNi 統一金流安全處理，支援信用卡等方式。付款完成後會自動回到這裡。</p>
        <div class="card"><div class="card-head"><h3>付款記錄</h3></div>
          ${b.orders.length
            ? `<div class="table-wrap"><table class="table"><thead><tr><th>日期</th><th>方案</th><th>金額</th><th>狀態</th><th>訂單編號</th></tr></thead><tbody>${b.orders
                .map((o) => `<tr><td class="nowrap">${fmtDate(o.created_at)}</td><td>${esc(o.plan_name)}</td><td>${money(o.amount)}</td><td>${orderBadge(o.status)}</td><td class="mono muted">${esc(o.order_no)}</td></tr>`)
                .join("")}</tbody></table></div>`
            : `<div class="card-body small muted">還沒有付款記錄。</div>`}
        </div>
      </div></div>`;
    $$("[data-buy]", el).forEach((btn) => {
      btn.onclick = () =>
        busy(btn, async () => {
          try {
            const r = await api("/billing/checkout", { method: "POST", body: { plan_id: Number(btn.dataset.buy) } });
            const form = document.createElement("form");
            form.method = "POST";
            form.action = r.action;
            for (const [k, v] of Object.entries(r.fields)) {
              const i = document.createElement("input");
              i.type = "hidden";
              i.name = k;
              i.value = v;
              form.appendChild(i);
            }
            document.body.appendChild(form);
            form.submit();
            await new Promise(() => {}); // 保持 loading 直到離開頁面
          } catch (err) {
            toast(err.message, true);
          }
        });
    });
  };
  const orderBadge = (s) => (s === "paid" ? '<span class="badge success">已付款</span>' : s === "failed" ? '<span class="badge danger">失敗</span>' : '<span class="badge">未完成</span>');

  /* =========================================================
     Account
     ========================================================= */
  PAGES.account = async (el) => {
    const u = state.me.user;
    el.innerHTML = `<div class="page narrow">
      ${pageHead("帳號設定", "")}
      <div class="stack">
        <div class="card card-body"><dl class="kv"><dt>名字</dt><dd>${esc(u.name)}</dd><dt>Email</dt><dd>${esc(u.email)}</dd><dt>角色</dt><dd>${u.role === "owner" ? "平台擁有者" : "用戶"}</dd><dt>加入日期</dt><dd>${fmtDate(u.created_at)}</dd></dl></div>
        <div class="card"><div class="card-head"><h3>變更密碼</h3></div><div class="card-body stack">
          <label class="field"><span class="label">目前密碼</span><input class="input" type="password" id="pw-cur" autocomplete="current-password"/></label>
          <label class="field"><span class="label">新密碼</span><input class="input" type="password" id="pw-new" autocomplete="new-password" placeholder="至少 8 個字元"/></label>
        </div><div class="card-foot"><button class="btn btn-primary" id="pw-save" data-busy="更新中">更新密碼</button></div></div>
      </div></div>`;
    $("#pw-save").onclick = (e) => busy(e.currentTarget, async () => {
      try { await api("/auth/password", { method: "POST", body: { current: $("#pw-cur").value, password: $("#pw-new").value } }); toast("密碼已更新"); $("#pw-cur").value = $("#pw-new").value = ""; } catch (err) { toast(err.message, true); }
    });
  };

  /* =========================================================
     Admin: platform setup wizard
     ========================================================= */
  const SETUP_STEPS = [
    { id: "general", title: "基本資料", desc: "名稱與試用設定" },
    { id: "meta", title: "Meta App", desc: "讓用戶能連接粉絲專頁" },
    { id: "payuni", title: "PayUni 金流", desc: "讓用戶能線上付款" },
    { id: "plans", title: "方案與價格", desc: "用戶可購買的方案" },
  ];
  /** 送審時每個權限的用途說明（審查人員看英文） */
  const REVIEW_COPY = [
    { perm: "pages_messaging", zh: "用粉絲專頁傳送訊息", en: "Our platform lets businesses automatically reply to people who message their Facebook Page, mainly people who click their Click-to-Messenger ads. When a message or ad referral arrives, we send the reply the business configured (text and buttons linking to the business's own website). Messages are only sent in response to the person's action, within the standard messaging window." },
    { perm: "pages_show_list", zh: "列出粉絲專頁", en: "After the business logs in with Facebook, we list the Pages they manage so they can choose which Page to connect to the auto-reply service. We only store the Pages they select." },
    { perm: "pages_manage_metadata", zh: "接收專頁的新訊息通知", en: "We use this permission to subscribe the selected Page to our app's webhooks (messages, postbacks, referrals, message echoes) and to set the Messenger \"Get Started\" button, so we can receive messages and reply automatically." },
    { perm: "pages_read_engagement", zh: "讀取專頁基本資料", en: "We read the Page name and basic metadata to show the business which Page is connected in their dashboard and to verify the connection is healthy." },
    { perm: "business_management", zh: "讀取商業管理平台中的專頁", en: "Many businesses manage their Pages through Business Manager. This permission lets us list those Pages during connection so the business can select them." },
    { perm: "instagram_basic", zh: "讀取 Instagram 帳號", en: "We read the Instagram professional account linked to the business's Page (ID and username) so the business can connect it and see it in the dashboard." },
    { perm: "instagram_manage_messages", zh: "收發 Instagram 私訊", en: "We automatically reply to Instagram Direct messages and Click-to-Instagram ad referrals with the reply the business configured, including links to the business's website. Replies are only sent in response to the person's message." },
    { perm: "ads_read", zh: "讀取廣告清單", optional: true, en: "Optional. When the business sets up an auto-reply for a specific ad, we list the ads in their ad accounts (name, ID and status only) so they can pick the ad instead of copying the ad ID manually, and show how many conversations each ad started." },
  ];
  const SCREENCAST = `1. Open the platform and log in as a business user.
2. Go to "Connect accounts" and click "Connect Facebook". Show the Facebook login dialog and the permissions requested, select a Page and its Instagram account, then confirm.
3. Show the connected Page and Instagram account in the dashboard.
4. Create an auto-reply: trigger "Someone clicked my ad", message text, and a button that links to the business website. Save it.
5. From a separate test Facebook account, open the Page in Messenger (or click a test Click-to-Messenger ad) and send a message. Show the automatic reply arriving with the button, then tap the button and show the website opening.
6. Repeat step 5 on Instagram Direct for instagram_manage_messages.
7. Show the "Contacts" page listing the person who messaged.`;
  const copyBlock = (text) => `<div class="copy-block"><pre>${esc(text)}</pre><button type="button" class="btn btn-sm" data-copy="${esc(text)}">${icon("copy")}複製</button></div>`;

  PAGES.setup = async (el, args) => {
    if (!isOwner()) return (location.hash = "#home");
    const [s, plans] = await Promise.all([api("/settings"), api("/billing/plans")]);
    const metaDone = !!(s.meta_app_id && s.meta_app_secret_set);
    const done = { general: !!store.get(ukey("setup_general")) || metaDone, meta: !!(s.meta_app_id && s.meta_app_secret_set), payuni: !!(s.payuni_mer_id && s.payuni_hash_key_set && s.payuni_hash_iv_set), plans: plans.some((p) => p.active) };
    const step = SETUP_STEPS.find((x) => x.id === args[0])?.id || SETUP_STEPS.find((x) => !done[x.id])?.id || "general";
    const idx = SETUP_STEPS.findIndex((x) => x.id === step);
    const next = SETUP_STEPS[idx + 1];
    el.innerHTML = `<div class="page">
      ${pageHead("平台設定", "設定一次就好。完成後，用戶可以自行註冊、連接專頁並付款。")}
      <div class="setup">
        <nav class="stepper" aria-label="設定步驟">${SETUP_STEPS.map((x, i) => `<a href="#setup/${x.id}" class="${x.id === step ? "active" : ""} ${done[x.id] ? "done" : ""}"><span class="sn">${done[x.id] ? icon("check") : i + 1}</span><span><div>${x.title}</div><div class="sd">${x.desc}</div></span></a>`).join("")}</nav>
        <div id="setup-body"></div>
      </div></div>`;
    const body = $("#setup-body");
    const goNext = () => (location.hash = next ? `#setup/${next.id}` : "#home");
    const footer = (label = next ? "儲存並繼續" : "完成設定") => `<div class="card-foot"><button class="btn btn-primary" id="save-step" data-busy="儲存中">${label}${next ? icon("right") : icon("check")}</button></div>`;
    const save = async (payload) => {
      await api("/settings", { method: "POST", body: payload });
      state.me = await api("/auth/me");
    };

    if (step === "general") {
      body.innerHTML = `<div class="card"><div class="card-head"><div><h3>基本資料</h3><p>用戶在登入頁和後台看到的資訊。</p></div></div><div class="card-body stack">
        <label class="field"><span class="label">平台名稱</span><input class="input" id="g-name" value="${esc(s.app_name)}"/></label>
        <div class="grid-2">
          <label class="field"><span class="label">免費試用天數</span><input class="input" type="number" min="0" max="365" id="g-trial" value="${s.trial_days}"/><span class="help">填 0 代表不提供試用。</span></label>
          <label class="field"><span class="label">開放註冊</span><select class="input" id="g-signup"><option value="1" ${s.allow_signup ? "selected" : ""}>開放，任何人都能註冊</option><option value="0" ${!s.allow_signup ? "selected" : ""}>關閉，只有現有用戶能登入</option></select></label>
        </div>
        <label class="field"><span class="label">對外網址（選填）</span><input class="input" id="g-url" value="${esc(s.public_url)}" placeholder="${esc(s.resolved_public_url)}"/><span class="help">綁定自己的網域後再填。留空時會自動使用目前的網址：${esc(s.resolved_public_url)}</span></label>
      </div>${footer()}</div>`;
      $("#save-step").onclick = (e) => busy(e.currentTarget, async () => {
        try { await save({ app_name: $("#g-name").value, trial_days: Number($("#g-trial").value), allow_signup: $("#g-signup").value === "1", public_url: $("#g-url").value }); store.set(ukey("setup_general"), true); toast("已儲存"); goNext(); } catch (err) { toast(err.message, true); }
      });
    }

    if (step === "meta") {
      body.innerHTML = `<div class="card"><div class="card-head"><div><h3>連接 Meta App</h3><p>所有用戶都會透過這個 App 連接他們的粉絲專頁。大約 10 分鐘。</p></div><a class="btn btn-sm" href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">${icon("external")}Meta 開發者後台</a></div>
        <div class="card-body"><ol class="guide">
          <li><div><b>建立 App</b><p class="muted small">在 Meta 開發者後台按「建立應用程式」，用途選「其他」，類型選「商家」。</p></div></li>
          <li><div><b>加入三個產品</b><p class="muted small">在 App 主控板加入 <b>Facebook 登入（商家版）</b>、<b>Messenger</b>、<b>Instagram</b>。</p></div></li>
          <li><div><b>貼上 App 金鑰</b><p class="muted small">在「應用程式設定 → 基本資料」找到 App ID 與 App 密鑰。</p>
            <div class="grid-2">
              <label class="field"><span class="label">App ID</span><input class="input" id="m-id" value="${esc(s.meta_app_id)}" inputmode="numeric" placeholder="1234567890123456"/></label>
              <label class="field"><span class="label">App 密鑰 ${s.meta_app_secret_set ? '<span class="badge success">已儲存</span>' : ""}</span><input class="input" id="m-secret" type="password" placeholder="${s.meta_app_secret_set ? "已儲存，留空不更改" : "貼上 App 密鑰"}"/></label>
            </div>
            <div class="row"><button class="btn" id="m-test" data-busy="測試中">${icon("check")}儲存並測試</button><span id="m-test-result"></span></div>
          </div></li>
          <li><div><b>設定登入回呼網址</b><p class="muted small">到「Facebook 登入（商家版）→ 設定」，把下面的網址貼到「有效的 OAuth 重新導向 URI」並儲存。</p>${copyField(s.oauth_redirect_url)}
            <details class="adv" ${s.meta_login_config_id ? "open" : ""}><summary>${icon("right")}Meta 要求建立「設定」？填入設定 ID</summary>
              <div class="stack-sm" style="margin-top:10px"><p class="small muted">商家類型的 App 有時要先在「Facebook 登入（商家版）→ 設定」建立一組設定：登入類型選「用戶存取權杖」，權限勾選 ${REVIEW_COPY.filter((r) => !r.optional).map((r) => `<code>${r.perm}</code>`).join("、")}，資產勾選「粉絲專頁」與「Instagram 帳號」。建立後把設定 ID 貼到這裡；不需要就留空。</p>
                <label class="field"><span class="label">設定 ID（選填）</span><input class="input" id="m-config" value="${esc(s.meta_login_config_id)}" inputmode="numeric" placeholder="例如 1234567890123456"/></label></div></details>
          </div></li>
          <li><div><b>登記 Webhook</b><p class="muted small">讓 Meta 把訊息送到這個平台。按下按鈕自動完成。</p>
            <div class="row"><button class="btn" id="m-hook" data-busy="登記中" ${s.meta_app_secret_set ? "" : "disabled"}>${icon("zap")}自動登記 Webhook</button><span id="m-hook-result"></span></div>
            <details class="adv"><summary>${icon("right")}自動登記失敗？手動設定</summary>
              <div class="stack-sm" style="margin-top:10px"><p class="small muted">在 Messenger 與 Instagram 產品的「Webhooks」設定填入：</p>
                <span class="small"><b>回呼網址</b></span>${copyField(s.webhook_url)}
                <span class="small"><b>驗證權杖</b></span>${copyField(s.verify_token)}
                <span class="small"><b>訂閱欄位</b>：${s.webhook_fields.map((f) => `<code>${f}</code>`).join("、")}</span>
              </div></details>
          </div></li>
          <li><div><b>填入隱私權政策與資料刪除網址</b><p class="muted small">App 要切換到上線模式，Meta 規定一定要有這些網址。頁面已經做好了，複製貼上即可。<a href="/privacy" target="_blank" rel="noopener">預覽隱私權政策 ↗</a></p>
            <div class="stack-sm">
              <span class="small"><b>隱私政策網址</b>（應用程式設定 → 基本資料）</span>${copyField(s.privacy_url)}
              <span class="small"><b>服務條款網址</b>（應用程式設定 → 基本資料）</span>${copyField(s.terms_url)}
              <span class="small"><b>用戶資料刪除</b>（應用程式設定 → 基本資料，選「資料刪除回呼網址」）</span>${copyField(s.data_deletion_url)}
              <span class="small"><b>取消授權回呼網址</b>（Facebook 登入（商家版）→ 設定）</span>${copyField(s.deauthorize_url)}
              <label class="field" style="margin-top:6px"><span class="label">頁面上的聯絡信箱</span><input class="input" id="m-email" type="email" value="${esc(s.support_email)}" placeholder="${esc(state.me.user.email)}"/><span class="help">客人要求刪除資料時寫信到這裡。留空會用你的登入 Email。</span></label>
            </div></div></li>
          <li><div><b>完成商家驗證</b><p class="muted small">要讓其他商家用你的 App 收發訊息，Meta 會要求你的公司通過驗證。這一步只能由你本人在 Meta 完成：</p>
            <ul class="todo-list">
              <li>到 <a href="https://business.facebook.com/settings/security" target="_blank" rel="noopener">企業管理平台 → 安全中心</a> 按「開始驗證」</li>
              <li>準備公司登記資料：公司名稱、統一編號、地址、電話（要跟登記文件一致）</li>
              <li>準備一個能收信的公司網域 Email，或可以放驗證檔的網站</li>
              <li>在 App 的「應用程式設定 → 基本資料」把 App 連到這個企業管理平台</li>
              <li>若 App 主控板出現「存取驗證」或「技術供應商驗證」，照指示填寫：用途選「為其他商家提供服務」</li>
            </ul></div></li>
          <li><div><b>送審並上線</b><p class="muted small">App 在開發模式時，只有你加入的測試人員能收到自動回覆。要開放給所有人，到「應用程式審查 → 權限與功能」申請下面的權限，通過後把 App 切換到「上線」。說明文字已經寫好（審查人員看英文），點一下就能複製。</p>
            <div class="review-list">${REVIEW_COPY.map((r) => `<details class="review-item"><summary><code>${r.perm}</code><span>${esc(r.zh)}</span>${r.optional ? '<span class="badge">選用</span>' : ""}${icon("right")}</summary>
              <div class="stack-sm"><span class="small muted">貼到「說明你的 App 如何使用這個權限」：</span>${copyBlock(r.en)}</div></details>`).join("")}
              <details class="review-item"><summary><code>錄影示範</code><span>每個權限都要附一段操作影片</span>${icon("right")}</summary>
                <div class="stack-sm"><span class="small muted">照這個順序錄一支影片（可以共用），畫面要看得到網址與 Facebook 授權視窗：</span>${copyBlock(SCREENCAST)}</div></details>
            </div></div></li>
        </ol></div>${footer()}</div>`;
      const saveKeys = async () => {
        const payload = { meta_app_id: $("#m-id").value.trim(), meta_login_config_id: $("#m-config").value.trim(), support_email: $("#m-email").value.trim() };
        if ($("#m-secret").value.trim()) payload.meta_app_secret = $("#m-secret").value.trim();
        await save(payload);
      };
      $("#m-test").onclick = (e) => busy(e.currentTarget, async () => {
        const out = $("#m-test-result");
        try {
          await saveKeys();
          const r = await api("/settings/test-meta", { method: "POST" });
          out.innerHTML = `<span class="result-ok">${icon("check")}連線成功：${esc(r.app.name)}</span>`;
          $("#m-hook").disabled = false;
        } catch (err) {
          out.innerHTML = `<span class="result-err">${icon("alert")}<span>${esc(err.message)}</span></span>`;
        }
      });
      $("#m-hook").onclick = (e) => busy(e.currentTarget, async () => {
        const out = $("#m-hook-result");
        try {
          const r = await api("/webhook/register", { method: "POST" });
          const bad = Object.entries(r.results).filter(([, v]) => !v.ok);
          out.innerHTML = bad.length
            ? `<span class="result-err">${icon("alert")}<span>${bad.map(([k, v]) => `${k === "page" ? "Messenger" : "Instagram"}：${esc(v.error)}`).join("<br/>")}</span></span>`
            : `<span class="result-ok">${icon("check")}Messenger 與 Instagram 都已登記</span>`;
        } catch (err) {
          out.innerHTML = `<span class="result-err">${icon("alert")}<span>${esc(err.message)}</span></span>`;
        }
      });
      $("#save-step").onclick = (e) => busy(e.currentTarget, async () => {
        try { await saveKeys(); toast("已儲存"); goNext(); } catch (err) { toast(err.message, true); }
      });
    }

    if (step === "payuni") {
      body.innerHTML = `<div class="card"><div class="card-head"><div><h3>PAYUNi 統一金流</h3><p>用戶購買方案時會導到 PayUni 的安全付款頁。</p></div><a class="btn btn-sm" href="https://www.payuni.com.tw/" target="_blank" rel="noopener">${icon("external")}PAYUNi 官網</a></div>
        <div class="card-body"><ol class="guide">
          <li><div><b>申請商店</b><p class="muted small">在 PAYUNi 申請商店帳號。建議先用<b>測試區</b>帳號，確認流程沒問題再換正式區。</p></div></li>
          <li><div><b>貼上串接資訊</b><p class="muted small">在 PayUni 商店後台的「串接資訊」頁面可以找到。</p>
            <label class="field"><span class="label">商店代號（MerID）</span><input class="input" id="p-mer" value="${esc(s.payuni_mer_id)}"/></label>
            <div class="grid-2">
              <label class="field"><span class="label">Hash Key ${s.payuni_hash_key_set ? '<span class="badge success">已儲存</span>' : ""}</span><input class="input" id="p-key" type="password" maxlength="32" placeholder="${s.payuni_hash_key_set ? "已儲存，留空不更改" : "32 個字元"}"/><span class="error-text" id="e-key"></span></label>
              <label class="field"><span class="label">Hash IV ${s.payuni_hash_iv_set ? '<span class="badge success">已儲存</span>' : ""}</span><input class="input" id="p-iv" type="password" maxlength="16" placeholder="${s.payuni_hash_iv_set ? "已儲存，留空不更改" : "16 個字元"}"/><span class="error-text" id="e-iv"></span></label>
            </div>
            <label class="row" style="gap:10px;cursor:pointer"><span class="switch"><input type="checkbox" id="p-sandbox" ${s.payuni_sandbox ? "checked" : ""}/><span class="slider"></span></span><span><b>測試模式</b> <span class="muted small">使用 PayUni 測試區，不會真的扣款</span></span></label>
          </div></li>
          <li><div><b>不需要其他設定</b><p class="muted small">付款結果通知網址會隨每筆交易自動帶給 PayUni。若 PayUni 後台要求填寫，使用下面的網址：</p>
            <span class="small"><b>通知網址（NotifyURL）</b></span>${copyField(s.payuni_notify_url)}
            <span class="small"><b>返回網址（ReturnURL）</b></span>${copyField(s.payuni_return_url)}</div></li>
          <li><div><b>測試一次</b><p class="muted small">儲存後到「方案與付款」按下購買，用 PayUni 測試卡完成付款，確認付款記錄顯示「已付款」。</p></div></li>
        </ol></div>${footer()}</div>`;
      $("#save-step").onclick = (e) => busy(e.currentTarget, async () => {
        const key = $("#p-key").value.trim();
        const iv = $("#p-iv").value.trim();
        $("#e-key").textContent = key && key.length !== 32 ? `需要 32 個字元，目前 ${key.length} 個` : "";
        $("#e-iv").textContent = iv && iv.length !== 16 ? `需要 16 個字元，目前 ${iv.length} 個` : "";
        if ((key && key.length !== 32) || (iv && iv.length !== 16)) return;
        try {
          await save({ payuni_mer_id: $("#p-mer").value.trim(), payuni_hash_key: key, payuni_hash_iv: iv, payuni_sandbox: $("#p-sandbox").checked });
          toast("已儲存");
          goNext();
        } catch (err) {
          toast(err.message, true);
        }
      });
    }

    if (step === "plans") {
      const row = (p) => `<tr data-id="${p.id || ""}">
        <td><input class="input" data-f="name" value="${esc(p.name)}" placeholder="月繳方案"/></td>
        <td><input class="input" data-f="price" type="number" min="1" value="${esc(p.price)}" style="width:110px" placeholder="990"/></td>
        <td><select class="input" data-f="months" style="width:110px">${[1, 3, 6, 12, 24].map((m) => `<option value="${m}" ${Number(p.months) === m ? "selected" : ""}>${m} 個月</option>`).join("")}</select></td>
        <td><label class="switch"><input type="checkbox" data-f="active" ${p.active ? "checked" : ""} aria-label="上架"/><span class="slider"></span></label></td>
        <td class="actions">${p.id ? `<button class="btn btn-ghost btn-sm icon-btn btn-danger" data-del-plan="${p.id}" aria-label="刪除">${icon("trash")}</button>` : ""}</td></tr>`;
      body.innerHTML = `<div class="card"><div class="card-head"><div><h3>方案與價格</h3><p>價格為新台幣，含稅。用戶購買後會從到期日往後延長。</p></div><button class="btn btn-sm" id="add-plan">${icon("plus")}新增方案</button></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>名稱</th><th>價格</th><th>期間</th><th>上架</th><th></th></tr></thead><tbody id="plan-rows">${plans.map(row).join("")}</tbody></table></div>
        ${footer("儲存並完成")}</div>`;
      $("#add-plan").onclick = () => $("#plan-rows").insertAdjacentHTML("beforeend", row({ name: "", price: "", months: 1, active: 1 }));
      $$("[data-del-plan]", body).forEach((b) => (b.onclick = async () => {
        if (!(await confirmDialog("刪除方案", "已購買的用戶不受影響。", "刪除", true))) return;
        await api(`/billing/plans/${b.dataset.delPlan}`, { method: "DELETE" });
        PAGES.setup(el, ["plans"]);
      }));
      $("#save-step").onclick = (e) => busy(e.currentTarget, async () => {
        try {
          const rows = $$("#plan-rows tr");
          for (const [i, tr] of rows.entries()) {
            const g = (f) => $(`[data-f="${f}"]`, tr);
            const name = g("name").value.trim();
            if (!name && !g("price").value) continue;
            const id = tr.dataset.id ? Number(tr.dataset.id) : undefined;
            const existing = plans.find((p) => p.id === id);
            await api("/billing/plans", { method: "POST", body: { id, code: existing?.code || `plan${Date.now()}${i}`, name, price: Number(g("price").value), months: Number(g("months").value), active: g("active").checked, sort: i + 1 } });
          }
          toast("設定完成 🎉");
          location.hash = "#home";
        } catch (err) {
          toast(err.message, true);
        }
      });
    }
  };

  /* =========================================================
     Admin: users & orders
     ========================================================= */
  const subBadge = (sub) =>
    sub.source === "owner" ? '<span class="badge brand">擁有者</span>'
      : sub.source === "paid" ? `<span class="badge success">付費 · ${fmtDate(sub.until)}</span>`
        : sub.source === "trial" ? `<span class="badge info">試用 · 剩 ${sub.days_left} 天</span>`
          : '<span class="badge danger">已到期</span>';
  PAGES["admin-users"] = async (el) => {
    if (!isOwner()) return (location.hash = "#home");
    const list = await api("/users");
    el.innerHTML = `<div class="page">${pageHead("用戶", `共 ${list.length} 位`)}
      <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>用戶</th><th>方案</th><th>連接 / 自動回覆</th><th>註冊日期</th><th></th></tr></thead><tbody>
      ${list.map((u) => `<tr><td><b>${esc(u.name)}</b><div class="small muted">${esc(u.email)}</div></td><td>${subBadge(u.subscription)}</td><td>${u.channels} / ${u.automations}</td><td class="nowrap muted">${fmtDate(u.created_at)}</td>
        <td class="actions">${u.role === "owner" ? "" : `<button class="btn btn-sm" data-grant="${u.id}">延長方案</button>`}</td></tr>`).join("")}
      </tbody></table></div></div></div>`;
    $$("[data-grant]", el).forEach((b) => (b.onclick = () => {
      const u = list.find((x) => x.id === Number(b.dataset.grant));
      const m = modal({
        title: `延長 ${u.name || u.email} 的方案`,
        size: "sm",
        body: `<div class="stack"><p class="muted small">用於匯款、贈送或補償。會建立一筆金額為 0 的訂單記錄。</p><label class="field"><span class="label">延長期間</span><select class="input" id="gm">${[1, 3, 6, 12].map((x) => `<option value="${x}">${x} 個月</option>`).join("")}</select></label></div>`,
        foot: `<button class="btn" data-close>取消</button><button class="btn btn-primary" id="gm-ok" data-busy="處理中">確認延長</button>`,
      });
      $("#gm-ok", m.el).onclick = (e) => busy(e.currentTarget, async () => {
        try { const r = await api("/billing/grant", { method: "POST", body: { user_id: u.id, months: Number($("#gm", m.el).value) } }); m.close(); toast(`已延長至 ${fmtDate(r.paid_until)}`); PAGES["admin-users"](el); } catch (err) { toast(err.message, true); }
      });
    }));
  };
  PAGES["admin-orders"] = async (el) => {
    if (!isOwner()) return (location.hash = "#home");
    const list = await api("/billing/orders/all");
    const revenue = list.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);
    el.innerHTML = `<div class="page">${pageHead("訂單", `已付款總額 ${money(revenue)}`)}
      <div class="card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>日期</th><th>用戶</th><th>方案</th><th>金額</th><th>狀態</th><th>PayUni 交易序號</th></tr></thead><tbody>
        ${list.map((o) => `<tr><td class="nowrap">${fmtTime(o.created_at)}</td><td>${esc(o.email || "")}</td><td>${esc(o.plan_name)}</td><td>${money(o.amount)}</td><td>${orderBadge(o.status)}</td><td class="mono muted">${esc(o.payuni_trade_no || "—")}</td></tr>`).join("")}
      </tbody></table></div>` : empty("receipt", "還沒有訂單", "用戶購買方案後會出現在這裡。")}</div></div>`;
  };

  /* =========================================================
     Boot
     ========================================================= */
  function startApp() {
    renderShell();
    route();
  }
  (async () => {
    try {
      state.me = await api("/auth/me");
    } catch {
      state.me = { authenticated: false };
    }
    document.title = appName();
    if (state.me.authenticated) startApp();
    else renderAuth(state.me.needs_setup ? "signup" : "login");
  })();
})();
