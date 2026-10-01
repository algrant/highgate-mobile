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
  INDEX = await (await fetch("data/index.json")).json();
  FLAT = INDEX.chapters.flatMap(c => c.patterns.map(p => ({...p, chapter: c.title})));
  return INDEX;
}
async function loadPattern(id) {
  if (!cache[id]) cache[id] = await (await fetch(`data/p/${encodeURIComponent(id)}.json`)).json();
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
  return `<li><a href="#/p/${esc(p.id)}"><span class="nm">${esc(p.name)}</span>${p.m ? '<span class="badge mv">moving</span>' : ""}${p.k !== "pattern" ? `<span class="badge">${esc(p.k)}</span>` : ""}<span class="meta">${esc(meta)}</span></a></li>`;
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
    html += `<p class="cap">Every pattern of ${esc(INDEX.meta.title)} by ${esc(INDEX.meta.author)}, in the book's words and order, with its drawings (redrawn, and the originals) and ${INDEX.meta.moving} walking patterns animated. <a href="${esc(INDEX.meta.pdf)}" target="_blank" rel="noopener">The original PDF ↗</a></p>`;
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
  return `<figure class="draw${showOrig ? " show-orig" : ""}">${tog}<div class="v-ours">${ours}</div><div class="v-orig">${orig}</div><figcaption class="cap">${showOrig ? "" : ""}${esc(d.kind === "drawing" ? "the book's drawing" : d.kind)} · ${esc(d.file)}</figcaption></figure>`;
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
// the book's words, block by block, the drawings in place
function bodyHtml(p) {
  let out = "", list = false;
  for (const c of p.body || []) {
    if (c.t !== "li" && list) { out += "</ul>"; list = false; }
    if (c.t === "p") out += `<p>${c.h}</p>`;
    else if (c.t === "h") out += `<h3>${c.h}</h3>`;
    else if (c.t === "l") out += `<p class="lab">${c.h}</p>`;
    else if (c.t === "hr") out += "<hr>";
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
  const der = p.derived && !(p.notations || []).some(n => n.value === p.derived.value)
    ? `<dt>derived from the drawing (${esc(p.derived.kind || "")}${p.derived.confidence ? ", " + esc(p.derived.confidence) + " confidence" : ""})</dt><dd>${esc(p.derived.value)}</dd>` : "";
  const src = `From <i>${esc(INDEX.meta.title)}</i> by ${esc(INDEX.meta.author)}${p.label ? `, page ${esc(p.label)}` : ""}`;
  let html = `<div class="pat"><h1>${esc(p.name)}</h1><div class="sub">${esc(meta)}</div>
    <div class="source">${src} · <a href="${esc(p.pdf || INDEX.meta.pdf)}" target="_blank" rel="noopener">view the original page ↗</a></div>
    ${p.passist ? `<div class="links"><a class="btn" href="${esc(p.passist)}" target="_blank" rel="noopener">Animate on passist${p.passist.includes("//alpha.") ? " (beta)" : ""} ↗</a></div>` : ""}`;
  if (models.length) html += `<div class="card"><h2>Walking (our model)</h2>${models.length > 1 ? `<div class="tabs">${models.map((x, i) => `<button class="chip${i === 0 ? " on" : ""}" data-m="${i}">${esc(x.lab)}</button>`).join("")}</div>` : ""}<div id="player"></div><div class="cap">Modelled from the book's position frames and causal diagram; tap ▶ to play.</div></div>`;
  html += `<article class="text">${bodyHtml(p) || (p.drawings || []).map(drawingHtml).join("")}</article>`;
  if (der && !(p.body || []).some(c => c.t === "l" && (c.h || "").includes(p.derived.value))) html += `<div class="card"><h2>Derived from the drawing</h2><dl class="notes">${der}</dl></div>`;
  if ((p.related || []).length) html += `<div class="card"><h2>Mentioned</h2>${p.related.map(r => `<a class="btn" href="#/p/${esc(r.id)}">${esc(r.name)}</a>`).join(" ")}</div>`;
  html += `<div class="pager">${prev ? `<a class="btn" href="#/p/${esc(prev.id)}">← ${esc(prev.name)}</a>` : "<span></span>"}${next ? `<a class="btn" href="#/p/${esc(next.id)}">${esc(next.name)} →</a>` : "<span></span>"}</div></div>`;
  $("#main").innerHTML = html;
  window.scrollTo(0, 0);
  document.querySelectorAll(".drawbox").forEach(box => fitKids(box, p.drawings[+box.dataset.d]));
  wireToggles();
  if (models.length) {
    const start = i => { if (player) player.stop(); player = mvPlayer($("#player"), models[i].m); };
    start(0);
    document.querySelectorAll(".tabs .chip").forEach(b => b.onclick = () => {
      document.querySelectorAll(".tabs .chip").forEach(x => x.classList.toggle("on", x === b)); start(+b.dataset.m);
    });
  }
}

async function about() {
  await loadIndex();
  const m = INDEX.meta;
  $("#main").innerHTML = `<div class="card about-page"><h2>About</h2>
    <p><b>${esc(m.title)}</b> was compiled by ${esc(m.author)}; this is a way to browse its patterns on a phone. The book: <a href="${esc(m.pdf)}" target="_blank" rel="noopener">PDF</a>, <a href="${esc(m.author_site)}" target="_blank" rel="noopener">the author's site</a>. Its cover carries a Creative Commons BY-NC-SA badge (${esc(m.licence)}).</p>
    <p>This is a phone-friendly edition of the book: its words as written, in its order, chapter by chapter. Its drawings are redrawn from readings of the originals, and each can be switched to the book's own drawing; every page links to the same page of the original PDF. The walking animations are our models, built from the book's position frames and causal diagrams.</p>
    <p>Shared under the book's CC BY-NC-SA terms: non-commercial, with attribution.</p>
    <p>“Animate on passist” opens the pattern's siteswap on <a href="https://passist.org" target="_blank" rel="noopener">passist.org</a>, where one is known; patterns with no global siteswap open on its beta, <a href="https://alpha.passist.org" target="_blank" rel="noopener">alpha.passist.org</a>, as a symmetric siteswap (everyone throws the same sequence) or an extended one (each juggler's own sequence, passes to a numbered juggler). Only links that passist checks as valid are shown.</p></div>`;
}

async function route() {
  if (player) { player.stop(); player = null; }
  const h = location.hash.replace(/^#/, "");
  try {
    if (h.startsWith("/p/")) return await pattern(decodeURIComponent(h.slice(3)));
    if (h === "/about") return await about();
    return await home();
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
