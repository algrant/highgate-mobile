// Highgate Passing Patterns: a small reader for The New Highgate Collection's patterns on a phone.
// Data from passing-pattern-parser (extract/site_export.py): data/index.json, data/p/<id>.json.
// Drawings: causal diagrams by lib/events.js (eventsSvg), position frames as redrawn SVG, walking patterns animated
// by lib/moving.js (mvPlayer).
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
let INDEX = null, FLAT = [], player = null;
const filters = {moving: false, j: null, ss: false};
const cache = {};

async function loadIndex() {
  if (INDEX) return INDEX;
  INDEX = await (await fetch("data/index.json", {cache: "no-cache"})).json();   // revalidated: it names the version
  FLAT = INDEX.chapters.flatMap(c => c.patterns.map(p => ({...p, chapter: c.title})));
  return INDEX;
}
async function loadPattern(id) {
  if (!cache[id]) cache[id] = await (await fetch(`data/p/${encodeURIComponent(id)}.json?v=${INDEX.meta.version || ""}`)).json();
  return cache[id];
}

const jLabel = j => j ? `${j} jugglers` : "";
function passes(p) {
  if (filters.moving && !p.m) return false;
  if (filters.ss && !p.ss) return false;
  if (filters.j === 4 ? !(p.j >= 4) : filters.j && p.j !== filters.j) return false;
  return true;
}
function row(p) {
  const meta = [p.j ? `${p.j}p` : "", p.o ? `${p.o} clubs` : "", p.label ? `p${p.label}` : ""].filter(Boolean).join(" · ");
  return `<li><a href="#/p/${esc(p.id)}"><span class="nm">${esc(p.name)}</span>${p.m ? '<span class="badge mv">moving</span>' : p.a ? '<span class="badge">animated</span>' : ""}${p.k !== "pattern" ? `<span class="badge">${esc(p.k)}</span>` : ""}<span class="meta">${esc(meta)}</span></a></li>`;
}
function filterBar() {
  const c = (on, lab, act) => `<button class="chip${on ? " on" : ""}" data-act="${act}">${lab}</button>`;
  return `<div class="filters">${c(filters.moving, "Moving", "moving")}${c(filters.ss, "Siteswap", "ss")}${c(filters.j === 2, "2 jugglers", "j2")}${c(filters.j === 3, "3", "j3")}${c(filters.j === 4, "4+", "j4")}</div>`;
}
function wireFilters(redraw) {
  document.querySelectorAll(".filters .chip").forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === "moving") filters.moving = !filters.moving;
    else if (a === "ss") filters.ss = !filters.ss;
    else { const j = +a.slice(1); filters.j = filters.j === j ? null : j; }
    redraw();
  });
}

async function home() {
  await loadIndex();
  const q = $("#q").value.trim().toLowerCase();
  const any = q || filters.moving || filters.ss || filters.j;
  let html = filterBar();
  if (any) {
    const hits = FLAT.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.ss || "").toLowerCase().includes(q)) && passes(p));
    html += `<div class="results">${hits.length ? `<ul class="pats">${hits.slice(0, 300).map(row).join("")}</ul>` : '<div class="empty">No patterns match.</div>'}</div>`;
  } else {
    html += `<a class="bookcard" href="#/p/front"><b>${esc(INDEX.meta.title)}</b><span>by ${esc(INDEX.meta.author)} · the book's introduction and dedication →</span></a>`;
    html += INDEX.chapters.map((c, i) => `<details class="chap"${i === 0 ? "" : ""}><summary><span>${esc(c.title)}</span><span class="n">${c.patterns.length}</span></summary><ul class="pats">${c.patterns.map(row).join("")}</ul></details>`).join("");
    html += `<p class="cap">Every pattern of ${esc(INDEX.meta.title)} by ${esc(INDEX.meta.author)}, in the book's words and order, with its drawings (redrawn, and the originals), ${INDEX.meta.moving} walking patterns animated and ${(INDEX.meta.animated || 0) - INDEX.meta.moving} standing ones. <a href="${esc(INDEX.meta.pdf)}" target="_blank" rel="noopener">The book's PDF ↗</a> (a copy of <a href="${esc(INDEX.meta.pdf_original || INDEX.meta.pdf)}" target="_blank" rel="noopener">the original</a>)</p>`;
  }
  $("#main").innerHTML = html;
  wireFilters(home);
}

function causalHtml(reading) {
  const s = eventsSvg(reading);
  return s.replace(/<svg([^>]*?)class="[^"]*"/, "<svg$1");
}
function fitKids(box, d) {
  box.querySelectorAll(".kid").forEach(div => {
    const k = d.kids[+div.dataset.i];
    div.innerHTML = eventsSvg(k.reading);
    const svg = div.querySelector("svg"); if (!svg) return;
    svg.removeAttribute("class"); svg.style.cssText = "display:block;width:100%;height:100%;background:transparent";
    const cw = k.crop && k.crop[0], ch = k.crop && k.crop[1];
    if (svg.dataset.sc && cw && ch) { const sc = +svg.dataset.sc; svg.setAttribute("viewBox", `${svg.dataset.bx} ${svg.dataset.by} ${cw * sc} ${ch * sc}`); svg.setAttribute("preserveAspectRatio", "none"); }
    else { const bb = svg.getBBox(); svg.setAttribute("viewBox", `${bb.x - 2} ${bb.y - 2} ${bb.width + 4} ${bb.height + 4}`); }
  });
}
// a drawing: ours (redrawn) and the book's own, cropped from the PDF, one tap apart
function drawingHtml(d, i) {
  let ours = "";
  if (d.kind === "causal diagram") ours = `<div class="paper wide">${causalHtml(d.reading)}</div>`;
  else if (d.svg) {
    const kids = (d.kids || []).map((k, j) => `<div class="kid" data-i="${j}" style="left:${k.box[0] * 100}%;top:${k.box[1] * 100}%;width:${k.box[2] * 100}%;height:${k.box[3] * 100}%"></div>`).join("");
    ours = `<div class="paper"><div class="drawbox" data-d="${i}" style="padding-top:${d.size[1] / d.size[0] * 100}%">${d.svg}${kids}</div></div>`;
  }
  const orig = d.orig ? `<div class="paper orig"><img src="${esc(d.orig)}" alt="The book's drawing" loading="lazy"></div>` : "";
  const showOrig = !ours || ORIG;
  const tog = ours && orig ? `<div class="tog"><button class="chip${showOrig ? "" : " on"}" data-v="ours">Redrawn</button><button class="chip${showOrig ? " on" : ""}" data-v="orig">Original</button></div>` : "";
  const both = ours && orig ? ` has-both ${d.kind === "causal diagram" ? "stack" : "pair"}` : "";
  return `<figure class="draw${showOrig ? " show-orig" : ""}${both}">${tog}<div class="v-ours"><div class="vlab">Redrawn</div>${ours}</div><div class="v-orig"><div class="vlab">The book's drawing</div>${orig}</div><figcaption class="cap">${esc(d.kind === "drawing" ? "the book's drawing" : d.kind)} · ${esc(d.file)}${d.star ? ` · corrected<sup class="star">*</sup>` : ""}</figcaption></figure>`;
}
let ORIG = (() => { try { return localStorage.getItem("hg-orig") === "1"; } catch (e) { return false; } })();
function wireToggles() {
  document.querySelectorAll("figure.draw .tog .chip").forEach(b => b.onclick = () => {
    ORIG = b.dataset.v === "orig";
    try { localStorage.setItem("hg-orig", ORIG ? "1" : "0"); } catch (e) {}
    document.querySelectorAll("figure.draw").forEach(f => {
      if (!f.querySelector(".tog")) return;
      f.classList.toggle("show-orig", ORIG);
      f.querySelectorAll(".tog .chip").forEach(x => x.classList.toggle("on", (x.dataset.v === "orig") === ORIG));
    });
  });
}
// the pattern's siteswap at the top: the book's own (a global siteswap before a préchac), else ours from its drawing
function topSiteswap(p) {
  const NAME = {"hg-siteswap": "siteswap", "prechac": "préchac", "hg-siteswap-in-title": "siteswap", "hg-siteswap-in-text": "siteswap"};
  const rank = t => ["hg-siteswap", "prechac", "hg-siteswap-in-title", "hg-siteswap-in-text"].indexOf(t);
  const st = (p.notations || []).filter(n => rank(n.type) >= 0).sort((a, b) => rank(a.type) - rank(b.type))[0];
  const d = p.derived;
  let lab, val, how;
  if (st) { lab = NAME[st.type]; val = st.value; how = "the book's"; }
  else if (d && d.sync) { lab = "sync siteswap"; val = Object.entries(d.sync.per_juggler).map(([j, v]) => `${j}: ${v}`).join("  ·  "); how = "from the drawing"; }
  else if (d && (d.global || d.value)) {
    const k = d.kind || "";
    lab = d.global && /global|local/.test(k) ? "siteswap" : /prechac/.test(k) ? "préchac" : "siteswap";
    val = /local/.test(k) && d.global ? d.global : (d.value || d.global); how = "from the drawing";
  }
  else if (d && d.per_juggler) { lab = "per juggler"; val = Object.entries(d.per_juggler).map(([j, v]) => `${j}: ${v}`).join("  ·  "); how = "from the drawing"; }
  if (!val) return "";
  const parts = val.split("  ·  ");
  return parts.length > 1
    ? `<div class="topss"><span class="lab">${esc(lab)}</span> <span class="how">${esc(how)}</span><div class="parts">${parts.map(x => `<code>${esc(x)}</code>`).join("")}</div></div>`
    : `<div class="topss"><span class="lab">${esc(lab)}</span> <code>${esc(val)}</code> <span class="how">${esc(how)}</span></div>`;
}
// the book's words, block by block, the drawings in place
// the "Pattern for ..." lines as a table: a row per juggler, a column per beat, the passes coloured by who catches
// them (the animation's colours); the book's lines a tap away
const PATLINE = /^(Start for|Starting pattern for|Pattern for|After \w+ walks)/;
let TABLE = (() => { try { return localStorage.getItem("hg-words") !== "1"; } catch (e) { return true; } })();
function cellHtml(c) {
  // (a beat with both hands throwing: its throws stacked, right over left)
  if (c.k === "b") {
    const R = c.items.find(i => i.hand === "R"), L = c.items.find(i => i.hand === "L"), rest = c.items.filter(i => !i.hand);
    const slot = i => i ? cellHtml(i) : `<span class="pt-c none"></span>`;
    return `<span class="pt-c b">${rest.length ? c.items.map(cellHtml).join("") : slot(R) + slot(L)}</span>`;
  }
  const sup = c.sp === 2 ? "²" : c.sp === 3 ? "³" : c.sp === 0 ? " zap" : "";
  const tip = c.k === "p" ? `${c.d ? "drop-back" : c.sp === 2 ? "double pass" : c.sp === 3 ? "triple pass" : "pass"} to ${c.w}${c.x ? ", crossing" : ""}${c.h ? ", hurried" : ""}` : `${c.h ? "hurried " : ""}${c.w}`;
  const txt = c.k === "p" ? `${c.d ? "↩" : ""}${esc(c.w)}${sup}${c.x ? "✕" : ""}` : esc(c.w);
  const hand = c.hand ? `<i class="hd">${c.hand}</i>` : "";
  return `<span class="pt-c ${c.k === "p" ? "p" : "s"}${c.to ? " to-" + c.to : ""}${c.h ? " h" : ""}" title="${esc((c.hand ? (c.hand === "R" ? "right hand: " : "left hand: ") : "") + tip)}">${hand}${txt}${c.k === "s" && c.x ? "✕" : ""}</span>`;
}
// the clubs each juggler starts with: a dot a club in each hand, the hands' letters, the name under them
function startHtml(st) {
  if (!st || !st.length) return "";
  const dots = n => n == null ? "?" : n ? "●".repeat(n) : "–";
  return `<div class="pt-start"><div class="pt-stage">Start</div><div class="ps-grid">${st.map(x =>
    `<div class="ps-j"><div class="ps-hands"><span class="ps-h"><span class="ps-dots">${dots(x.L)}</span><span class="ps-lr">L</span></span><span class="ps-h"><span class="ps-dots">${dots(x.R)}</span><span class="ps-lr">R</span></span></div>` +
    `<div class="ps-name j-${esc(x.j)}">${esc(x.who)}</div>${x.offset ? `<div class="ps-off">${esc(x.offset === 0.5 ? "½" : String(x.offset))} beat${x.offset > 1 ? "s" : ""} after ${esc(x.after || "")}</div>` : ""}</div>`).join("")}</div></div>`;
}
function tableHtml(t) {
  return startHtml(t.start) + (t.stages || []).map(st => `${st.title ? `<div class="pt-stage">${esc(st.title)}</div>` : ""}<div class="pt-grid">${st.rows.map(r =>
    `<div class="pt-row" style="--off:${r.off}"><span class="pt-who j-${esc(r.j)}">${esc(r.who)}</span><span class="pt-cells">${r.cells.map(cellHtml).join("")}</span></div>`).join("")}</div>`).join("");
}
function wireTables() {
  document.querySelectorAll(".pt .tog .chip").forEach(b => b.onclick = () => {
    TABLE = b.dataset.v === "table";
    try { localStorage.setItem("hg-words", TABLE ? "0" : "1"); } catch (e) {}
    document.querySelectorAll(".pt").forEach(f => {
      f.classList.toggle("show-words", !TABLE);
      f.querySelectorAll(".tog .chip").forEach(x => x.classList.toggle("on", (x.dataset.v === "table") === TABLE));
    });
  });
}
function bodyHtml(p) {
  let out = "", list = false, tabled = false;
  const body = p.body || [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c.t !== "li" && list) { out += "</ul>"; list = false; }
    const plain = h => (h || "").replace(/<[^>]*>/g, "").trim();
    if (c.t === "l" && p.table && !tabled && PATLINE.test(plain(c.h))) {
      // the run of pattern lines (and the stage lines between them)
      let j = i, words = "";
      while (j < body.length && body[j].t === "l" && PATLINE.test(plain(body[j].h))) { words += `<p class="lab">${body[j].h}</p>`; j++; }
      out += `<div class="pt${TABLE ? "" : " show-words"}"><div class="tog"><button class="chip${TABLE ? " on" : ""}" data-v="table">Table</button><button class="chip${TABLE ? "" : " on"}" data-v="words">The book's words</button></div>` +
             `<div class="pt-table">${tableHtml(p.table)}${(p.table.stages || []).length ? `<div class="cap">Read from the book's words: passes coloured by who catches them, ✕ crossing, ² double, ↩ drop-back, dotted: hurried${p.table.sync ? ", R / L: the hand; stacked: both hands at once" : ""}.</div>` : ""}</div><div class="pt-words">${words}</div></div>`;
      tabled = true;
      i = j - 1;
      continue;
    }
    if (c.t === "p") out += `<p>${c.h}</p>`;
    else if (c.t === "h") out += `<h3>${c.h}</h3>`;
    else if (c.t === "l") out += `<p class="lab">${c.h}</p>`;
    else if (c.t === "hr") out += "<hr>";
    else if (c.t === "table") out += `<div class="booktable-wrap"><table class="booktable">${c.rows.map((r, k) => `<tr>${r.map(h => k === 0 && c.head ? `<th>${h}</th>` : `<td>${h}</td>`).join("")}</tr>`).join("")}</table></div>`;
    else if (c.t === "li") { if (!list) { out += "<ul>"; list = true; } out += `<li>${c.h}</li>`; }
    else if (c.t === "d") out += drawingHtml(p.drawings[c.i], c.i);
  }
  if (list) out += "</ul>";
  return out;
}

async function pattern(id) {
  await loadIndex();
  const p = await loadPattern(id);
  const k = FLAT.findIndex(x => x.id === id), prev = k >= 0 ? FLAT[k - 1] : null, next = k >= 0 ? FLAT[k + 1] : FLAT[0];
  const models = [...(p.moving || []).map(m => ({m, lab: `Highgate${p.moving.length > 1 ? " " + m.where : ""}`})),
                  ...(p.also_moving || []).map(m => ({m, lab: "Modern Club Passing"}))];
  const meta = [p.chapter, p.label ? `book page ${p.label}` : "", jLabel(p.jugglers), p.objects ? `${p.objects} clubs` : "", p.timing || ""].filter(Boolean).join(" · ");
  const notes = (p.notations || []).map(n => `<dt>${esc({"hg-siteswap": "siteswap", "prechac": "préchac", "hg-siteswap-in-title": "siteswap (title)", "hg-siteswap-in-text": "siteswap (text)"}[n.type] || n.type)}</dt><dd>${esc(n.value)}</dd>`).join("");
  const sy = p.derived && p.derived.sync;
  const syncHtml = sy ? `<dt>synchronous, every beat both hands (idle hand holds a 2)</dt>${Object.entries(sy.per_juggler).map(([j, v]) => `<dd>${esc(j)}: ${esc(v)}</dd>`).join("")}` +
    (sy.drawn ? `<dt>as drawn (the drawing throws something once, e.g. a trick)</dt>${Object.entries(sy.drawn).map(([j, v]) => `<dd>${esc(j)}: ${esc(v)}</dd>`).join("")}` : "") : "";
  const der = (p.derived && p.derived.value && !(p.notations || []).some(n => n.value === p.derived.value)
    ? `<dt>derived from the drawing (${esc(p.derived.kind || "")}${p.derived.confidence ? ", " + esc(p.derived.confidence) + " confidence" : ""})</dt><dd>${esc(p.derived.value)}</dd>` : "") + syncHtml;
  const src = `From <i>${esc(INDEX.meta.title)}</i> by ${esc(INDEX.meta.author)}${p.label ? `, page ${esc(p.label)}` : ""}`;
  let side = `${topSiteswap(p)}
    ${p.passist || p.passist_fork || notesOn() ? `<div class="links">${p.passist ? `<a class="btn" href="${esc(p.passist)}" target="_blank" rel="noopener">Animate on passist${p.passist.includes("//alpha.") ? " (beta)" : ""} ↗</a>` : ""}${p.passist_fork ? `<a class="btn" href="${esc(p.passist_fork.url)}" target="_blank" rel="noopener">${p.passist_fork.kind === "feed" ? "Feed" : p.passist_fork.kind === "sync" ? "Sync" : "Layers"} on pass.algrant.ca ↗</a>` : ""}${noteButtonHtml()}</div>${p.passist_fork && p.passist_fork.kind === "feed" && p.passist_fork.names[0] !== "A" ? `<div class="cap">On pass.algrant.ca the feeder is juggler A (here ${esc(({A: "Anne", B: "Ben", C: "Clare"})[p.passist_fork.names[0]] || p.passist_fork.names[0])}).</div>` : ""}` : ""}`;
  const standing = models.length && models.every(x => x.m.static);
  if (models.length) side += `<div class="card"><h2>${standing ? "Passing (our model)" : "Walking (our model)"}</h2>${models.length > 1 ? `<div class="tabs">${models.map((x, i) => `<button class="chip${i === 0 ? " on" : ""}" data-m="${i}">${esc(x.lab)}</button>`).join("")}</div>` : ""}<div id="player"></div><div class="cap">${standing
    ? "Everyone where the book's dots beside the causal diagram put them, the passes from the causal diagram; tap ▶ to play."
    : "Modelled from the book's position frames and causal diagram; tap ▶ to play."}</div></div>`;
  let main = `<article class="text">${bodyHtml(p) || (p.drawings || []).map(drawingHtml).join("")}${(p.errata || []).length ? `<div class="errata"><h3>Corrections</h3>${p.errata.map(n => `<p><sup class="star">*</sup> ${esc(n)}</p>`).join("")}</div>` : ""}</article>`;
  // (what we derived: beside the words on a wide screen, after them on a phone)
  const derCard = der && (sy || !(p.body || []).some(c => c.t === "l" && (c.h || "").includes(p.derived.value)))
    ? `<dl class="notes">${der}</dl>` : "";
  if (derCard) side += `<div class="card only-wide"><h2>Derived from the drawing</h2>${derCard}</div>`;
  if (derCard) main += `<div class="card only-narrow"><h2>Derived from the drawing</h2>${derCard}</div>`;
  if ((p.related || []).length) main += `<div class="card"><h2>Mentioned</h2>${p.related.map(r => `<a class="btn" href="#/p/${esc(r.id)}">${esc(r.name)}</a>`).join(" ")}</div>`;
  main += `<div class="pager">${prev ? `<a class="btn" href="#/p/${esc(prev.id)}" id="prev">← ${esc(prev.name)}</a>` : "<span></span>"}${next ? `<a class="btn" href="#/p/${esc(next.id)}" id="next">${esc(next.name)} →</a>` : "<span></span>"}</div>`;
  // (one column on a phone, the panel first; on a wide screen the panel -- siteswap, links, walking -- stays in view
  // beside the book's words)
  $("#main").innerHTML = `<div class="pat"><div class="pat-head"><h1>${esc(p.name)}</h1><div class="sub">${esc(meta)}</div>
    <div class="source">${src} · <a href="${esc(p.pdf || INDEX.meta.pdf)}" target="_blank" rel="noopener" class="pdflink">view the original page ↗</a></div></div>
    <div class="pat-cols"><div class="pat-side">${side}</div><div class="pat-main">${main}</div></div></div>`;
  renderNav(id);
  const pl = document.querySelector(".pdflink");
  pl.onclick = e => { if (window.innerWidth >= 900) { e.preventDefault(); showPage(p.name, pl.href); } };
  window.scrollTo(0, 0);
  document.querySelectorAll(".drawbox").forEach(box => fitKids(box, p.drawings[+box.dataset.d]));
  wireToggles();
  wireTables();
  wireNote(p);
  if (models.length) {
    const start = i => { if (player) player.stop(); player = mvPlayer($("#player"), models[i].m); };
    start(0);
    document.querySelectorAll(".tabs .chip").forEach(b => b.onclick = () => {
      document.querySelectorAll(".tabs .chip").forEach(x => x.classList.toggle("on", x === b)); start(+b.dataset.m);
    });
  }
}

// the chapters beside the page on a wide screen (hidden on a phone), the pattern being read marked
let navBuilt = false;
function renderNav(current) {
  const nav = $("#nav");
  if (!INDEX || !nav) return;
  if (!navBuilt) {
    nav.innerHTML = `<a class="navhome" href="#/">All chapters</a>` + INDEX.chapters.map(c => `<details class="navchap"><summary>${esc(c.title)}</summary><ul>${c.patterns.map(x => `<li><a href="#/p/${esc(x.id)}" data-id="${esc(x.id)}">${esc(x.name)}</a></li>`).join("")}</ul></details>`).join("");
    navBuilt = true;
  }
  nav.querySelectorAll("a.on").forEach(a => a.classList.remove("on"));
  const a = current && nav.querySelector(`a[data-id="${CSS.escape(current)}"]`);
  if (a) {
    a.classList.add("on");
    a.closest("details").open = true;
    const r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
    if (r.top < n.top || r.bottom > n.bottom) a.scrollIntoView({block: "center"});
  }
}

// the book's page in a popover on a wide screen (the PDF at the pattern's heading)
function showPage(title, src) {
  let pop = $("#pagepop");
  if (!pop) {
    document.body.insertAdjacentHTML("beforeend", `<div id="pagepop"><div class="bar"><span></span><a href="#" id="pageopen" target="_blank" rel="noopener">open in a new tab ↗</a><button id="pageclose" class="btn">close ✕</button></div><iframe title="The book's page"></iframe></div>`);
    pop = $("#pagepop");
    $("#pageclose").onclick = () => pop.classList.remove("open");
  }
  pop.querySelector(".bar span").textContent = `${title}: the book's page`;
  $("#pageopen").href = src;
  const fr = pop.querySelector("iframe");
  if (fr.dataset.src !== src) { fr.src = src; fr.dataset.src = src; }
  pop.classList.add("open");
}

// keys: ← → previous / next pattern, / search, o redrawn or the book's drawings, Esc closes the page
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = /^(input|textarea|select)$/i.test((e.target.tagName || "")) || e.target.isContentEditable;
  if (e.key === "Escape") { const pop = $("#pagepop"); if (pop) pop.classList.remove("open"); if (typing) e.target.blur(); return; }
  if (typing) return;
  if (e.key === "/") { e.preventDefault(); $("#q").focus(); }
  else if (e.key === "ArrowLeft" && $("#prev")) location.hash = $("#prev").getAttribute("href");
  else if (e.key === "ArrowRight" && $("#next")) location.hash = $("#next").getAttribute("href");
  else if (e.key === "o") {
    const b = document.querySelector(`figure.draw .tog .chip[data-v="${ORIG ? "ours" : "orig"}"]`);
    if (b) b.click();
  }
});

async function about() {
  await loadIndex();
  const m = INDEX.meta;
  $("#main").innerHTML = `<div class="card about-page"><h2>About</h2>
    <p><b>${esc(m.title)}</b> was compiled by ${esc(m.author)}; this is a way to browse its patterns on a phone, a tablet or a computer. The book: <a href="${esc(m.pdf_original || m.pdf)}" target="_blank" rel="noopener">the original PDF</a> (this site keeps <a href="${esc(m.pdf)}" target="_blank" rel="noopener">a copy</a>, which its page links open, as the licence allows), <a href="${esc(m.author_site)}" target="_blank" rel="noopener">the author's site</a>. Its cover carries a Creative Commons BY-NC-SA badge (${esc(m.licence)}).</p>
    <p>This is a phone-friendly edition of the book: its words as written, in its order, chapter by chapter. Its drawings are redrawn from readings of the originals, and each can be switched to the book's own drawing; every page links to the same page of the original PDF. The walking animations are our models, built from the book's position frames and causal diagrams.</p>
    <p>Shared under the book's CC BY-NC-SA terms: non-commercial, with attribution.</p>
    <p>“Animate on passist” opens the pattern's siteswap on <a href="https://passist.org" target="_blank" rel="noopener">passist.org</a>, where one is known; patterns with no global siteswap open on its beta, <a href="https://alpha.passist.org" target="_blank" rel="noopener">alpha.passist.org</a>, as a symmetric siteswap (everyone throws the same sequence) or an extended one (each juggler's own sequence, passes to a numbered juggler). Only links that passist checks as valid are shown.</p>
    <p>“on pass.algrant.ca” opens the pattern on <a href="https://pass.algrant.ca" target="_blank" rel="noopener">pass.algrant.ca</a>, a fork of passist with layered siteswaps: feeds at four-handed tempo (the feeder on the beat, the feedees half a beat later, as the book draws them), synchronous patterns one hand per layer, and other half-beat staggered patterns.</p>
    <p class="note-when"><a href="#/notes">Notes</a></p></div>`;
}

async function route() {
  if (player) { player.stop(); player = null; }
  const h = location.hash.replace(/^#/, "");
  try {
    if (h.startsWith("/p/")) return await pattern(decodeURIComponent(h.slice(3)));
    if (h === "/about") return await about();
    if (h === "/notes") return await notesPage();
    await home();
    return renderNav(null);
  } catch (e) {
    $("#main").innerHTML = `<div class="card empty">Could not load: ${esc(e.message)}</div>`;
  }
}
let qTimer = null;
$("#q").addEventListener("input", () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => { if (!location.hash || location.hash === "#/") home(); else location.hash = "#/"; }, 150);
});
window.addEventListener("hashchange", route);
route();
