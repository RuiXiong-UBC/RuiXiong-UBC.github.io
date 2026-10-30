/* 页面渲染脚本：一般不需要修改。网站内容请在根目录的 content.js 中编辑。 */
(function () {
  "use strict";

  var SITE = window.SITE || {};
  var SECTIONS = SITE.sections || {};
  var ORDER = ["education", "experience", "publications", "projects"];
  var LANGS = [
    { code: "zh", label: "中", name: "中文", html: "zh-CN" },
    { code: "en", label: "EN", name: "English", html: "en" }
  ];

  // 界面上固定的小字（不属于个人内容）
  var UI = {
    home: { zh: "主页", en: "Home" },
    about: { zh: "关于我", en: "About" },
    cv: { zh: "简历", en: "CV" },
    scroll: { zh: "向下滑动", en: "Scroll" },
    countOne: { zh: "共 1 条", en: "1 entry" },
    count: { zh: "共 {n} 条", en: "{n} entries" },
    open: { zh: "查看", en: "View" },
    contact: { zh: "联系方式", en: "Contact" },
    updated: { zh: "最后更新", en: "Last updated" },
    menu: { zh: "菜单", en: "Menu" },
    close: { zh: "关闭", en: "Close" },
    language: { zh: "语言", en: "Language" },
    backToCv: { zh: "回到简历", en: "Back to CV" },
    enlarge: { zh: "查看大图", en: "Enlarge image" },
    githubAll: { zh: "在 GitHub 上查看全部项目", en: "See all projects on GitHub" },
    details: { zh: "查看详情", en: "Details" },
    courses: { zh: "课程", en: "Courses" },
    empty: { zh: "内容即将更新", en: "Coming soon" }
  };

  var ICON_PATHS = {
    education: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2.5 2 9.5 2 12 0v-5"/><path d="M22 9v6"/>',
    experience: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M3 13h18"/>',
    publications: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/>',
    projects: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    arrow: '<path d="M9.5 6l6 6-6 6"/>',
    back: '<path d="M14.5 6l-6 6 6 6"/>',
    down: '<path d="M6 9.5l6 6 6-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    ext: '<path d="M8 16L16 8M10 8h6v6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  function icon(name) {
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + "</svg>";
  }

  var app = document.getElementById("app");
  var page = (app && app.getAttribute("data-page")) || "home";
  var lang = initialLang();

  function initialLang() {
    var codes = LANGS.map(function (l) { return l.code; });
    var fromUrl = null;
    try { fromUrl = new URLSearchParams(location.search).get("lang"); } catch (e) {}
    if (codes.indexOf(fromUrl) > -1) return fromUrl;
    try {
      var saved = localStorage.getItem("site-lang");
      if (codes.indexOf(saved) > -1) return saved;
    } catch (e) {}
    return codes.indexOf(SITE.defaultLanguage) > -1 ? SITE.defaultLanguage : "zh";
  }

  /* ---------- 小工具 ---------- */
  // 取当前语言的文字；缺少时依次退回 中文 → 英文
  function t(v) {
    if (v == null) return "";
    if (typeof v !== "object") return String(v);
    var order = [lang, "zh", "en"];
    for (var i = 0; i < order.length; i++) {
      var s = v[order[i]];
      if (s != null && s !== "") return String(s);
    }
    return "";
  }
  function ui(key) { return t(UI[key]); }
  function count(n) { return n === 1 ? ui("countOne") : ui("count").replace("{n}", n); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function plain(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent || "";
  }
  function list(v) { return Array.isArray(v) ? v : v ? [v] : []; }
  function sectionIds() { return ORDER.filter(function (id) { return SECTIONS[id]; }); }
  function countItems(sec) {
    return list(sec.groups).reduce(function (n, g) { return n + list(g.items).length; }, 0);
  }
  function isWeb(url) { return /^https?:/i.test(url); }
  function linkAttrs(url) {
    return 'href="' + esc(url) + '"' + (isWeb(url) ? ' target="_blank" rel="noopener"' : "");
  }

  /* ---------- 公共片段 ---------- */
  function layer0(src) {
    return '<div class="layer0" aria-hidden="true"' +
      (src ? ' style="background-image:url(&quot;' + esc(src) + '&quot;)"' : "") + "></div>";
  }

  // 输入框里的换行，在网页上也换行
  function br(s) { return s.replace(/\r?\n/g, "<br>"); }
  function paras(v) {
    return list(v).map(function (p) { return "<p>" + br(t(p)) + "</p>"; }).join("");
  }

  // 课程列表：每行一门课，「|」后面是成绩；以 # 开头的行是小标题（例如 # 大一），把课程分成几栏
  function coursesHTML(it) {
    var rows = (Array.isArray(it.courses) ? it.courses.map(t) : t(it.courses).split("\n"))
      .map(function (s) { return s.trim(); }).filter(Boolean);
    var groups = [], total = 0;
    rows.forEach(function (r) {
      var head = /^[#＃]+\s*(.*)$/.exec(r);
      if (head || !groups.length) groups.push({ title: head ? head[1] : "", rows: [] });
      if (!head) { groups[groups.length - 1].rows.push(r); total++; }
    });
    if (!total) return "";
    return '<section class="courses"><h4 class="courses-title">' + (t(it.coursesTitle) || ui("courses")) +
      "<span>" + total + "</span></h4>" + groups.map(function (g) {
        if (!g.rows.length) return "";
        return (g.title ? '<h5 class="course-group">' + g.title + "<span>" + g.rows.length + "</span></h5>" : "") +
          '<ul class="course-list">' + g.rows.map(function (r) {
            var k = r.lastIndexOf("|");
            var grade = k > -1 ? r.slice(k + 1).trim() : "";
            return '<li><span class="course-name">' + (k > -1 ? r.slice(0, k).trim() : r) + "</span>" +
              (grade ? '<span class="course-grade">' + grade + "</span>" : "") + "</li>";
          }).join("") + "</ul>";
      }).join("") + "</section>";
  }

  function gallery(imgs) {
    imgs = list(imgs);
    if (!imgs.length) return "";
    return '<div class="gallery">' + imgs.map(function (im) {
      var cap = t(im.caption);
      return '<figure><button type="button" class="thumb" data-full="' + esc(im.src) + '" data-cap="' + esc(plain(cap)) +
        '" aria-label="' + esc(ui("enlarge")) + '"><img src="' + esc(im.src) + '" alt="' + esc(plain(cap)) + '" loading="lazy"></button>' +
        (cap ? "<figcaption>" + cap + "</figcaption>" : "") + "</figure>";
    }).join("") + "</div>";
  }

  function links(ls, github) {
    ls = list(ls);
    if (!ls.length && !github) return "";
    return '<div class="entry-links">' +
      (github ? '<a class="chip chip--gh" ' + linkAttrs(github) + ">" + icon("github") + "GitHub</a>" : "") +
      ls.map(function (l) {
        return '<a class="chip" ' + linkAttrs(l.url) + ">" + t(l.label) + icon("ext") + "</a>";
      }).join("") + "</div>";
  }

  function navHTML() {
    var home = page === "home";
    var items = [
      { href: home ? "#home" : "index.html", label: ui("home"), active: home },
      { href: home ? "#about" : "index.html#about", label: t((SITE.about || {}).title) || ui("about") }
    ];
    sectionIds().forEach(function (id) {
      var s = SECTIONS[id];
      // 主页上跳到页内对应部分；子页面之间互相跳转
      items.push({ href: home ? "#" + id : id + ".html", label: t(s.navTitle || s.title), active: page === id });
    });
    return '<header class="nav" id="nav"><div class="nav-inner">' +
      '<a class="brand" href="' + (home ? "#home" : "index.html") + '">' + t(SITE.name) + "</a>" +
      '<nav class="nav-links" id="nav-links">' + items.map(function (it) {
        return '<a href="' + it.href + '"' + (it.active ? ' class="active" aria-current="page"' : "") + ">" + it.label + "</a>";
      }).join("") + "</nav>" +
      '<div class="lang" role="group" aria-label="' + esc(ui("language")) + '">' + LANGS.map(function (l) {
        return '<button type="button" data-lang="' + l.code + '" aria-pressed="' + (l.code === lang) + '" title="' + l.name + '">' + l.label + "</button>";
      }).join("") + "</div>" +
      '<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="' + esc(ui("menu")) + '">' + icon("menu") + "</button>" +
      "</div></header>";
  }

  function footerHTML() {
    var cs = list(SITE.contacts).map(function (c) {
      return '<li><span class="c-label">' + t(c.label) + "</span>" +
        (c.url ? "<a " + linkAttrs(c.url) + ">" + t(c.text) + "</a>" : "<span>" + t(c.text) + "</span>") + "</li>";
    }).join("");
    return '<footer class="site-footer" data-edit="contacts">' +
      '<div><h2 class="foot-title">' + ui("contact") + '</h2><ul class="contacts">' + cs + "</ul></div>" +
      '<p class="foot-note">© ' + new Date().getFullYear() + " " + t(SITE.name) +
      (SITE.lastUpdated ? "<br>" + ui("updated") + " " + t(SITE.lastUpdated) : "") + "</p></footer>";
  }

  function lightboxHTML() {
    return '<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" hidden>' +
      '<button type="button" class="lb-close" aria-label="' + esc(ui("close")) + '">' + icon("close") + "</button>" +
      '<figure><img alt=""><figcaption></figcaption></figure></div>';
  }

  /* ---------- 主页 ---------- */
  function homeHTML() {
    var a = SITE.about || {};
    var cv = SITE.cv || {};
    var photo = a.photo
      ? '<figure class="about-photo"><img src="' + esc(a.photo) + '" alt="' + esc(plain(t(SITE.name))) + '">' +
        (a.photoCaption ? "<figcaption>" + t(a.photoCaption) + "</figcaption>" : "") + "</figure>"
      : "";
    var info = list(a.info).length
      ? '<dl class="info">' + list(a.info).map(function (i) {
          return '<div class="info-row"><dt>' + t(i.label) + "</dt><dd>" + t(i.value) + "</dd></div>";
        }).join("") + "</dl>"
      : "";
    var cards = sectionIds().map(function (id) {
      var s = SECTIONS[id];
      return '<a class="cv-card" href="#' + id + '" data-edit="sections.' + id + '">' +
        '<span class="cv-icon">' + icon(id) + "</span>" +
        "<h3>" + t(s.title) + "</h3>" +
        "<p>" + t(s.summary) + "</p>" +
        '<span class="cv-meta"><span>' + count(countItems(s)) + "</span><span>" + ui("open") + icon("down") + "</span></span></a>";
    }).join("");
    var blocks = sectionIds().map(blockHTML).join("");
    var banner = cv.bannerImage ? ' style="background-image:url(&quot;' + esc(cv.bannerImage) + '&quot;)"' : "";

    return layer0(SITE.background) + "<main>" +
      '<section class="hero" id="home"><div class="hero-card" data-edit="site">' +
        '<h1 class="hero-name">' + t(SITE.name) + "</h1>" +
        (SITE.tagline ? '<p class="hero-tag">' + t(SITE.tagline) + "</p>" : "") +
      '</div><a class="scroll-hint" href="#about" aria-label="' + esc(ui("scroll")) + '">' + icon("down") + "</a></section>" +

      '<section class="sheet" id="about"><div class="wrap" data-edit="about">' +
        '<h2 class="sec-title">' + (t(a.title) || ui("about")) + "</h2>" +
        (a.subtitle ? '<p class="sec-sub">' + t(a.subtitle) + "</p>" : "") +
        '<div class="about-grid' + (photo ? "" : " no-photo") + '">' + photo +
          '<div class="about-text">' + paras(a.text) + info + "</div></div>" +
        gallery(a.images) +
      "</div></section>" +

      '<section class="window' + (banner ? " has-image" : "") + '"' + banner + ">" +
        '<p class="window-text">' + t(cv.bannerTitle || cv.title) + "</p></section>" +

      '<section class="sheet sheet--gray" id="cv"><div class="wrap">' +
        '<header class="sec-head" data-edit="cv">' +
          '<h2 class="sec-title">' + (t(cv.title) || ui("cv")) + "</h2>" +
          (cv.subtitle ? '<p class="sec-sub">' + t(cv.subtitle) + "</p>" : "") +
        "</header>" +
        '<div class="cv-grid">' + cards + "</div>" +
        blocks +
        footerHTML() +
      "</div></section></main>";
  }

  /* ---------- 主页简历：四个部分依次展开的核心内容（不含段落、图片等细节） ---------- */
  function compactHTML(it, path) {
    var meta = it.authors || it.venue ? [t(it.venue)] : [t(it.org), t(it.location)];
    meta = meta.filter(Boolean).map(function (x) { return "<span>" + x + "</span>"; }).join("");
    var logo = it.logo
      ? '<div class="entry-logo"><img src="' + esc(it.logo) + '" alt="' + esc(plain(t(it.org) || t(it.title))) + '" loading="lazy"></div>'
      : "";
    return '<article class="entry entry--compact' + (logo ? "" : " no-logo") + '" data-edit="' + path + '"><div class="entry-body">' +
      (it.time ? '<p class="entry-time">' + t(it.time) + "</p>" : "") +
      '<h4 class="entry-title">' + t(it.title) + "</h4>" +
      (it.authors ? '<p class="entry-authors">' + t(it.authors) + "</p>" : "") +
      (meta ? '<p class="entry-org">' + meta + "</p>" : "") +
      (it.github ? links(null, it.github) : "") +
      "</div>" + logo + "</article>";
  }

  function blockHTML(id) {
    var s = SECTIONS[id];
    var groups = list(s.groups).map(function (g, gi) {
      var items = list(g.items).map(function (it, j) {
        return compactHTML(it, "sections." + id + ".groups." + gi + ".items." + j);
      }).join("");
      if (!items) return "";
      var title = t(g.title);
      return (title ? '<h4 class="cv-group-title">' + title + "</h4>" : "") + '<div class="group-list">' + items + "</div>";
    }).join("");
    return '<section class="cv-block" id="' + id + '">' +
      '<header class="cv-block-head"><span class="cv-block-icon">' + icon(id) + "</span>" +
        "<h3>" + t(s.title) + "</h3>" +
        '<a class="cv-more" href="' + id + '.html">' + ui("details") + icon("arrow") + "</a></header>" +
      groups + "</section>";
  }

  /* ---------- 简历子页面 ---------- */
  function entryHTML(it, path) {
    var title = t(it.title);
    if (it.url) title = "<a " + linkAttrs(it.url) + ">" + title + "</a>";
    var meta = [t(it.org), t(it.location)].filter(Boolean).map(function (x) { return "<span>" + x + "</span>"; }).join("");
    var body =
      (it.time ? '<p class="entry-time">' + t(it.time) + "</p>" : "") +
      '<h3 class="entry-title">' + title + "</h3>" +
      (it.authors ? '<p class="entry-authors">' + t(it.authors) + "</p>" : "") +
      (meta ? '<p class="entry-org">' + meta + "</p>" : "") +
      (it.venue ? '<p class="entry-venue">' + t(it.venue) + "</p>" : "") +
      (list(it.text).length ? '<div class="entry-text">' + paras(it.text) + "</div>" : "") +
      (list(it.bullets).length ? '<ul class="entry-bullets">' + list(it.bullets).map(function (b) { return "<li>" + br(t(b)) + "</li>"; }).join("") + "</ul>" : "") +
      coursesHTML(it) +
      links(it.links, it.github) +
      gallery(it.images);
    var logo = it.logo
      ? '<div class="entry-logo"><img src="' + esc(it.logo) + '" alt="' + esc(plain(t(it.org) || t(it.title))) + '" loading="lazy"></div>'
      : "";
    return '<article class="entry' + (logo ? "" : " no-logo") + '" data-edit="' + path + '"><div class="entry-body">' + body + "</div>" + logo + "</article>";
  }

  function sectionHTML(id) {
    var s = SECTIONS[id] || {};
    var ids = sectionIds();
    var i = ids.indexOf(id);
    var prev = ids[i - 1], next = ids[i + 1];
    // 访客看不到空分组；管理模式下保留，方便往里面加条目
    var admin = document.documentElement.classList.contains("is-admin");
    var groups = list(s.groups).map(function (g, gi) {
      var title = t(g.title);
      var base = "sections." + id + ".groups." + gi;
      var items = list(g.items).map(function (it, j) { return entryHTML(it, base + ".items." + j); }).join("");
      if (!items && !admin) return "";
      return '<section class="group" data-edit="' + base + '">' + (title ? '<h2 class="group-title">' + title + "</h2>" : "") +
        (items ? '<div class="group-list">' + items + "</div>" : "") + "</section>";
    }).join("");
    if (!groups && !s.github && !admin) groups = '<p class="empty-note">' + ui("empty") + "</p>";
    function pageLink(k, cls, ic, before) {
      if (!k) return "<span></span>";
      var label = t(SECTIONS[k].navTitle || SECTIONS[k].title);
      return '<a class="' + cls + '" href="' + k + '.html">' + (before ? icon(ic) + label : label + icon(ic)) + "</a>";
    }

    return layer0(s.heroImage || SITE.background) + "<main>" +
      '<section class="hero hero--page"><div class="hero-card" data-edit="sections.' + id + '">' +
        '<a class="crumb" href="index.html#cv">' + icon("back") + ui("home") + " · " + ui("cv") + "</a>" +
        '<h1 class="hero-name">' + t(s.title) + "</h1>" +
        (s.intro ? '<p class="hero-tag">' + t(s.intro) + "</p>" : "") +
      "</div></section>" +
      '<section class="sheet sheet--gray"><div class="wrap">' + groups +
        (s.github ? '<p class="gh-all"><a class="gh-button" ' + linkAttrs(s.github) + ">" + icon("github") + ui("githubAll") + icon("arrow") + "</a></p>" : "") +
        '<nav class="pager">' +
          pageLink(prev, "pager-prev", "back", true) +
          '<a class="pager-home" href="index.html#cv">' + ui("backToCv") + "</a>" +
          pageLink(next, "pager-next", "arrow", false) +
        "</nav>" +
        footerHTML() +
      "</div></section></main>";
  }

  /* ---------- 渲染与交互 ---------- */
  function render() {
    // 管理模式下内容可能被修改过，每次渲染都重新读取
    SITE = window.SITE || {};
    SECTIONS = SITE.sections || {};
    var L = LANGS.filter(function (l) { return l.code === lang; })[0];
    document.documentElement.lang = L ? L.html : lang;
    app.innerHTML = navHTML() + (page === "home" ? homeHTML() : sectionHTML(page)) + lightboxHTML();
    var name = plain(t(SITE.name));
    document.title = page === "home" ? name : plain(t((SECTIONS[page] || {}).title)) + " · " + name;
    onScroll();
    if (window.SiteAdminHook) window.SiteAdminHook();
  }
  window.SiteApp = { render: render, page: page, order: ORDER, langs: LANGS };

  function setLang(code) {
    if (code === lang) return;
    lang = code;
    try { localStorage.setItem("site-lang", code); } catch (e) {}
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  function onScroll() {
    var nav = document.getElementById("nav");
    if (nav) nav.classList.toggle("solid", window.scrollY > 40 || nav.classList.contains("open"));
  }

  function setMenu(open) {
    var nav = document.getElementById("nav");
    if (!nav) return;
    nav.classList.toggle("open", open);
    var btn = nav.querySelector(".nav-toggle");
    if (btn) btn.setAttribute("aria-expanded", String(open));
    onScroll();
  }

  function openLightbox(btn) {
    var lb = document.getElementById("lightbox");
    lb.querySelector("img").src = btn.getAttribute("data-full");
    lb.querySelector("img").alt = btn.getAttribute("data-cap") || "";
    lb.querySelector("figcaption").textContent = btn.getAttribute("data-cap") || "";
    lb.hidden = false;
    lb.querySelector(".lb-close").focus();
  }
  function closeLightbox() {
    var lb = document.getElementById("lightbox");
    if (lb) lb.hidden = true;
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-lang]");
    if (el) { setLang(el.getAttribute("data-lang")); return; }
    if (e.target.closest(".nav-toggle")) {
      setMenu(!document.getElementById("nav").classList.contains("open"));
      return;
    }
    if (e.target.closest(".nav-links a")) setMenu(false);
    el = e.target.closest("[data-full]");
    if (el) { openLightbox(el); return; }
    if (e.target.closest(".lightbox")) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeLightbox(); setMenu(false); }
  });
  window.addEventListener("scroll", onScroll, { passive: true });

  if (!app) return;
  render();
  // 内容是脚本生成的，浏览器自带的锚点跳转会落空，这里补一次
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }
})();
