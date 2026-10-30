/* =====================================================================
 *  管理模式（只有管理员能看到，访客打开网站时这个文件什么都不做）
 *
 *  进入：在网址后面加 #admin，例如 https://yourname.github.io/#admin
 *        进入一次后，这台电脑的浏览器会一直保持管理模式，直到点「退出管理」。
 *  修改：每个模块右上角有「编辑」按钮，条目可以上移、下移、删除、新增。
 *  保存：「保存到网站」会把修改提交到你的 GitHub 仓库（需要先在「GitHub 设置」里
 *        填写访问令牌），约 1 分钟后所有访客都能看到新内容。
 *        访客没有你的令牌，所以就算打开 #admin 也只能改到自己电脑上的预览，
 *        无法改动真正的网站。
 * ===================================================================== */
(function () {
  "use strict";

  var FLAG = "site-admin", DRAFT = "site-draft", SAVED = "site-draft-saved", GH = "site-admin-github";

  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) {
    try {
      if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v);
      return true;
    } catch (e) { return false; }
  }

  var wants = /(^|[?&])admin(=|&|$)/.test(location.search.slice(1)) || location.hash === "#admin";
  if (wants) store(FLAG, "1");
  if (!wants && load(FLAG) !== "1") {
    // 在已打开的页面后面补上 #admin 时，浏览器不会自动刷新，这里替你刷新
    window.addEventListener("hashchange", function () {
      if (location.hash === "#admin") location.reload();
    });
    return;
  }
  if (location.hash === "#admin") {
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  // 线上版本 vs 本地草稿
  var liveJSON = JSON.stringify(window.SITE || {});
  var draftJSON = load(DRAFT);
  if (draftJSON === liveJSON) { store(DRAFT, null); store(SAVED, null); draftJSON = null; }
  var site = (draftJSON && parse(draftJSON)) || clone(window.SITE || {});
  window.SITE = site;
  document.documentElement.classList.add("is-admin");

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "assets/admin.css";
  document.head.appendChild(css);

  var LANGS = [{ code: "zh", label: "中" }, { code: "en", label: "EN" }];
  var SECTION_NAMES = { education: "教育背景", experience: "实习与工作经历", publications: "出版物", projects: "项目" };

  /* ---------- 草稿与状态 ---------- */
  var storageFull = false;
  function saveDraft() {
    var cur = JSON.stringify(site);
    if (cur === liveJSON) { store(DRAFT, null); storageFull = false; }
    else storageFull = !store(DRAFT, cur);
    updateStatus();
  }
  function rerender() {
    if (window.SiteApp) window.SiteApp.render();
  }
  function commit() { saveDraft(); rerender(); }

  function updateStatus(msg, tone) {
    var el = document.getElementById("adm-status");
    if (!el) return;
    if (!msg) {
      var cur = JSON.stringify(site);
      if (cur === liveJSON) { msg = "与网站内容一致"; tone = "ok"; }
      else if (cur === load(SAVED)) { msg = "已保存到 GitHub，网站约 1 分钟后更新"; tone = "ok"; }
      else { msg = "有修改还没保存到网站"; tone = "warn"; }
      if (storageFull) { msg = "浏览器存储已满，请尽快保存到网站"; tone = "bad"; }
    }
    el.textContent = msg;
    el.className = "adm-status adm-" + (tone || "ok");
  }

  /* ---------- 路径工具 ---------- */
  function getPath(path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, site);
  }
  function kindOf(path) {
    if (/\.items\.\d+$/.test(path)) return "entry";
    if (/\.groups\.\d+$/.test(path)) return "group";
    if (/^sections\.\w+$/.test(path)) return "section";
    return path;
  }
  function parentOf(path) {
    var ks = path.split(".");
    var i = +ks.pop();
    return { arr: getPath(ks.join(".")), index: i };
  }

  /* ---------- 小型 DOM 工具 ---------- */
  var uid = 0;
  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function button(text, cls, attrs) {
    var b = h("button", cls, text);
    b.type = "button";
    Object.keys(attrs || {}).forEach(function (k) { b.setAttribute(k, attrs[k]); });
    return b;
  }

  /* ---------- 表单字段 ---------- */
  function I(key, label, opt) {
    var f = { key: key, label: label, type: "i18n" };
    Object.keys(opt || {}).forEach(function (k) { f[k] = opt[k]; });
    return f;
  }
  var linkItem = { type: "object", fields: [I("label", "按钮文字"), { key: "url", label: "链接地址", type: "str", placeholder: "https://" }] };
  var imageItem = { type: "object", fields: [{ key: "src", label: "图片", type: "image" }, I("caption", "图片说明")] };
  var infoItem = { type: "object", fields: [I("label", "名称"), I("value", "内容")] };
  var contactItem = {
    type: "object",
    fields: [I("label", "名称", { hint: "例如：邮箱、GitHub" }), { key: "text", label: "显示文字", type: "str" }, { key: "url", label: "链接", type: "str", placeholder: "https:// 或 mailto:" }]
  };
  var HTML_HINT = "可以写 <a href='https://…'>链接</a>、<b>加粗</b>、<i>斜体</i>";

  function wrapField(f, inner) {
    var w = h("div", "adm-field");
    if (f.label) w.appendChild(h("div", "adm-label", f.label));
    w.appendChild(inner);
    if (f.hint) w.appendChild(h("p", "adm-hint", f.hint));
    return w;
  }

  function fieldEditor(f, v) {
    if (f.type === "i18n") return i18nEditor(f, v);
    if (f.type === "image") return imageEditor(f, v);
    if (f.type === "list") return listEditor(f, v);
    if (f.type === "object") return objectEditor(f, v);
    if (f.type === "select") return selectEditor(f, v);
    return strEditor(f, v);
  }

  // 每种语言一个输入框；两种都一样时存成一个字符串
  function i18nEditor(f, v) {
    var vals = v && typeof v === "object" ? v : { zh: v, en: v };
    var box = h("div", "adm-i18n"), inputs = {};
    LANGS.forEach(function (l) {
      var id = "adm-f" + (++uid);
      var row = h("div", "adm-lrow");
      var lab = h("label", "adm-lcode", l.label);
      lab.htmlFor = id;
      var inp = document.createElement(f.multiline ? "textarea" : "input");
      if (f.multiline) inp.rows = f.rows || 3; else inp.type = "text";
      inp.id = id;
      inp.value = vals[l.code] == null ? "" : String(vals[l.code]);
      inputs[l.code] = inp;
      row.appendChild(lab);
      row.appendChild(inp);
      box.appendChild(row);
    });
    return {
      el: wrapField(f, box),
      get: function () {
        var o = {}, n = 0;
        LANGS.forEach(function (l) {
          var s = inputs[l.code].value.trim();
          if (s) { o[l.code] = s; n++; }
        });
        if (!n) return undefined;
        if (n === LANGS.length && o.zh === o.en) return o.zh;
        return o;
      }
    };
  }

  function strEditor(f, v) {
    var inp = h("input", "adm-input");
    inp.type = f.secret ? "password" : "text";
    inp.id = "adm-f" + (++uid);
    inp.value = v == null ? "" : String(v);
    if (f.placeholder) inp.placeholder = f.placeholder;
    if (f.secret) inp.autocomplete = "off";
    return { el: wrapField(f, inp), get: function () { return inp.value.trim() || undefined; } };
  }

  function selectEditor(f, v) {
    var sel = h("select", "adm-input");
    sel.id = "adm-f" + (++uid);
    f.options.forEach(function (o) {
      var op = h("option", null, o.label);
      op.value = o.value;
      sel.appendChild(op);
    });
    sel.value = v || f.options[0].value;
    return { el: wrapField(f, sel), get: function () { return sel.value; } };
  }

  // 上传的图片先以 data URL 存在草稿里，保存到 GitHub 时再写成 images/uploads/ 下的文件
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = reject;
      fr.onload = function () {
        var url = fr.result;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(url);
        var img = new Image();
        img.onload = function () {
          var k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
          if (k === 1 && file.size < 700000) return resolve(url);
          var c = document.createElement("canvas");
          c.width = Math.round(img.naturalWidth * k);
          c.height = Math.round(img.naturalHeight * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = function () { resolve(url); };
        img.src = url;
      };
      fr.readAsDataURL(file);
    });
  }

  function imageEditor(f, v) {
    var cur = v || "";
    var box = h("div", "adm-image");
    var prev = h("img", "adm-preview");
    prev.alt = "";
    var side = h("div", "adm-image-side");
    var inp = h("input", "adm-input");
    inp.type = "text";
    inp.id = "adm-f" + (++uid);
    var file = h("input");
    file.type = "file";
    file.accept = "image/*";
    file.hidden = true;
    var row = h("div", "adm-row");
    var up = button("上传图片", "adm-btn");
    var clr = button("移除", "adm-btn adm-quiet");
    row.appendChild(up);
    row.appendChild(clr);
    side.appendChild(inp);
    side.appendChild(row);
    box.appendChild(prev);
    box.appendChild(side);
    box.appendChild(file);

    function sync() {
      var isData = /^data:/.test(cur);
      prev.hidden = !cur;
      if (cur) prev.src = cur;
      inp.value = isData ? "" : cur;
      inp.placeholder = isData ? "已选新图片，保存时存入 images/uploads/" : "images/文件名.jpg";
    }
    inp.addEventListener("input", function () {
      cur = inp.value.trim();
      prev.hidden = !cur;
      if (cur) prev.src = cur;
    });
    up.addEventListener("click", function () { file.click(); });
    clr.addEventListener("click", function () { cur = ""; sync(); });
    file.addEventListener("change", function () {
      var fl = file.files && file.files[0];
      file.value = "";
      if (!fl) return;
      up.textContent = "处理中…";
      readImage(fl).then(function (u) { cur = u; sync(); up.textContent = "上传图片"; },
        function () { up.textContent = "上传图片"; });
    });
    sync();
    return { el: wrapField(f, box), get: function () { return cur || undefined; } };
  }

  function objectEditor(f, v) {
    v = v && typeof v === "object" ? v : {};
    var box = h("div", "adm-object");
    var eds = f.fields.map(function (sf) {
      var e = fieldEditor(sf, v[sf.key]);
      box.appendChild(e.el);
      return { f: sf, e: e };
    });
    return {
      el: wrapField(f, box),
      get: function () {
        var o = clone(v), n = 0;
        eds.forEach(function (x) {
          var val = x.e.get();
          if (val === undefined) delete o[x.f.key]; else { o[x.f.key] = val; n++; }
        });
        return n ? o : undefined;
      }
    };
  }

  function listEditor(f, v) {
    var box = h("div", "adm-list");
    var holder = h("div", "adm-list-items");
    var rows = [];
    function renumber() {
      rows.forEach(function (r, i) {
        r.n.textContent = "#" + (i + 1);
        holder.appendChild(r.card);
      });
    }
    function addRow(val) {
      var card = h("div", "adm-item");
      var bar = h("div", "adm-item-bar");
      var n = h("span", "adm-item-n");
      bar.appendChild(n);
      bar.appendChild(button("↑", "adm-mini", { "data-a": "up", "aria-label": "上移" }));
      bar.appendChild(button("↓", "adm-mini", { "data-a": "down", "aria-label": "下移" }));
      bar.appendChild(button("删除", "adm-mini adm-danger", { "data-a": "del" }));
      var sub = {};
      Object.keys(f.item).forEach(function (k) { sub[k] = f.item[k]; });
      sub.label = "";
      var ed = fieldEditor(sub, val);
      card.appendChild(bar);
      card.appendChild(ed.el);
      var row = { card: card, ed: ed, n: n };
      rows.push(row);
      bar.addEventListener("click", function (e) {
        var a = e.target.getAttribute("data-a");
        var i = rows.indexOf(row);
        if (a === "del") { rows.splice(i, 1); card.remove(); }
        else if (a === "up" && i > 0) { rows.splice(i, 1); rows.splice(i - 1, 0, row); }
        else if (a === "down" && i < rows.length - 1) { rows.splice(i, 1); rows.splice(i + 1, 0, row); }
        renumber();
      });
    }
    (Array.isArray(v) ? v : v ? [v] : []).forEach(addRow);
    renumber();
    var add = button("+ " + (f.add || "添加"), "adm-btn adm-add-item");
    add.addEventListener("click", function () { addRow(undefined); renumber(); });
    box.appendChild(holder);
    box.appendChild(add);
    return {
      el: wrapField(f, box),
      get: function () {
        var out = rows.map(function (r) { return r.ed.get(); }).filter(function (x) { return x !== undefined; });
        return out.length ? out : undefined;
      }
    };
  }

  /* ---------- 各模块的字段 ---------- */
  var SITE_FIELDS = [
    I("name", "名字"),
    I("tagline", "名字下方的一句话"),
    { key: "background", label: "第 0 层背景照片", type: "image", hint: "建议横向大图，宽 2000 像素左右" },
    { key: "defaultLanguage", label: "访客默认语言", type: "select", options: [{ value: "zh", label: "中文" }, { value: "en", label: "English" }] },
    I("lastUpdated", "最后更新时间", { hint: "显示在页面底部，例如 2026.10" })
  ];
  var ABOUT_FIELDS = [
    I("title", "标题"),
    I("subtitle", "副标题"),
    { key: "photo", label: "个人照片", type: "image", hint: "竖版照片效果最好（4:5）" },
    I("photoCaption", "照片下方文字"),
    { key: "text", label: "介绍段落", type: "list", item: I(null, "", { multiline: true }), add: "添加段落", hint: HTML_HINT },
    { key: "info", label: "信息表（所在地、方向等）", type: "list", item: infoItem, add: "添加一行" },
    { key: "images", label: "照片墙", type: "list", item: imageItem, add: "添加图片" }
  ];
  var CV_FIELDS = [
    I("title", "简历标题"),
    I("subtitle", "简历副标题"),
    I("bannerTitle", "透出照片处的大字"),
    { key: "bannerImage", label: "透出处换一张图（可选）", type: "image", hint: "不填就透出第 0 层背景照片" }
  ];
  function sectionFields(id) {
    var f = [
      I("title", "页面标题"),
      I("navTitle", "导航栏短标题"),
      I("summary", "主页卡片上的简介"),
      I("intro", "页面顶部的简介"),
      { key: "heroImage", label: "页面顶部照片（可选）", type: "image", hint: "不填就用全站背景照片" }
    ];
    if (id === "projects") f.push({ key: "github", label: "我的 GitHub 主页", type: "str", placeholder: "https://github.com/yourname", hint: "页面底部会显示「在 GitHub 上查看全部项目」按钮" });
    return f;
  }
  function entryFields(id) {
    var f = [I("time", "时间", { hint: "例如 2021.09 – 2025.06；英文写法一样时只填中文那栏即可" }), I("title", "标题")];
    if (id === "publications") {
      f.push(I("authors", "作者", { hint: "用 <b>你的名字</b> 把自己加粗" }), I("venue", "期刊 / 会议"));
    } else {
      f.push(I("org", id === "projects" ? "项目类型 / 所属" : "学校 / 公司 / 机构"), I("location", "地点"));
    }
    f.push({ key: "url", label: "点击标题打开的链接（可选）", type: "str", placeholder: "https://" });
    if (id === "projects") f.push({ key: "github", label: "GitHub 仓库地址", type: "str", placeholder: "https://github.com/yourname/项目名" });
    f.push({
      key: "logo",
      label: id === "education" ? "右侧校徽" : id === "experience" ? "右侧公司标志" : "右侧图片",
      type: "image",
      hint: "透明背景的 PNG 或 SVG 最好看"
    });
    f.push({ key: "text", label: "段落", type: "list", item: I(null, "", { multiline: true }), add: "添加段落", hint: HTML_HINT });
    f.push({ key: "bullets", label: "要点", type: "list", item: I(null, ""), add: "添加要点" });
    if (id === "education") {
      f.push(I("courses", "课程列表", { multiline: true, rows: 8, hint: "每行一门课；成绩写在 | 后面，例如：AP 微积分 BC | 5/5（没有成绩就只写课名）。想按年级分栏，就单独写一行 # 大一、# 大二，下面跟着这一年的课" }));
      f.push(I("coursesTitle", "课程列表标题（可选）", { hint: "不填就显示「课程 / Courses」，也可以写「主修课程」等" }));
    }
    f.push({ key: "images", label: "图片", type: "list", item: imageItem, add: "添加图片" });
    f.push({ key: "links", label: "按钮链接（PDF、代码、演示等）", type: "list", item: linkItem, add: "添加链接" });
    return f;
  }

  function specFor(path) {
    var kind = kindOf(path), ks = path.split(".");
    if (kind === "site") return { title: "网站信息", fields: SITE_FIELDS, target: site };
    if (kind === "about") return { title: "关于我", fields: ABOUT_FIELDS, target: site.about || (site.about = {}) };
    if (kind === "cv") return { title: "简历入口", fields: CV_FIELDS, target: site.cv || (site.cv = {}) };
    if (kind === "contacts") {
      return { title: "联系方式", target: site, fields: [{ key: "contacts", label: "", type: "list", item: contactItem, add: "添加联系方式" }] };
    }
    if (kind === "section") return { title: SECTION_NAMES[ks[1]] || "简历部分", fields: sectionFields(ks[1]), target: getPath(path) };
    if (kind === "group") return { title: "分组", fields: [I("title", "分组标题", { hint: "不需要分组标题就全部留空" })], target: getPath(path) };
    if (kind === "entry") return { title: "编辑条目 · " + (SECTION_NAMES[ks[1]] || ""), fields: entryFields(ks[1]), target: getPath(path) };
    return null;
  }

  /* ---------- 编辑抽屉 ---------- */
  var drawer, drawerTitle, drawerBody, drawerApply, drawerIntro, onApply = null;
  function buildDrawer() {
    drawer = h("div", "adm-drawer");
    drawer.hidden = true;
    var backdrop = h("div", "adm-backdrop");
    var panel = h("aside", "adm-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "adm-title");
    var head = h("header", "adm-head");
    drawerTitle = h("h2", null);
    drawerTitle.id = "adm-title";
    var close = button("×", "adm-x", { "aria-label": "关闭" });
    head.appendChild(drawerTitle);
    head.appendChild(close);
    drawerIntro = h("div", "adm-intro");
    drawerBody = h("div", "adm-body");
    var foot = h("footer", "adm-foot");
    var cancel = button("取消", "adm-btn");
    drawerApply = button("应用修改", "adm-btn adm-primary");
    foot.appendChild(cancel);
    foot.appendChild(drawerApply);
    panel.appendChild(head);
    panel.appendChild(drawerBody);
    panel.appendChild(foot);
    drawer.appendChild(backdrop);
    drawer.appendChild(panel);
    document.body.appendChild(drawer);
    [backdrop, close, cancel].forEach(function (el) { el.addEventListener("click", closeDrawer); });
    drawerApply.addEventListener("click", function () {
      if (onApply) onApply();
      closeDrawer();
    });
  }
  function closeDrawer() {
    drawer.hidden = true;
    document.documentElement.classList.remove("adm-locked");
    onApply = null;
  }
  function openForm(title, fields, values, apply, introHTML, applyLabel) {
    drawerTitle.textContent = title;
    drawerBody.innerHTML = "";
    drawerIntro.innerHTML = introHTML || "";
    if (introHTML) drawerBody.appendChild(drawerIntro);
    var eds = fields.map(function (f) {
      var e = fieldEditor(f, values[f.key]);
      drawerBody.appendChild(e.el);
      return { f: f, e: e };
    });
    drawerApply.textContent = applyLabel || "应用修改";
    onApply = function () {
      var out = {};
      eds.forEach(function (x) { out[x.f.key] = x.e.get(); });
      apply(out);
    };
    drawer.hidden = false;
    document.documentElement.classList.add("adm-locked");
    drawerBody.scrollTop = 0;
    var first = drawerBody.querySelector("input, textarea, select");
    if (first) first.focus();
  }
  function openEditor(path) {
    var spec = specFor(path);
    if (!spec || !spec.target) return;
    openForm(spec.title, spec.fields, spec.target, function (out) {
      Object.keys(out).forEach(function (k) {
        if (out[k] === undefined) delete spec.target[k]; else spec.target[k] = out[k];
      });
      commit();
    });
  }

  /* ---------- GitHub ---------- */
  function ghConfig() {
    var c = parse(load(GH) || "") || {};
    return c.owner && c.repo && c.token ? c : null;
  }
  function openGitHubSettings(then) {
    var c = parse(load(GH) || "") || {};
    if (!c.owner && /\.github\.io$/i.test(location.hostname)) {
      c.owner = location.hostname.split(".")[0];
      var seg = location.pathname.split("/")[1];
      c.repo = seg && !/\.html?$/i.test(seg) ? seg : location.hostname;
    }
    openForm("GitHub 设置", [
      { key: "owner", label: "GitHub 用户名", type: "str" },
      { key: "repo", label: "网站所在的仓库名", type: "str", hint: "例如 yourname.github.io" },
      { key: "branch", label: "分支", type: "str", placeholder: "main" },
      { key: "dir", label: "网站在仓库里的文件夹", type: "str", hint: "网站文件就在仓库根目录就留空；在 docs 文件夹里就填 docs" },
      { key: "token", label: "访问令牌（Fine-grained token）", type: "str", secret: true }
    ], c, function (out) {
      var cfg = {
        owner: out.owner || "", repo: out.repo || "", branch: out.branch || "main",
        dir: (out.dir || "").replace(/^\/+|\/+$/g, ""), token: out.token || ""
      };
      store(GH, JSON.stringify(cfg));
      updateStatus(ghConfig() ? "GitHub 设置已保存" : "GitHub 设置还不完整", ghConfig() ? "ok" : "warn");
      if (then && ghConfig()) then();
    },
    "<p>保存时，网页会用这个令牌把修改直接提交到你的 GitHub 仓库。令牌只保存在这台电脑的浏览器里，不会出现在网站上。</p>" +
    "<ol><li>打开 GitHub → 右上角头像 → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token</li>" +
    "<li>Repository access 选 <b>Only select repositories</b>，只选网站仓库</li>" +
    "<li>Permissions → Repository permissions → <b>Contents</b> 选 <b>Read and write</b></li>" +
    "<li>生成后复制令牌，粘贴到下面</li></ol>",
    "保存设置");
  }

  function b64utf8(s) {
    var bytes = new TextEncoder().encode(s), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function ghUrl(cfg, path) {
    var full = (cfg.dir ? cfg.dir + "/" : "") + path;
    return "https://api.github.com/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) +
      "/contents/" + full.split("/").map(encodeURIComponent).join("/");
  }
  function ghHeaders(cfg) {
    return { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" };
  }
  function ghError(r) {
    if (r.status === 401) return "令牌无效或已过期，请在「GitHub 设置」里重新填写";
    if (r.status === 403 || r.status === 404) return "没有权限或找不到仓库，请检查用户名、仓库名和令牌权限（Contents: Read and write）";
    if (r.status === 409 || r.status === 422) return "文件冲突，请刷新页面后再保存一次";
    return "GitHub 返回错误 " + r.status;
  }
  function ghSha(cfg, path) {
    return fetch(ghUrl(cfg, path) + "?ref=" + encodeURIComponent(cfg.branch), { headers: ghHeaders(cfg), cache: "no-store" })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(ghError(r));
        return r.json().then(function (j) { return j.sha; });
      });
  }
  function ghPut(cfg, path, b64, message) {
    return ghSha(cfg, path).then(function (sha) {
      var body = { message: message, content: b64, branch: cfg.branch };
      if (sha) body.sha = sha;
      return fetch(ghUrl(cfg, path), { method: "PUT", headers: ghHeaders(cfg), body: JSON.stringify(body) });
    }).then(function (r) {
      if (!r.ok) throw new Error(ghError(r));
    });
  }

  // 把草稿里上传的图片（data URL）换成文件路径
  function extractUploads(data) {
    var uploads = [], seen = {}, stamp = Date.now().toString(36);
    (function walk(o) {
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (typeof v === "string" && /^data:image\//.test(v)) {
          if (!seen[v]) {
            var m = /^data:image\/([\w+.-]+);base64,(.*)$/.exec(v);
            if (!m) return;
            var ext = m[1] === "jpeg" ? "jpg" : m[1] === "svg+xml" ? "svg" : m[1];
            seen[v] = "images/uploads/" + stamp + "-" + (uploads.length + 1) + "." + ext;
            uploads.push({ path: seen[v], b64: m[2] });
          }
          o[k] = seen[v];
        } else if (v && typeof v === "object") walk(v);
      });
    })(data);
    return uploads;
  }

  function serialize(data) {
    return "/* 网站内容。由管理模式自动生成，也可以直接手动编辑（说明见 README.md）。 */\n" +
      "window.SITE = " + JSON.stringify(data, null, 2) + ";\n";
  }

  var saving = false;
  function saveToGitHub() {
    if (saving) return;
    var cfg = ghConfig();
    if (!cfg) { openGitHubSettings(saveToGitHub); return; }
    saving = true;
    var data = clone(site);
    var uploads = extractUploads(data);
    var step = Promise.resolve();
    uploads.forEach(function (u, i) {
      step = step.then(function () {
        updateStatus("正在上传图片 " + (i + 1) + " / " + uploads.length + "…", "busy");
        return ghPut(cfg, u.path, u.b64, "Upload image " + u.path);
      });
    });
    step.then(function () {
      updateStatus("正在保存内容…", "busy");
      return ghPut(cfg, "content.js", b64utf8(serialize(data)), "Update site content");
    }).then(function () {
      Object.keys(site).forEach(function (k) { delete site[k]; });
      Object.keys(data).forEach(function (k) { site[k] = data[k]; });
      store(SAVED, JSON.stringify(site));
      saveDraft();
      rerender();
    }).catch(function (e) {
      var msg = e && e.message ? e.message : String(e);
      if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) msg = "连不上 GitHub，请检查网络";
      updateStatus("保存失败：" + msg, "bad");
    }).then(function () { saving = false; });
  }

  function downloadContent() {
    try {
      var blob = new Blob([serialize(site)], { type: "text/javascript" });
      var a = h("a");
      a.href = URL.createObjectURL(blob);
      a.download = "content.js";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      updateStatus("已下载 content.js，用它替换网站文件夹里的同名文件即可", "ok");
    } catch (e) {
      updateStatus("这个环境不允许下载文件", "bad");
    }
  }

  /* ---------- 底部管理栏 ---------- */
  var armed = {};
  function twoStep(el, key, label, run) {
    if (armed[key]) { clearTimeout(armed[key]); armed[key] = null; run(); return; }
    var old = el.textContent;
    el.textContent = label;
    el.classList.add("adm-armed");
    armed[key] = setTimeout(function () {
      armed[key] = null;
      el.textContent = old;
      el.classList.remove("adm-armed");
    }, 3000);
  }

  function buildBar() {
    var bar = h("div", "adm-bar");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "管理模式");
    bar.innerHTML =
      '<span class="adm-badge">管理模式</span>' +
      '<span id="adm-status" class="adm-status"></span>' +
      '<div class="adm-actions">' +
        '<button type="button" class="adm-btn" data-bar="site">网站信息</button>' +
        '<button type="button" class="adm-btn" data-bar="contacts">联系方式</button>' +
        '<button type="button" class="adm-btn" data-bar="github">GitHub 设置</button>' +
        '<button type="button" class="adm-btn" data-bar="download">下载 content.js</button>' +
        '<button type="button" class="adm-btn" data-bar="discard">放弃修改</button>' +
        '<button type="button" class="adm-btn" data-bar="exit">退出管理</button>' +
        '<button type="button" class="adm-btn adm-primary" data-bar="save">保存到网站</button>' +
      "</div>";
    document.body.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-bar]");
      if (!b) return;
      var a = b.getAttribute("data-bar");
      if (a === "site" || a === "contacts") openEditor(a);
      else if (a === "github") openGitHubSettings();
      else if (a === "save") saveToGitHub();
      else if (a === "download") downloadContent();
      else if (a === "discard") twoStep(b, "discard", "确定放弃？", function () {
        store(DRAFT, null);
        store(SAVED, null);
        location.reload();
      });
      else if (a === "exit") {
        store(FLAG, null);
        location.href = location.pathname;
      }
    });
    updateStatus();
  }

  /* ---------- 给页面上的模块加编辑按钮 ---------- */
  function decorate() {
    var app = document.getElementById("app");
    if (!app || app.querySelector(".adm-tools")) return;
    app.querySelectorAll("[data-edit]").forEach(function (el) {
      var path = el.getAttribute("data-edit");
      var kind = kindOf(path);
      var tools = h("div", "adm-tools" + (kind === "group" ? " adm-tools--row" : ""));
      tools.setAttribute("data-path", path);
      if (kind === "group") tools.appendChild(h("span", "adm-tools-label", "分组"));
      tools.appendChild(button("编辑", "adm-tool", { "data-act": "edit" }));
      if (kind === "entry" || kind === "group") {
        tools.appendChild(button("↑", "adm-tool", { "data-act": "up", "aria-label": "上移" }));
        tools.appendChild(button("↓", "adm-tool", { "data-act": "down", "aria-label": "下移" }));
        tools.appendChild(button("删除", "adm-tool adm-danger", { "data-act": "del" }));
      }
      if (kind === "group") el.insertBefore(tools, el.firstChild); else el.appendChild(tools);
      if (kind === "group") {
        var add = button("+ 在这个分组里新增条目", "adm-add", { "data-act": "add-entry", "data-path": path });
        el.appendChild(add);
      }
    });
    var page = window.SiteApp && window.SiteApp.page;
    if (page && page !== "home") {
      var pager = app.querySelector(".pager");
      var addGroup = button("+ 新增分组", "adm-add adm-add--group", { "data-act": "add-group", "data-path": "sections." + page });
      if (pager) pager.parentNode.insertBefore(addGroup, pager);
    }
    updateStatus();
  }
  window.SiteAdminHook = decorate;

  function moveIn(path, delta) {
    var p = parentOf(path), j = p.index + delta;
    if (!Array.isArray(p.arr) || j < 0 || j >= p.arr.length) return;
    var x = p.arr.splice(p.index, 1)[0];
    p.arr.splice(j, 0, x);
    commit();
  }

  // 用捕获阶段抢在主脚本之前处理，避免点按钮时跳转页面或打开大图
  document.addEventListener("click", function (e) {
    var b = e.target.closest("#app [data-act]");
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var act = b.getAttribute("data-act");
    var path = b.getAttribute("data-path") || b.parentNode.getAttribute("data-path");
    if (act === "edit") openEditor(path);
    else if (act === "up") moveIn(path, -1);
    else if (act === "down") moveIn(path, 1);
    else if (act === "del") twoStep(b, path, "确定删除？", function () {
      var p = parentOf(path);
      p.arr.splice(p.index, 1);
      commit();
    });
    else if (act === "add-entry") {
      var g = getPath(path);
      g.items = Array.isArray(g.items) ? g.items : [];
      g.items.push({ time: "", title: { zh: "新条目", en: "New entry" } });
      commit();
      openEditor(path + ".items." + (g.items.length - 1));
    } else if (act === "add-group") {
      var s = getPath(path);
      s.groups = Array.isArray(s.groups) ? s.groups : [];
      s.groups.push({ title: { zh: "新分组", en: "New group" }, items: [] });
      commit();
      openEditor(path + ".groups." + (s.groups.length - 1));
    }
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer && !drawer.hidden) closeDrawer();
  });

  function boot() {
    buildDrawer();
    buildBar();
    if (document.getElementById("app") && window.SiteApp) decorate();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
