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
    html += INDEX.chapters.map((c, i) => `<details class="chap"${i === 0 ? "" : ""}><summary><span>${esc(c.title)}</span><span class="n">${c.patterns.length}</span></summary><ul class="pats">${c.patterns.map(row).join("")}</ul></details>`).join("");
    html += `<p class="cap">${INDEX.meta.patterns} sections from ${esc(INDEX.meta.title)} by ${esc(INDEX.meta.author)}; ${INDEX.meta.moving} with walking animations.</p>`;
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
function drawingHtml(d, i) {
  if (d.kind === "causal diagram")
    return `<div class="card"><h2>Causal diagram</h2><div class="paper wide">${causalHtml(d.reading)}</div><div class="cap">${esc(d.file)} · redrawn</div></div>`;
  const kids = (d.kids || []).map((k, j) => `<div class="kid" data-i="${j}" style="left:${k.box[0] * 100}%;top:${k.box[1] * 100}%;width:${k.box[2] * 100}%;height:${k.box[3] * 100}%"></div>`).join("");
  return `<div class="card"><h2>${esc(d.kind)}</h2><div class="paper"><div class="drawbox" data-d="${i}" style="padding-top:${d.size[1] / d.size[0] * 100}%">${d.svg}${kids}</div></div><div class="cap">${esc(d.file)} · redrawn</div></div>`;
}

async function pattern(id) {
  await loadIndex();
  const p = await loadPattern(id);
  const k = FLAT.findIndex(x => x.id === id), prev = FLAT[k - 1], next = FLAT[k + 1];
  const models = [...(p.moving || []).map(m => ({m, lab: `Highgate${p.moving.length > 1 ? " " + m.where : ""}`})),
                  ...(p.also_moving || []).map(m => ({m, lab: "Modern Club Passing"}))];
  const meta = [p.chapter, p.label ? `book page ${p.label}` : "", jLabel(p.jugglers), p.objects ? `${p.objects} clubs` : "", p.timing || ""].filter(Boolean).join(" · ");
  const notes = (p.notations || []).map(n => `<dt>${esc({"hg-siteswap": "siteswap", "prechac": "préchac", "hg-siteswap-in-title": "siteswap (title)", "hg-siteswap-in-text": "siteswap (text)"}[n.type] || n.type)}</dt><dd>${esc(n.value)}</dd>`).join("");
  const der = p.derived && !(p.notations || []).some(n => n.value === p.derived.value)
    ? `<dt>derived from the drawing (${esc(p.derived.kind || "")}${p.derived.confidence ? ", " + esc(p.derived.confidence) + " confidence" : ""})</dt><dd>${esc(p.derived.value)}</dd>` : "";
  let html = `<div class="pat"><h1>${esc(p.name)}</h1><div class="sub">${esc(meta)}</div>
    <div class="links">${p.pdf ? `<a class="btn primary" href="${esc(p.pdf)}" target="_blank" rel="noopener">Read in the book ↗</a>` : ""}${p.passist ? `<a class="btn" href="${esc(p.passist)}" target="_blank" rel="noopener">Animate on passist ↗</a>` : ""}</div>`;
  if (models.length) html += `<div class="card"><h2>Walking</h2>${models.length > 1 ? `<div class="tabs">${models.map((x, i) => `<button class="chip${i === 0 ? " on" : ""}" data-m="${i}">${esc(x.lab)}</button>`).join("")}</div>` : ""}<div id="player"></div><div class="cap">Modelled from the book's position frames and causal diagram; tap ▶ to play.</div></div>`;
  if (notes || der) html += `<div class="card"><h2>Notation</h2><dl class="notes">${notes}${der}</dl></div>`;
  html += (p.drawings || []).map(drawingHtml).join("");
  if (!models.length && !notes && !der && !(p.drawings || []).length) html += `<div class="card empty">Nothing drawn for this section; read it in the book.</div>`;
  if ((p.related || []).length) html += `<div class="card"><h2>Mentioned</h2>${p.related.map(r => `<a class="btn" href="#/p/${esc(r.id)}">${esc(r.name)}</a>`).join(" ")}</div>`;
  html += `<div class="pager">${prev ? `<a class="btn" href="#/p/${esc(prev.id)}">← ${esc(prev.name)}</a>` : "<span></span>"}${next ? `<a class="btn" href="#/p/${esc(next.id)}">${esc(next.name)} →</a>` : "<span></span>"}</div></div>`;
  $("#main").innerHTML = html;
  window.scrollTo(0, 0);
  document.querySelectorAll(".drawbox").forEach(box => fitKids(box, p.drawings[+box.dataset.d]));
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
    <p>The drawings here are redrawn from readings of the book's own diagrams; the walking animations are models built from its position frames and causal diagrams. Each pattern links to its page in the book for the full description.</p>
    <p>Shared under the book's CC BY-NC-SA terms: non-commercial, with attribution.</p>
    <p>“Animate on passist” opens the pattern's siteswap on <a href="https://passist.org" target="_blank" rel="noopener">passist.org</a>, where one is known.</p></div>`;
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
