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
     Phone preview
     ========================================================= */
  function phoneMock({ sys, userText, bubbles }) {
    const name = esc(state.me?.user?.name || "你的品牌");
    return `<div class="phone">
      <div class="phone-top"><div class="pa"><img src="/brand/mark.svg" alt=""/></div><div><b>${name}</b><span>通常會立即回覆</span></div></div>
      <div class="phone-body">
        ${sys ? `<div class="chat-sys">${icon("megaphone")}${esc(sys)}</div>` : ""}
        ${userText ? `<div class="bubble-out">${esc(userText)}</div>` : ""}
        ${(bubbles || []).map(renderBubble).join("") || '<div class="chat-meta">還沒有回覆內容</div>'}
      </div></div>`;
  }
  function renderBubble(b) {
    if (b.meta) return `<div class="chat-meta">${esc(b.meta)}</div>`;
    if (b.image) return `<div class="bubble-in"><div class="chat-img" style="background-image:url('${esc(b.image)}')"></div></div>`;
    const text = esc(b.text || "").trim() || '<span class="subtle">（訊息內容）</span>';
    if (b.buttons?.length) {
      return `<div class="bubble-in"><div class="bb card-bb"><div class="tx">${text}</div>${b.buttons.map((t) => `<span class="cb">${esc(t || "按鈕")}</span>`).join("")}</div></div>`;
    }
    return `<div class="bubble-in"><div class="bb">${text}</div>${b.quick?.length ? `<div class="qr-row">${b.quick.map((q) => `<span class="qr">${esc(q || "選項")}</span>`).join("")}</div>` : ""}</div>`;
  }
  const demoName = (s) => String(s || "").replace(/\{\{\s*(first_name|full_name)\s*\}\}/g, "小明").replace(/\{\{[^}]*\}\}/g, "");
  function stepsToBubbles(steps) {
    const out = [];
    for (const s of steps || []) {
      if (s.type === "text") out.push({ text: demoName(s.text) });
      else if (s.type === "buttons") out.push({ text: demoName(s.text), buttons: (s.buttons || []).map((b) => demoName(b.title)) });
      else if (s.type === "quick_replies") out.push({ text: demoName(s.text), quick: (s.replies || []).map((r) => demoName(r.title)) });
      else if (s.type === "image") out.push({ image: s.url });
      else if (s.type === "delay") out.push({ meta: `等待 ${s.seconds} 秒` });
    }
    return out;
  }
  function graphMessagesToBubbles(messages) {
    return (messages || []).map((m) => {
      if (m.attachment?.type === "template") return { text: m.attachment.payload.text, buttons: (m.attachment.payload.buttons || []).map((b) => b.title) };
      if (m.attachment?.type === "image") return { image: m.attachment.payload.url };
      return { text: m.text, quick: (m.quick_replies || []).map((q) => q.title) };
    });
  }

  /* =========================================================
     Home / onboarding
     ========================================================= */
  PAGES.home = async (el) => {
    const o = await api("/overview");
    state.overview = o;
    const s = o.stats;
    const tested = !!store.get(ukey("tested"));
    const adDone = !!store.get(ukey("ad_done"));
    const tasks = [
      {
        done: o.channels.length > 0,
        title: "連接 Facebook 粉絲專頁",
        desc: "用 Facebook 登入，選擇要自動回覆的專頁。有綁定的 Instagram 專業帳號會一起連上。",
        action: o.app_configured
          ? `<a class="btn btn-fb" href="/auth/facebook">${icon("facebook")}連接 Facebook</a>`
          : isOwner()
            ? `<a class="btn" href="#setup/meta">先完成平台設定</a>`
            : `<span class="badge warning">等待平台管理員設定</span>`,
      },
      {
        done: s.automations > 0,
        title: "建立廣告自動回覆",
        desc: "寫一句歡迎詞、放上要導去的網址，就完成了。",
        action: `<a class="btn btn-primary" href="#automations/new/ad">${icon("plus")}建立</a>`,
      },
      {
        done: tested,
        title: "試跑一次",
        desc: "模擬有人點了廣告，確認回覆內容和按鈕都正確。不會真的傳訊息。",
        action: `<button class="btn" id="task-test">${icon("play")}開始測試</button>`,
      },
      {
        done: adDone,
        title: "投放「訊息」目標的廣告",
        desc: `在廣告管理員建立 <b>互動 → 訊息</b> 目標的廣告，訊息應用程式選 Messenger 或 Instagram。<a href="https://adsmanager.facebook.com/" target="_blank" rel="noopener">開啟廣告管理員 ↗</a>`,
        action: `<button class="btn" id="task-ad">${icon("check")}我已完成</button>`,
      },
    ];
    const doneCount = tasks.filter((t) => t.done).length;
    const firstOpen = tasks.findIndex((t) => !t.done);
    const C = 2 * Math.PI * 19;
    const allDone = doneCount === tasks.length;
    const greeting = state.me.user.name ? `嗨，${esc(state.me.user.name)}` : "歡迎";

    el.innerHTML = `<div class="page">
      ${pageHead(greeting, allDone ? "一切就緒，以下是最近的成效。" : "跟著下面幾個步驟，大約 5 分鐘就能上線。")}
      ${isOwner() && (!o.app_configured || !o.payuni_configured) ? `<div class="banner brand">${icon("sliders")}<div class="grow"><b>還有平台設定沒完成。</b> ${!o.app_configured ? "完成 Meta App 設定後，用戶才能連接粉絲專頁。" : "完成 PayUni 設定後，用戶才能線上付款。"}</div><a class="btn btn-sm btn-primary" href="#setup">前往設定</a></div>` : ""}
      ${subBanner()}
      <div class="stack">
        ${allDone && store.get(ukey("hide_checklist")) ? "" : `
        <div class="card">
          <div class="checklist-head">
            <svg class="progress-ring" viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" cx="22" cy="22" r="19" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - doneCount / tasks.length)}" transform="rotate(-90 22 22)"/></svg>
            <div style="flex:1"><div class="section-title">${allDone ? "全部完成 🎉" : "開始使用"}</div><div class="section-desc">已完成 ${doneCount} / ${tasks.length} 個步驟</div></div>
            ${allDone ? `<button class="btn btn-ghost btn-sm" id="hide-checklist">隱藏</button>` : ""}
          </div>
          ${tasks
            .map(
              (t, i) => `<div class="task ${t.done ? "done" : ""} ${i === firstOpen ? "current" : ""}">
                <div class="num">${t.done ? icon("check") : i + 1}</div>
                <div class="body"><div class="t">${t.title}</div><div class="d">${t.desc}</div></div>
                ${t.done ? "" : `<div class="act">${t.action}</div>`}
              </div>`,
            )
            .join("")}
        </div>`}
        <div class="grid-4">
          ${stat("今日新聯絡人", num(s.contacts_today))}
          ${stat("來自廣告的聯絡人", num(s.contacts_from_ads))}
          ${stat("自動回覆次數", num(s.triggered))}
          ${stat("導購連結點擊", num(s.link_clicks))}
        </div>
        ${o.platform ? `<div class="card"><div class="card-head"><div><h3>平台概況</h3><p>所有用戶的總計</p></div><a class="btn btn-sm" href="#admin-users">查看用戶</a></div><div class="stat-row">${statPlain("註冊用戶", num(o.platform.users))}${statPlain("付費中用戶", num(o.platform.paying_users))}${statPlain("累計營收", money(o.platform.revenue))}${statPlain("已連接頻道", num(o.platform.channels))}</div></div>` : ""}
      </div>
    </div>`;
    $("#task-test") && ($("#task-test").onclick = () => openTestModal());
    $("#task-ad") && ($("#task-ad").onclick = () => { store.set(ukey("ad_done"), true); PAGES.home(el); });
    $("#hide-checklist") && ($("#hide-checklist").onclick = () => { store.set(ukey("hide_checklist"), true); PAGES.home(el); });
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
  const firstText = (a) => a.steps.find((s) => s.text)?.text || "";
  const smallIcon = (n) => icon(n).replace("<svg", '<svg style="width:14px;height:14px;vertical-align:-2px;flex:none"');

  function previewModal(a) {
    modal({
      title: stripExample(a.name),
      size: "sm",
      body: `<p class="small muted" style="margin-bottom:12px">觸發條件：${triggerSummary(a)}</p>${phoneMock({ sys: ["any_ad", "ad", "ref"].includes(a.trigger_type) ? "透過廣告開啟對話" : null, userText: a.trigger_type === "keyword" ? a.trigger_value.split(/[,，]/)[0].trim() : null, bubbles: stepsToBubbles(a.steps) })}`,
      foot: `<button class="btn" data-close>關閉</button><a class="btn btn-primary" href="#automations/edit/${a.id}">使用這個範例</a>`,
    });
  }

  PAGES.automations = async (el, args) => {
    if (args[0] === "new" && !args[1]) return renderTemplatePicker(el);
    if (args[0] === "new") return renderEditor(el, { template: args[1] });
    if (args[0] === "edit" && args[1]) return renderEditor(el, { id: Number(args[1]), advanced: args[2] === "advanced" });

    const [list, o] = await Promise.all([api("/automations"), api("/overview")]);
    state.overview = o;
    const mine = list.filter((a) => !a.is_example);
    const examples = list.filter((a) => a.is_example).sort((x, y) => x.id - y.id);
    el.innerHTML = `<div class="page">
      ${pageHead("自動回覆", "客人點廣告或傳訊息時，自動送出的內容。", `${mine.length ? `<button class="btn" id="open-test">${icon("play")}測試</button>` : ""}<a class="btn btn-primary" href="#automations/new">${icon("plus")}新增自動回覆</a>`)}
      ${subBanner()}
      ${o.channels.length === 0 ? `<div class="banner info">${icon("info")}<div class="grow">還沒連接粉絲專頁，自動回覆要連接後才會生效。</div><a class="btn btn-sm" href="#connections">連接帳號</a></div>` : ""}
      <div class="stack">
      ${mine.length
        ? `<div class="card"><div class="card-head"><div><h3>我的自動回覆</h3><p>開關打開的才會自動送出。</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>名稱</th><th>觸發條件</th><th>平台</th><th class="nowrap">已觸發</th><th>啟用</th><th></th></tr></thead><tbody>
          ${mine
            .map(
              (a) => `<tr>
              <td class="primary-cell"><a href="#automations/edit/${a.id}" style="color:inherit">${esc(a.name)}</a></td>
              <td>${triggerSummary(a)}</td>
              <td>${platformBadge(a.platform)}</td>
              <td>${num(a.triggered_count)} 次</td>
              <td><label class="switch" title="${a.enabled ? "已啟用" : "已停用"}"><input type="checkbox" data-toggle="${a.id}" ${a.enabled ? "checked" : ""} aria-label="啟用 ${esc(a.name)}"/><span class="slider"></span></label></td>
              <td class="actions"><button class="btn btn-ghost btn-sm" data-test="${a.id}">${icon("play")}測試</button><a class="btn btn-ghost btn-sm" href="#automations/edit/${a.id}">${icon("edit")}編輯</a><button class="btn btn-ghost btn-sm btn-danger icon-btn" data-del="${a.id}" aria-label="刪除">${icon("trash")}</button></td>
            </tr>`,
            )
            .join("")}</tbody></table></div></div>`
        : `<div class="card"><div class="card-body">
            <div class="row" style="gap:16px;align-items:flex-start;flex-wrap:nowrap">
              <div class="empty-ic">${icon("zap")}</div>
              <div style="flex:1"><div class="section-title">建立你的第一個自動回覆</div>
                <p class="muted" style="margin-top:4px">大約 2 分鐘。跟著這三步就能完成：</p>
                <ol class="mini-steps"><li><b>選範本</b>大多數人選「廣告點擊 → 導向網址」</li><li><b>寫訊息、放網址</b>可以一鍵套用範例文案</li><li><b>試跑後儲存</b>確認沒問題就會開始自動回覆</li></ol>
                <div class="row" style="margin-top:14px"><a class="btn btn-primary" href="#automations/new/ad">${icon("plus")}廣告點擊 → 導向網址</a><a class="btn" href="#automations/new">看所有範本</a></div>
              </div></div></div></div>`}
      ${examples.length
        ? `<div class="card"><div class="card-head"><div><h3>${icon("book").replace("<svg", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px;color:var(--brand)"')}範例</h3><p>預先寫好的範例，<b>不會自動回覆</b>。打開參考或修改成你的內容，儲存後就會啟用。</p></div></div>
            ${examples
              .map(
                (a) => `<div class="ex-row">
                  <div class="ex-main"><div class="row" style="gap:8px"><b>${esc(stripExample(a.name))}</b><span class="badge">範例</span></div>
                    <div class="small muted">${triggerSummary(a)}</div>
                    <div class="ex-snippet">${esc(demoName(firstText(a)).split("\n")[0])}</div></div>
                  <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-preview="${a.id}">預覽</button><a class="btn btn-sm" href="#automations/edit/${a.id}">使用這個範例</a><button class="btn btn-ghost btn-sm icon-btn btn-danger" data-del="${a.id}" aria-label="刪除範例">${icon("trash")}</button></div>
                </div>`,
              )
              .join("")}</div>`
        : ""}
      </div>
    </div>`;
    $("#open-test") && ($("#open-test").onclick = () => openTestModal());
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
    $$("[data-preview]", el).forEach((b) => (b.onclick = () => previewModal(list.find((a) => a.id === Number(b.dataset.preview)))));
    $$("[data-test]", el).forEach((b) => (b.onclick = () => openTestModal(list.find((a) => a.id === Number(b.dataset.test)))));
    $$("[data-del]", el).forEach((b) => {
      b.onclick = async () => {
        const a = list.find((x) => x.id === Number(b.dataset.del));
        if (!(await confirmDialog(a.is_example ? "刪除範例" : "刪除自動回覆", `確定刪除「${stripExample(a.name)}」？這個動作無法復原。`, "刪除", true))) return;
        await api(`/automations/${a.id}`, { method: "DELETE" });
        toast("已刪除");
        PAGES.automations(el, []);
      };
    });
  };

  const TEMPLATES = {
    ad: {
      icon: "click", color: "#fff3ec", fg: "#e95b17", title: "廣告點擊 → 導向網址", desc: "有人從廣告點進來，立刻回覆並附上前往網址的按鈕。", tag: "最常用", when: "你在跑 Click to Messenger / Instagram 廣告",
      data: { name: "廣告點擊自動回覆", trigger_type: "any_ad", message: USE_CASES[0].msg, buttons: [{ title: USE_CASES[0].btn, url: "" }], tag: "廣告名單" },
    },
    keyword: {
      icon: "hash", color: "#eaf4fb", fg: "#1781c4", title: "關鍵字自動回覆", desc: "客人問到價格、地址等常見問題時自動回答。", when: "常常被問一樣的問題",
      data: { name: "詢問價格", trigger_type: "keyword", trigger_value: "價格, 多少錢, 費用", message: "{{first_name}} 你好！所有方案與價格都整理在這裡 👇", buttons: [{ title: "查看價格", url: "" }], tag: "" },
    },
    welcome: {
      icon: "smile", color: "#e9f7f7", fg: "#2f9a9e", title: "歡迎訊息", desc: "第一次開啟對話的新朋友會收到這則訊息。", when: "想讓新朋友第一時間知道你是誰",
      data: { name: "歡迎訊息", trigger_type: "get_started", message: "歡迎 {{first_name}}！我們是 {{brand}}，有任何問題都可以直接留言 😊", buttons: [], tag: "" },
    },
    blank: { icon: "sparkles", color: "#f3f3f5", fg: "#4a4a55", title: "從空白開始", desc: "多則訊息、快速回覆選單、延遲與分支流程。", when: "需要問答選單或多則訊息", data: null },
  };

  async function renderTemplatePicker(el) {
    const list = await api("/automations").catch(() => []);
    const examples = list.filter((a) => a.is_example).sort((x, y) => x.id - y.id);
    el.innerHTML = `<div class="page">
      ${backLink("#automations", "自動回覆")}
      ${pageHead("選一個起點", "選好之後都可以再修改，不用擔心選錯。")}
      <div class="stack">
        <div class="grid-2">
          ${Object.entries(TEMPLATES)
            .map(
              ([k, t]) => `<a class="tpl" href="#automations/new/${k}">
                ${t.tag ? `<span class="badge brand tag">${t.tag}</span>` : ""}
                <div class="ic" style="background:${t.color};color:${t.fg}">${icon(t.icon)}</div>
                <div class="t">${t.title}</div><div class="d">${t.desc}</div>
                <div class="tpl-when">${smallIcon("info")}<span>適合：${t.when}</span></div>
              </a>`,
            )
            .join("")}
        </div>
        ${examples.length
          ? `<div><div class="section-title" style="margin:8px 0 4px">或從範例開始</div><p class="section-desc" style="margin-bottom:12px">已經寫好內容的範例，打開改成你的網址就能用。</p>
            <div class="grid-2">${examples
              .map(
                (a) => `<div class="tpl ex-card" data-preview="${a.id}" role="button" tabindex="0">
                  <div class="row between"><b>${esc(stripExample(a.name))}</b><span class="badge">範例</span></div>
                  <div class="small muted">${triggerSummary(a)}</div>
                  <div class="ex-snippet">${esc(demoName(firstText(a)))}</div>
                </div>`,
              )
              .join("")}</div></div>`
          : ""}
      </div></div>`;
    $$("[data-preview]", el).forEach((c) => {
      const open = () => previewModal(list.find((a) => a.id === Number(c.dataset.preview)));
      c.onclick = open;
      c.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && open();
    });
  }

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

  async function renderEditor(el, { id, template, advanced }) {
    let a = null;
    if (id) a = await api(`/automations/${id}`);
    let simple = null;
    if (a && !advanced) simple = automationToSimple(a);
    if (!a && template && template !== "blank" && TEMPLATES[template]) {
      const d = TEMPLATES[template].data;
      simple = { enabled: 1, priority: template === "ad" ? 10 : 0, platform: "any", trigger_value: "", ...JSON.parse(JSON.stringify(d)) };
      simple.message = simple.message.replace("{{brand}}", state.me.user.name || "我們");
    }
    if (simple) return renderSimpleEditor(el, simple, a);
    const adv = a ? JSON.parse(JSON.stringify(a)) : { name: "", enabled: 1, priority: 0, platform: "any", channel_id: null, trigger_type: "any_ad", trigger_value: "", steps: [{ type: "text", text: "" }] };
    return renderAdvancedEditor(el, adv);
  }

  async function renderSimpleEditor(el, f, original) {
    const isNew = !f.id;
    const isExample = !!original?.is_example;
    if (!f.buttons) f.buttons = [];
    const o = state.overview || (await api("/overview").catch(() => ({ channels: [] })));
    const coachHidden = !!store.get(ukey("coach_editor"));
    el.innerHTML = `<div class="page">
      ${backLink("#automations", "自動回覆")}
      ${pageHead(isExample ? `範例：${stripExample(f.name)}` : isNew ? "新增自動回覆" : "編輯自動回覆", isNew || isExample ? "右邊會即時顯示客人在手機上看到的畫面。" : "")}
      ${isExample ? `<div class="banner brand">${icon("book")}<div class="grow"><b>這是範例，目前不會自動回覆。</b> 把訊息和網址改成你的內容，按「使用並啟用」就會開始運作。</div></div>` : ""}
      ${!coachHidden && (isNew || isExample) ? `<div class="coach" id="coach">
          <div class="coach-steps">
            <div><span class="cn">1</span><b>選擇什麼時候回覆</b><span>例如有人點了你的廣告</span></div>
            <div><span class="cn">2</span><b>寫訊息、放網址</b><span>可以直接套用範例文案</span></div>
            <div><span class="cn">3</span><b>檢查後儲存</b><span>下方清單全部打勾就能上線</span></div>
          </div>
          <button class="btn btn-ghost btn-sm icon-btn" id="coach-x" aria-label="不再顯示">${icon("x")}</button>
        </div>` : ""}
      <div class="editor">
        <div>
          <div class="card">
            <div class="form-section">
              <div class="sec-head"><div class="sec-num">1</div><div><div class="section-title">什麼時候回覆？</div><div class="section-desc">選擇觸發這則回覆的情況，下方會說明實際會怎麼運作。</div></div></div>
              <div class="choice-grid" id="trig-choices">
                ${["any_ad", "ad", "ref", "keyword", "get_started", "default"]
                  .map(
                    (k) => `<label class="choice ${f.trigger_type === k ? "selected" : ""}">
                      <input type="radio" name="trig" value="${k}" ${f.trigger_type === k ? "checked" : ""}/>
                      ${TRIGGERS[k].tag ? `<span class="badge brand tag">${TRIGGERS[k].tag}</span>` : ""}
                      <span class="dot"></span><span><div class="t">${TRIGGERS[k].t}</div><div class="d">${TRIGGERS[k].d}</div></span>
                    </label>`,
                  )
                  .join("")}
              </div>
              <div id="trig-value-wrap" style="margin-top:14px"></div>
            </div>
            <div class="form-section">
              <div class="sec-head"><div class="sec-num">2</div><div><div class="section-title">回覆什麼？</div><div class="section-desc">一則訊息，加上帶客人前往網址的按鈕。</div></div></div>
              <div class="stack">
                <div class="preset-box">
                  <div class="small" style="font-weight:500;margin-bottom:8px">${smallIcon("sparkles")} 不知道怎麼寫？套用範例文案</div>
                  <div class="preset-chips">${USE_CASES.map((u) => `<button type="button" class="preset" data-case="${u.k}">${u.t}</button>`).join("")}</div>
                </div>
                <label class="field"><span class="label">訊息內容</span>
                  <textarea class="input" id="s-message" maxlength="640" placeholder="嗨 {{first_name}}，謝謝你的詢問！">${esc(f.message)}</textarea>
                  <span class="row between"><span class="row"><span class="small muted">插入：</span><span class="var-chips"><button type="button" class="var-chip" data-var="{{first_name}}">客人名字</button><button type="button" class="var-chip" data-var="{{full_name}}">客人全名</button></span></span><span class="small subtle" id="msg-count">${f.message.length}/640</span></span>
                  <span class="error-text" id="e-message"></span>
                </label>
                <div id="btn-list" class="stack-sm"></div>
                <div><button type="button" class="btn btn-sm" id="add-btn">${icon("plus")}新增按鈕</button> <span class="small muted" id="btn-hint"></span></div>
              </div>
            </div>
            <div class="form-section">
              <div class="sec-head"><div class="sec-num">3</div><div><div class="section-title">上線前檢查</div><div class="section-desc">全部打勾就可以儲存上線。</div></div></div>
              <ul class="checks" id="checks"></ul>
            </div>
            <div class="form-section">
              <details class="adv">
                <summary>${icon("right")}更多設定（選填）</summary>
                <div class="stack" style="margin-top:16px">
                  <div class="grid-2">
                    <label class="field"><span class="label">名稱</span><input class="input" id="s-name" value="${esc(stripExample(f.name))}" placeholder="給自己看的名字"/></label>
                    <label class="field"><span class="label">平台</span><select class="input" id="s-platform">
                      <option value="any" ${f.platform === "any" ? "selected" : ""}>Messenger 與 Instagram</option>
                      <option value="messenger" ${f.platform === "messenger" ? "selected" : ""}>只有 Messenger</option>
                      <option value="instagram" ${f.platform === "instagram" ? "selected" : ""}>只有 Instagram</option>
                    </select></label>
                  </div>
                  <div class="grid-2">
                    <label class="field"><span class="label">幫客人加上標籤</span><input class="input" id="s-tag" value="${esc(f.tag)}" placeholder="例如：春季活動"/><span class="help">方便在聯絡人頁面辨識客人從哪來。</span></label>
                    <label class="field"><span class="label">優先順序</span><input class="input" type="number" id="s-priority" value="${f.priority}"/><span class="help">同時符合多個規則時，數字大的先用。</span></label>
                  </div>
                  <div><a class="small" href="#automations/${original ? `edit/${original.id}/advanced` : "new/blank"}" id="to-advanced">切換到進階編輯器（多則訊息、快速回覆、延遲）→</a></div>
                </div>
              </details>
            </div>
          </div>
          <div class="sticky-actions">
            <a class="btn" href="#automations">取消</a>
            <button class="btn" id="s-test">${icon("play")}試跑看看</button>
            <button class="btn btn-primary" id="s-save" data-busy="儲存中">${icon("check")}${isExample ? "使用並啟用" : isNew ? "儲存並啟用" : "儲存變更"}</button>
          </div>
        </div>
        <div class="preview-col">
          <div class="small muted" style="margin-bottom:8px;font-weight:500">客人會看到</div>
          <div id="preview"></div>
          <div class="tips">
            <b>${smallIcon("sparkles")} 寫出好回覆的 3 個訣竅</b>
            <ol><li>用客人的名字開頭，感覺更親切</li><li>一兩句話說清楚「點了有什麼好處」</li><li>按鈕用動詞開頭，例如「立即選購」</li></ol>
          </div>
        </div>
      </div></div>`;

    const renderTrigValue = () => {
      const T = TRIGGERS[f.trigger_type];
      const ex = TRIGGER_EXAMPLES[f.trigger_type];
      $("#trig-value-wrap").innerHTML = `
        ${T.needs ? `<label class="field" style="margin-bottom:12px"><span class="label">${T.needs}</span><input class="input" id="s-tv" value="${esc(f.trigger_value)}" placeholder="${esc(T.ph)}"/><span class="help">${T.help}</span><span class="error-text" id="e-tv"></span></label>` : ""}
        ${ex ? `<div class="scenario"><div class="sc-label">${smallIcon("info")} 實際情境</div><p>${esc(ex.scene)}</p>${ex.tip ? `<p class="sc-tip">${esc(ex.tip)}</p>` : ""}</div>` : ""}`;
      const tv = $("#s-tv");
      if (tv) tv.oninput = () => { f.trigger_value = tv.value; tv.classList.remove("invalid"); $("#e-tv").textContent = ""; refresh(); };
    };
    const renderButtons = () => {
      $("#btn-list").innerHTML = f.buttons
        .map(
          (b, i) => `<div class="card" style="box-shadow:none;background:var(--surface-2)"><div class="card-body" style="padding:14px 16px">
            <div class="row between" style="margin-bottom:10px"><b class="small">按鈕 ${i + 1}</b><button type="button" class="btn btn-ghost btn-sm icon-btn" data-rm="${i}" aria-label="移除按鈕">${icon("x")}</button></div>
            <div class="grid-2">
              <div class="field"><label class="label" for="bt-${i}">按鈕文字</label><div class="input-group"><input class="input" id="bt-${i}" data-bt="${i}" maxlength="20" value="${esc(b.title)}" placeholder="立即查看"/><span class="counter" data-cnt="${i}">${b.title.length}/20</span></div>
                <div class="idea-chips">${BUTTON_IDEAS.map((t) => `<button type="button" class="idea" data-idea="${i}">${t}</button>`).join("")}</div></div>
              <div class="field"><label class="label" for="bu-${i}">前往網址</label><input class="input" id="bu-${i}" data-bu="${i}" type="url" inputmode="url" value="${esc(b.url)}" placeholder="https://your-site.com/landing"/>
                <span class="error-text" data-eu="${i}"></span>
                <span class="help">放商品頁或活動頁效果最好。<a href="#" data-utm="${i}">加上追蹤參數</a>，就能在 GA 看到從 Messenger 來的流量。</span></div>
            </div></div></div>`,
        )
        .join("");
      $("#add-btn").classList.toggle("hidden", f.buttons.length >= 3);
      $("#btn-hint").textContent = f.buttons.length ? "最多 3 個按鈕。" : "沒有按鈕就只會送出文字。";
      $$("[data-bt]").forEach((inp) => (inp.oninput = () => { f.buttons[inp.dataset.bt].title = inp.value; inp.classList.remove("invalid"); $(`[data-cnt="${inp.dataset.bt}"]`).textContent = `${inp.value.length}/20`; refresh(); }));
      $$("[data-bu]").forEach((inp) => (inp.oninput = () => { f.buttons[inp.dataset.bu].url = inp.value; inp.classList.remove("invalid"); $(`[data-eu="${inp.dataset.bu}"]`).textContent = ""; refresh(); }));
      $$("[data-rm]").forEach((b) => (b.onclick = () => { f.buttons.splice(Number(b.dataset.rm), 1); renderButtons(); refresh(); }));
      $$("[data-idea]").forEach((b) => (b.onclick = () => { const i = Number(b.dataset.idea); f.buttons[i].title = b.textContent; const inp = $(`[data-bt="${i}"]`); inp.value = b.textContent; inp.oninput(); }));
      $$("[data-utm]").forEach((a) => (a.onclick = (e) => {
        e.preventDefault();
        const i = Number(a.dataset.utm);
        const inp = $(`[data-bu="${i}"]`);
        const u = inp.value.trim();
        if (!isUrl(u)) return toast("請先填好網址，再加上追蹤參數", true);
        if (u.includes("utm_source=")) return toast("這個網址已經有追蹤參數了");
        const [base, hash = ""] = u.split("#");
        inp.value = `${base}${base.includes("?") ? "&" : "?"}${UTM}${hash ? `#${hash}` : ""}`;
        inp.oninput();
        toast("已加上追蹤參數");
      }));
    };
    const preview = () => {
      const T = f.trigger_type;
      const sys = T === "any_ad" || T === "ad" || T === "ref" ? "透過廣告開啟對話" : T === "get_started" ? "按下「開始使用」" : null;
      const userText = T === "keyword" ? (f.trigger_value.split(/[,，]/)[0] || "").trim() || "關鍵字" : T === "default" ? "你好" : null;
      $("#preview").innerHTML = phoneMock({ sys, userText, bubbles: [{ text: demoName(f.message), buttons: f.buttons.map((b) => b.title) }] });
    };
    const checkItems = () => {
      const T = TRIGGERS[f.trigger_type];
      const filled = f.buttons.filter((b) => b.title.trim() || b.url.trim());
      const badUrl = filled.some((b) => !isUrl(b.url) || !b.title.trim());
      const placeholder = filled.some((b) => /example\.com/i.test(b.url));
      return [
        { s: !T.needs || f.trigger_value.trim() ? "ok" : "todo", t: T.needs ? `填寫「${T.needs}」` : `觸發條件：${T.t}` },
        { s: f.message.trim() ? "ok" : "todo", t: "寫好訊息內容" },
        filled.length === 0
          ? { s: "info", t: "沒有按鈕，客人只會看到文字（想導流量請新增按鈕）" }
          : { s: badUrl ? "todo" : placeholder ? "warn" : "ok", t: placeholder ? "把範例網址 example.com 換成你自己的網址" : "按鈕都有文字和完整網址" },
        o.channels?.length
          ? { s: "ok", t: `已連接 ${o.channels.length} 個帳號` }
          : { s: "warn", t: '還沒連接粉絲專頁，儲存後要<a href="#connections">連接帳號</a>才會生效' },
      ];
    };
    const ICON_FOR = { ok: "check", todo: "x", warn: "alert", info: "info" };
    const renderChecks = () => {
      $("#checks").innerHTML = checkItems().map((c) => `<li class="chk ${c.s}"><span class="ci">${icon(ICON_FOR[c.s])}</span><span>${c.t}</span></li>`).join("");
    };
    const refresh = () => { preview(); renderChecks(); };

    $$("#trig-choices input").forEach((r) => {
      r.onchange = () => {
        f.trigger_type = r.value;
        $$("#trig-choices .choice").forEach((c) => c.classList.toggle("selected", c.contains(r)));
        renderTrigValue();
        refresh();
      };
    });
    const msg = $("#s-message");
    msg.oninput = () => { f.message = msg.value; $("#msg-count").textContent = `${msg.value.length}/640`; $("#e-message").textContent = ""; msg.classList.remove("invalid"); refresh(); };
    $$("[data-var]").forEach((c) => {
      c.onclick = () => {
        const start = msg.selectionStart ?? msg.value.length;
        msg.value = msg.value.slice(0, start) + c.dataset.var + msg.value.slice(msg.selectionEnd ?? start);
        msg.focus();
        msg.selectionStart = msg.selectionEnd = start + c.dataset.var.length;
        msg.oninput();
      };
    });
    $$("[data-case]").forEach((b) => {
      b.onclick = () => {
        const u = USE_CASES.find((x) => x.k === b.dataset.case);
        msg.value = u.msg;
        msg.oninput();
        if (!f.buttons.length) f.buttons.push({ title: u.btn, url: "" });
        else f.buttons[0].title = u.btn;
        renderButtons();
        refresh();
        $$("[data-case]").forEach((x) => x.classList.toggle("on", x === b));
        toast(`已套用「${u.t}」文案，記得填入你的網址`);
        if (!f.buttons[0].url) setTimeout(() => $('[data-bu="0"]')?.focus(), 50);
      };
    });
    $("#add-btn").onclick = () => { f.buttons.push({ title: "", url: "" }); renderButtons(); refresh(); $(`[data-bt="${f.buttons.length - 1}"]`)?.focus(); };
    $("#s-name").oninput = (e) => (f.name = e.target.value);
    $("#s-platform").onchange = (e) => (f.platform = e.target.value);
    $("#s-tag").oninput = (e) => (f.tag = e.target.value);
    $("#s-priority").oninput = (e) => (f.priority = Number(e.target.value) || 0);
    $("#coach-x") && ($("#coach-x").onclick = () => { store.set(ukey("coach_editor"), true); $("#coach").remove(); });
    if (!original) {
      $("#to-advanced").onclick = (e) => {
        e.preventDefault();
        renderAdvancedEditor(el, { ...simpleToAutomation(f), id: undefined });
      };
    }
    // 試跑：直接用目前填的內容預覽（不必先儲存）
    $("#s-test").onclick = () => {
      const a = { ...simpleToAutomation(f), name: stripExample(f.name) || "這則自動回覆" };
      modal({
        title: "試跑看看",
        size: "sm",
        body: `<p class="small muted" style="margin-bottom:12px">這是客人${f.trigger_type === "keyword" ? "傳訊息" : ["any_ad", "ad", "ref"].includes(f.trigger_type) ? "點了廣告" : "開啟對話"}後會看到的畫面。按鈕在真實對話中會帶客人到你的網址。</p>
          ${phoneMock({ sys: ["any_ad", "ad", "ref"].includes(a.trigger_type) ? "透過廣告開啟對話" : null, userText: a.trigger_type === "keyword" ? (a.trigger_value.split(/[,，]/)[0] || "").trim() : null, bubbles: stepsToBubbles(a.steps) })}
          <div style="margin-top:12px">${checkItems().filter((c) => c.s === "todo").length ? `<div class="result-err">${icon("alert")}<span>還有項目沒完成，請看「上線前檢查」。</span></div>` : `<div class="result-ok">${icon("check")}看起來沒問題，可以儲存上線了</div>`}</div>`,
        foot: `<button class="btn" data-close>繼續編輯</button>`,
      });
      store.set(ukey("tested"), true);
    };

    const validate = () => {
      let ok = true;
      if (!f.message.trim()) { $("#e-message").textContent = "請輸入訊息內容"; msg.classList.add("invalid"); ok = false; }
      if (TRIGGERS[f.trigger_type].needs && !f.trigger_value.trim()) { $("#e-tv").textContent = `請填寫「${TRIGGERS[f.trigger_type].needs}」`; $("#s-tv").classList.add("invalid"); ok = false; }
      f.buttons.forEach((b, i) => {
        if (!b.title.trim() && !b.url.trim()) return;
        if (!b.title.trim()) { $(`[data-bt="${i}"]`).classList.add("invalid"); ok = false; }
        if (!isUrl(b.url)) { $(`[data-eu="${i}"]`).textContent = "請輸入完整網址，例如 https://your-site.com"; $(`[data-bu="${i}"]`).classList.add("invalid"); ok = false; }
        else if (/example\.com/i.test(b.url)) { $(`[data-eu="${i}"]`).textContent = "這是範例網址，請換成你自己的網址"; $(`[data-bu="${i}"]`).classList.add("invalid"); ok = false; }
      });
      return ok;
    };
    $("#s-save").onclick = (e) =>
      busy(e.currentTarget, async () => {
        if (!validate()) return toast("有欄位需要修正，請看標示紅色的地方", true);
        const body = simpleToAutomation(f);
        body.enabled = f.id && !isExample ? !!f.enabled : true;
        try {
          if (f.id) await api(`/automations/${f.id}`, { method: "PUT", body });
          else await api("/automations", { method: "POST", body });
          toast(isExample || isNew ? "自動回覆已啟用 🎉" : "已儲存");
          location.hash = "#automations";
        } catch (err) {
          toast(err.message, true);
        }
      });

    renderTrigValue();
    renderButtons();
    refresh();
  }

  /* ---- advanced editor ---- */
  const STEP_LABEL = { text: "文字訊息", buttons: "文字 + 按鈕", quick_replies: "快速回覆", image: "圖片", delay: "等待", tag: "加標籤", goto: "接續另一個自動回覆" };
  async function renderAdvancedEditor(el, a) {
    const [all, chans] = await Promise.all([api("/automations"), api("/channels")]);
    const isNew = !a.id;
    const simpleOk = automationToSimple({ ...a, steps: a.steps || [] });
    el.innerHTML = `<div class="page">
      ${backLink("#automations", "自動回覆")}
      ${pageHead(a.is_example ? `範例：${stripExample(a.name)}` : isNew ? "新增自動回覆（進階）" : "編輯自動回覆（進階）", "可以組合多則訊息、快速回覆、延遲與分支。", simpleOk && a.id ? `<a class="btn btn-sm" href="#automations/edit/${a.id}">切換到簡易模式</a>` : "")}
      ${a.is_example ? `<div class="banner brand">${icon("book")}<div class="grow"><b>這是範例，目前不會自動回覆。</b> 這個範例示範「快速回覆選單」：客人點選項後，會觸發對應「按鈕回傳」的自動回覆。修改後按「使用並啟用」。</div></div>` : `<div class="banner info">${icon("info")}<div class="grow">進階編輯器可以組合多個步驟。想做問答選單：加一個「快速回覆」步驟，每個選項設定一個 payload，再為每個 payload 建立觸發條件為「按鈕回傳」的自動回覆。</div></div>`}
      <div class="editor">
        <div>
          <div class="card">
            <div class="form-section">
              <div class="grid-2">
                <label class="field"><span class="label">名稱</span><input class="input" data-p="name" value="${esc(a.name)}"/></label>
                <label class="field"><span class="label">觸發條件</span><select class="input" data-p="trigger_type">${Object.entries(TRIGGERS).map(([k, t]) => `<option value="${k}" ${a.trigger_type === k ? "selected" : ""}>${t.t}</option>`).join("")}</select></label>
              </div>
              <div id="adv-tv" style="margin-top:14px"></div>
              <div class="grid-3" style="margin-top:14px">
                <label class="field"><span class="label">平台</span><select class="input" data-p="platform"><option value="any" ${a.platform === "any" ? "selected" : ""}>全部</option><option value="messenger" ${a.platform === "messenger" ? "selected" : ""}>Messenger</option><option value="instagram" ${a.platform === "instagram" ? "selected" : ""}>Instagram</option></select></label>
                <label class="field"><span class="label">限定頻道</span><select class="input" data-p="channel_id"><option value="">不限</option>${chans.map((c) => `<option value="${c.id}" ${a.channel_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
                <label class="field"><span class="label">優先順序</span><input class="input" type="number" data-p="priority" value="${a.priority}"/></label>
              </div>
            </div>
            <div class="form-section">
              <div class="row between" style="margin-bottom:14px"><div class="section-title">回覆步驟</div>
                <div class="row"><select class="input" id="add-type" style="width:auto;height:32px">${Object.entries(STEP_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><button class="btn btn-sm" id="add-step">${icon("plus")}加入</button></div></div>
              <div id="steps"></div>
            </div>
          </div>
          <div class="sticky-actions"><a class="btn" href="#automations">取消</a><button class="btn btn-primary" id="adv-save" data-busy="儲存中">${icon("check")}${a.is_example ? "使用並啟用" : "儲存"}</button></div>
        </div>
        <div class="preview-col"><div class="small muted" style="margin-bottom:8px;font-weight:500">客人會看到</div><div id="preview"></div></div>
      </div></div>`;

    const preview = () => ($("#preview").innerHTML = phoneMock({ sys: ["any_ad", "ad", "ref"].includes(a.trigger_type) ? "透過廣告開啟對話" : null, bubbles: stepsToBubbles(a.steps) }));
    const renderTv = () => {
      const T = TRIGGERS[a.trigger_type];
      $("#adv-tv").innerHTML = T.needs ? `<label class="field"><span class="label">${T.needs}</span><input class="input" data-p="trigger_value" value="${esc(a.trigger_value)}" placeholder="${esc(T.ph)}"/><span class="help">${T.help}</span></label>` : "";
    };
    const renderSteps = () => {
      $("#steps").innerHTML = a.steps.map((s, i) => stepCard(s, i, all.filter((x) => x.id !== a.id))).join("") || `<p class="muted small">還沒有步驟。</p>`;
    };
    el.oninput = el.onchange = (e) => {
      const t = e.target;
      if (t.dataset.p) {
        let v = t.value;
        if (t.dataset.p === "priority") v = Number(v) || 0;
        if (t.dataset.p === "channel_id") v = v === "" ? null : Number(v);
        a[t.dataset.p] = v;
        if (t.dataset.p === "trigger_type" && e.type === "change") renderTv();
      }
      if (t.dataset.s) {
        const path = t.dataset.s.split(".");
        let o = a.steps;
        for (const k of path.slice(0, -1)) o = o[k];
        let v = t.type === "checkbox" ? t.checked : t.value;
        if (t.type === "number") v = Number(v) || 0;
        o[path[path.length - 1]] = v;
      }
      if (t.dataset.btype && e.type === "change") {
        const [i, j] = t.dataset.btype.split(".").map(Number);
        const title = a.steps[i].buttons[j].title;
        a.steps[i].buttons[j] = t.value === "postback" ? { type: "postback", title, payload: "" } : { type: "url", title, url: "", track: true };
        renderSteps();
      }
      preview();
    };
    el.onclick = (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const [i, j] = (b.dataset.idx || "").split(".").map(Number);
      const s = a.steps[i];
      switch (b.dataset.act) {
        case "rm": a.steps.splice(i, 1); break;
        case "up": if (i > 0) [a.steps[i - 1], a.steps[i]] = [a.steps[i], a.steps[i - 1]]; break;
        case "down": if (i < a.steps.length - 1) [a.steps[i + 1], a.steps[i]] = [a.steps[i], a.steps[i + 1]]; break;
        case "add-btn": if (s.buttons.length < 3) s.buttons.push({ type: "url", title: "", url: "", track: true }); break;
        case "rm-btn": s.buttons.splice(j, 1); break;
        case "add-qr": s.replies.push({ title: "", payload: "" }); break;
        case "rm-qr": s.replies.splice(j, 1); break;
        default: return;
      }
      renderSteps();
      preview();
    };
    $("#add-step").onclick = () => {
      const t = $("#add-type").value;
      a.steps.push({
        text: { type: "text", text: "" },
        buttons: { type: "buttons", text: "", buttons: [{ type: "url", title: "", url: "", track: true }] },
        quick_replies: { type: "quick_replies", text: "", replies: [{ title: "", payload: "" }] },
        image: { type: "image", url: "" },
        delay: { type: "delay", seconds: 2 },
        tag: { type: "tag", tag: "" },
        goto: { type: "goto", automation_id: all.find((x) => x.id !== a.id)?.id ?? 0 },
      }[t]);
      renderSteps();
      preview();
    };
    $("#adv-save").onclick = (e) =>
      busy(e.currentTarget, async () => {
        try {
          const body = { ...a, name: stripExample(a.name) || "自動回覆", enabled: a.is_example ? true : a.enabled !== 0 };
          if (a.id) await api(`/automations/${a.id}`, { method: "PUT", body });
          else await api("/automations", { method: "POST", body });
          toast("已儲存");
          location.hash = "#automations";
        } catch (err) {
          toast(err.message, true);
        }
      });
    renderTv();
    renderSteps();
    preview();
  }
  function stepCard(s, i, others) {
    const p = (k) => `${i}.${k}`;
    let body = "";
    switch (s.type) {
      case "text":
        body = `<textarea class="input" data-s="${p("text")}" placeholder="訊息內容">${esc(s.text)}</textarea>`;
        break;
      case "buttons":
        body = `<textarea class="input" data-s="${p("text")}" placeholder="按鈕上方的文字">${esc(s.text)}</textarea>
          ${s.buttons
            .map(
              (b, j) => `<div class="btn-line">
                <input class="input" data-s="${p(`buttons.${j}.title`)}" maxlength="20" value="${esc(b.title)}" placeholder="按鈕文字"/>
                ${b.type === "postback" ? `<input class="input" data-s="${p(`buttons.${j}.payload`)}" value="${esc(b.payload)}" placeholder="payload"/>` : `<input class="input" data-s="${p(`buttons.${j}.url`)}" value="${esc(b.url)}" placeholder="https://"/>`}
                <select class="input" data-btype="${i}.${j}" style="width:auto"><option value="url" ${b.type === "url" ? "selected" : ""}>開網址</option><option value="postback" ${b.type === "postback" ? "selected" : ""}>回傳 payload</option></select>
                <button class="btn btn-ghost icon-btn" data-act="rm-btn" data-idx="${i}.${j}" aria-label="移除">${icon("x")}</button>
              </div>`,
            )
            .join("")}
          ${s.buttons.length < 3 ? `<div><button class="btn btn-sm" data-act="add-btn" data-idx="${i}">${icon("plus")}按鈕</button></div>` : ""}`;
        break;
      case "quick_replies":
        body = `<textarea class="input" data-s="${p("text")}" placeholder="問題">${esc(s.text)}</textarea>
          ${s.replies.map((r, j) => `<div class="btn-line" style="grid-template-columns:1fr 1fr auto"><input class="input" data-s="${p(`replies.${j}.title`)}" maxlength="20" value="${esc(r.title)}" placeholder="選項文字"/><input class="input" data-s="${p(`replies.${j}.payload`)}" value="${esc(r.payload)}" placeholder="payload（可留空）"/><button class="btn btn-ghost icon-btn" data-act="rm-qr" data-idx="${i}.${j}" aria-label="移除">${icon("x")}</button></div>`).join("")}
          <div><button class="btn btn-sm" data-act="add-qr" data-idx="${i}">${icon("plus")}選項</button></div>`;
        break;
      case "image":
        body = `<input class="input" data-s="${p("url")}" value="${esc(s.url)}" placeholder="https://圖片網址.jpg"/>`;
        break;
      case "delay":
        body = `<div class="row">等待 <input class="input" type="number" min="0" max="15" style="width:90px" data-s="${p("seconds")}" value="${s.seconds}"/> 秒（最多 15 秒）</div>`;
        break;
      case "tag":
        body = `<input class="input" data-s="${p("tag")}" value="${esc(s.tag)}" placeholder="標籤名稱"/>`;
        break;
      case "goto":
        body = `<select class="input" data-s="${p("automation_id")}">${others.map((x) => `<option value="${x.id}" ${x.id === Number(s.automation_id) ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`;
        break;
    }
    return `<div class="step-card"><div class="sh"><b>${i + 1}. ${STEP_LABEL[s.type]}</b><span class="row" style="gap:2px">
      <button class="btn btn-ghost btn-sm icon-btn" data-act="up" data-idx="${i}" aria-label="上移" style="transform:rotate(90deg)">${icon("left")}</button>
      <button class="btn btn-ghost btn-sm icon-btn" data-act="down" data-idx="${i}" aria-label="下移" style="transform:rotate(-90deg)">${icon("left")}</button>
      <button class="btn btn-ghost btn-sm icon-btn btn-danger" data-act="rm" data-idx="${i}" aria-label="刪除">${icon("trash")}</button></span></div>
      <div class="sb">${body}</div></div>`;
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
    el.innerHTML = `<div class="page narrow">
      ${pageHead("連接帳號", "連接粉絲專頁與 Instagram 後，自動回覆才會生效。", list.length ? connectBtn : "")}
      ${!o.app_configured ? (isOwner() ? `<div class="banner brand">${icon("sliders")}<div class="grow">要先完成 Meta App 設定，才能連接粉絲專頁。</div><a class="btn btn-sm btn-primary" href="#setup/meta">前往設定</a></div>` : `<div class="banner warning">${icon("info")}<div class="grow">平台管理員還沒完成設定，暫時無法連接。</div></div>`) : ""}
      <div class="card">
        ${list.length
          ? list
              .map(
                (c) => `<div class="conn">
                  <div class="ci ${c.platform === "instagram" ? "ig" : "fb"}">${icon(c.platform === "instagram" ? "instagram" : "facebook")}</div>
                  <div class="cm"><b>${esc(c.name)}</b><span>${c.platform === "instagram" ? "Instagram 專業帳號" : "Facebook 粉絲專頁"} · ID ${esc(c.external_id)}</span></div>
                  <span class="badge success"><span class="bdot"></span>已連接</span>
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
      ${list.length ? "" : `<div class="grid-3" style="margin-top:16px">
        ${miniInfo("shield", "安全", "我們只取得傳送訊息需要的權限，不會在你的專頁發文。")}
        ${miniInfo("zap", "全自動", "連接後會自動完成 Webhook 訂閱與「開始使用」按鈕設定。")}
        ${miniInfo("instagram", "Instagram", "IG 需先切換成專業帳號，並在 Meta 商業套件綁定到粉絲專頁。")}
      </div>`}
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
      try { const r = await api(`/channels/${b.dataset.test}/test`, { method: "POST" }); toast(`連線正常：${r.result.name || r.result.id}`); }
      catch (err) { toast(`連線有問題：${err.message}。請重新連接 Facebook。`, true); }
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
  const miniInfo = (ic, t, d) => `<div class="card card-body" style="padding:16px 18px"><div class="row" style="gap:8px;margin-bottom:4px;color:var(--text)">${icon(ic).replace("<svg", '<svg style="width:16px;height:16px;color:var(--brand)"')}<b>${t}</b></div><p class="small muted">${d}</p></div>`;

  async function renderConnect(el, pendingId) {
    let pages;
    try {
      pages = await api(`/facebook/pending/${pendingId}`);
    } catch (err) {
      toast(err.message, true);
      location.hash = "#connections";
      return;
    }
    el.innerHTML = `<div class="page narrow">
      ${backLink("#connections", "連接帳號")}
      ${pageHead("選擇要連接的粉絲專頁", "勾選後按「連接」，其餘設定會自動完成。")}
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
          el.innerHTML = `<div class="page narrow"><div class="card">${empty(
            ok ? "check" : "alert",
            ok ? "連接完成" : "已連接，但有部分設定沒完成",
            r.results.map((x) => `<b>${esc(x.name)}</b>${x.instagram ? ` 與 Instagram @${esc(x.instagram)}` : ""}${x.errors.length ? `<br/><span style="color:var(--danger)">${x.errors.map(esc).join("<br/>")}</span>` : ""}`).join("<br/>"),
            `<a class="btn btn-primary" href="#automations/new/ad">${icon("plus")}建立自動回覆</a><a class="btn" href="#connections">查看連接</a>`,
          )}</div></div>`;
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
    el.innerHTML = `<div class="page">
      ${backLink("#contacts", "聯絡人")}
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
          <li><div><b>設定登入回呼網址</b><p class="muted small">到「Facebook 登入（商家版）→ 設定」，把下面的網址貼到「有效的 OAuth 重新導向 URI」並儲存。</p>${copyField(s.oauth_redirect_url)}</div></li>
          <li><div><b>登記 Webhook</b><p class="muted small">讓 Meta 把訊息送到這個平台。按下按鈕自動完成。</p>
            <div class="row"><button class="btn" id="m-hook" data-busy="登記中" ${s.meta_app_secret_set ? "" : "disabled"}>${icon("zap")}自動登記 Webhook</button><span id="m-hook-result"></span></div>
            <details class="adv"><summary>${icon("right")}自動登記失敗？手動設定</summary>
              <div class="stack-sm" style="margin-top:10px"><p class="small muted">在 Messenger 與 Instagram 產品的「Webhooks」設定填入：</p>
                <span class="small"><b>回呼網址</b></span>${copyField(s.webhook_url)}
                <span class="small"><b>驗證權杖</b></span>${copyField(s.verify_token)}
                <span class="small"><b>訂閱欄位</b>：${s.webhook_fields.map((f) => `<code>${f}</code>`).join("、")}</span>
              </div></details>
          </div></li>
          <li><div><b>送審並上線</b><p class="muted small">App 在開發模式時，只有你加入的測試人員能收到自動回覆。要開放給所有客人，在「應用程式審查」申請 <code>pages_messaging</code>、<code>pages_show_list</code>、<code>pages_manage_metadata</code>、<code>instagram_basic</code>、<code>instagram_manage_messages</code>，通過後切換到上線模式。可以先完成其他設定，不影響使用。</p></div></li>
        </ol></div>${footer()}</div>`;
      const saveKeys = async () => {
        const payload = { meta_app_id: $("#m-id").value.trim() };
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
