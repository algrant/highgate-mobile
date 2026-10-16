// The per-juggler table linked to the causal diagram beside it: point at (hover, or tap) a throw in the table and
// its throws in the causal diagram light up -- the hand it leaves, the line, the hand it forces -- with a tooltip
// saying what happens. Works on any page with .pt-table cells and an events.js diagram.
//
// The table's columns follow the book's words, the diagram its own beats: each juggler's throws are matched in
// order, at the shift where the table's passes and selves agree best with the diagram's lines.
"use strict";
(() => {
  const parseId = s => { const m = /^([A-Z]+)([\d.]+)([LR]?)$/.exec(s || ""); return m && {j: m[1], t: +m[2], h: m[3]}; };
  const handWord = h => h === "R" ? "right hand" : h === "L" ? "left hand" : "hand";
  let tip = null, lit = [];

  // a row's real columns: [{cell, hand}] per column that has a throw (a sync row: its two hand lines, L over R)
  function columns(row) {
    const lines = row.querySelectorAll(":scope > .pt-lines > .pt-cells, :scope > .pt-cells");
    const hands = row.classList.contains("pt-sync") ? ["L", "R"] : [null];
    const cols = [];
    lines.forEach((ln, li) => [...ln.children].forEach((c, k) => {
      const items = c.classList.contains("b") ? [...c.children] : [c];
      cols[k] = cols[k] || [];
      items.forEach((it, ii) => { if (!it.classList.contains("none")) cols[k].push({cell: it, hand: hands[li] || (c.classList.contains("b") ? ["R", "L"][ii] : null)}); });
    }));
    return cols.filter(c => c && c.length);
  }
  // what a cell says it does: a pass to whom, or a self
  const target = (cell, me) => { const m = /\bto-([A-Z])\b/.exec(cell.className); return cell.classList.contains("p") && m ? m[1] : me; };

  function match(svg, row) {
    const me = (/\bj-([A-Z]+)\b/.exec(row.className) || [])[1];
    if (!me) return null;
    const nodes = [...svg.querySelectorAll(".ev-node")].map(n => ({n, id: parseId(n.dataset.node)})).filter(x => x.id && x.id.j === me && x.n.dataset.lines);
    const lines = Object.fromEntries([...svg.querySelectorAll(".ev-line")].map(l => [l.dataset.line, l]));
    const out = n => (n.n.dataset.lines || "").split(",").filter(Boolean).map(i => lines[i]).filter(l => l && l.dataset.label.startsWith(n.n.dataset.node + " "));
    const throws = nodes.filter(n => out(n).length).sort((a, b) => a.id.t - b.id.t);
    const times = [...new Set(throws.map(n => n.id.t))];
    const cols = columns(row);
    if (!cols.length || !times.length) return null;
    // (the shift that best agrees: a column's catchers against the lines leaving that beat)
    const to = t => throws.filter(n => n.id.t === t).flatMap(n => out(n).map(l => (parseId(l.dataset.label.split(" → ")[1]) || {}).j));
    let best = 0, bestScore = -1;
    for (let s = 0; s < cols.length; s++) {
      let score = 0;
      times.forEach((t, k) => { const c = cols[(k + s) % cols.length], got = to(t); score += c.filter(x => got.includes(target(x.cell, me))).length; });
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return {me, cols, times, throws, out, shift: best};
  }

  function clear() {
    lit.forEach(el => el.classList.remove("sel"));
    lit = [];
    if (tip) tip.hidden = true;
  }
  function show(cell) {
    clear();
    const row = cell.closest(".pt-row"), page = cell.closest(".pat-main, .pat, main") || document;
    const svg = [...page.querySelectorAll("svg")].find(s => s.querySelector(".ev-node") && s.getBoundingClientRect().width > 0);
    const say = [];
    const who = (row.querySelector(".pt-who") || {}).textContent || "";
    if (svg && row) {
      const m = match(svg, row);
      if (m) {
        const k = m.cols.findIndex(c => c.some(x => x.cell === cell));
        const hand = (m.cols[k] || []).find(x => x.cell === cell);
        const first = m.times.find((t, i) => (i + m.shift) % m.cols.length === k);
        // (the juggler letters as the page names them: the table's row names)
        const names = Object.fromEntries([...row.closest(".pt-table").querySelectorAll(".pt-row")].map(r => [(/\bj-([A-Z]+)\b/.exec(r.className) || [])[1], ((r.querySelector(".pt-who") || {}).textContent || "").trim()]));
        m.times.forEach((t, i) => {
          if ((i + m.shift) % m.cols.length !== k) return;
          m.throws.filter(n => n.id.t === t && (!hand || !hand.hand || !n.id.h || n.id.h === hand.hand || m.cols[k].length === 1)).forEach(n => {
            n.n.classList.add("sel"); lit.push(n.n);
            m.out(n).forEach(l => {
              l.classList.add("sel"); lit.push(l);
              const b = l.dataset.label.split(" → ")[1].replace(/ \(.*$/, ""), to = parseId(b);
              const tn = svg.querySelector(`.ev-node[data-node="${CSS.escape(b)}"]`);
              if (tn) { tn.classList.add("sel"); lit.push(tn); }
              // (said once, for the first time it comes round: which hand, to which hand)
              if (t === first && to) say.push(`${handWord(n.id.h)} → ${to.j === m.me ? "own " : (names[to.j] || to.j) + "'s "}${handWord(to.h)}`);
            });
          });
        });
      }
    }
    tip = tip || Object.assign(document.createElement("div"), {className: "pt-tip"});
    if (!tip.isConnected) document.body.appendChild(tip);
    const what = cell.getAttribute("title") || cell.dataset.tip || cell.textContent;
    if (!cell.dataset.tip) { cell.dataset.tip = what; cell.removeAttribute("title"); }   // (ours instead of the browser's)
    tip.innerHTML = `<b>${who.trim()}</b>: ${cell.dataset.tip.replace(/[<&]/g, c => c === "<" ? "&lt;" : "&amp;")}${say.length ? `<br><span>${say.join("; ")}</span>` : ""}`;
    tip.hidden = false;
    const r = cell.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
    tip.style.top = `${r.top - tip.offsetHeight - 8 < 8 ? r.bottom + 8 : r.top - tip.offsetHeight - 8}px`;
  }
  const cellOf = e => e.target.closest && e.target.closest(".pt-table .pt-c:not(.none):not(.b)");
  document.addEventListener("mouseover", e => { const c = cellOf(e); if (c) show(c); });
  document.addEventListener("mouseout", e => { if (cellOf(e)) clear(); });
  document.addEventListener("click", e => { const c = cellOf(e); if (c) { e.preventDefault(); show(c); } else if (lit.length || (tip && !tip.hidden)) clear(); });
  addEventListener("scroll", () => { if (tip && !tip.hidden) clear(); }, {passive: true});
})();
