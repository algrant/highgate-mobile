// Shared by index.html and diagrams.html: a transcribed drawing (hg-diagram-events / will-ladder-events)
// as text and as an SVG drawn back in the Highgate book's own style.
function escHtml(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

// ---- a transcribed drawing (hg-diagram-events / will-ladder-events) as text and as an SVG in Highgate's style ----
function eventsText(v) {
  if (!v || !v.rows) return fmtValGeneric(v);
  const rows = v.rows.map(rw => `${rw.juggler}${rw.name ? " (" + rw.name + ")" : ""}${rw.tempo === "free" ? " (irregular spacing)" : rw.tempo && rw.tempo !== 1 ? " tempo ×" + rw.tempo.toFixed(2) : ""}: ` + rw.beats.map(b => `${+(+b.t).toFixed(2)}${b.hand || "?"}`).join(" "));
  const arr = (v.arrows || []).map(a => `${v.rows[a.from[0]].juggler}${+(+a.from[1]).toFixed(2)}${a.from[2] || ""}→${v.rows[a.to[0]].juggler}${+(+a.to[1]).toFixed(2)}${a.to[2] || ""}${a.head ? "◄" : ""}${a.arc ? "⌒" : ""}${a.grey ? "(grey)" : ""}`);
  const q = [v.sync ? "synchronous (two hand rows per juggler)" : "", v.grid === 3 ? "thirds grid" : "", v.tempos && v.tempos.length > 1 ? "different tempos" : "", v.unlinked ? `${v.unlinked} unlinked beats` : "", v.leftover_px ? `${v.leftover_px} px of ink unaccounted for` : ""].filter(Boolean);
  return rows.join("\n") + "\nlines: " + arr.join(" ") + (q.length ? "\n" + q.join(" · ") : "");
}
const fmtValGeneric = v => typeof v === "object" && v !== null ? JSON.stringify(v, null, 1).replace(/[{}\[\]"]/g, "").replace(/\n\s*\n/g, "\n").trim() : String(v ?? "");
// The part of a sampled curve outside both end circles, with its ends placed exactly on the circles' edges (the
// first sample outside a circle can sit a few pixels off it).
function trimToCircles(pts, c1, c2, R) {
  const out = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1]) >= R;
  const edge = (a, b, c) => {            // a inside circle c, b outside: where the segment crosses its edge
    let lo = 0, hi = 1;
    for (let k = 0; k < 20; k++) {
      const m = (lo + hi) / 2, p = [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m];
      if (out(p, c)) hi = m; else lo = m;
    }
    return [a[0] + (b[0] - a[0]) * hi, a[1] + (b[1] - a[1]) * hi];
  };
  let i0 = pts.findIndex(p => out(p, c1) && out(p, c2)), i1 = pts.length - 1;
  while (i1 >= 0 && !(out(pts[i1], c1) && out(pts[i1], c2))) i1--;
  if (i0 < 0 || i1 < i0) return [];
  const vis = pts.slice(i0, i1 + 1);
  if (i0 > 0) vis.unshift(edge(pts[i0 - 1], pts[i0], c1));
  if (i1 < pts.length - 1) vis.push(edge(pts[i1 + 1], pts[i1], c2));
  return vis;
}

function eventsSvg(v) {
  if (!v || !v.rows || !v.rows.length) return "";
  const U = 63, R = 15, sync = !!v.sync;            // the book's own scale: 63 px per beat, circles r=15
  // Where the book put the names and the position dots (v.layout, measured by the reader in the book's pixels,
  // px = x0 + t * unit along the beat grid, each juggler's main row at rows_y): drawn there, the names at the
  // book's size. Without a layout the names sit in a column of their own.
  const L = v.layout && v.layout.rows_y && v.layout.rows_y.length === v.rows.length ? v.layout : null;
  // drawn in the book's own pixels: its beat spacing (Ux: 63 px mostly, 46-83 in some drawings) and its rows,
  // with circles at their usual size (the book does not shrink them where it narrows the beat: p170, p273)
  const Ux = L ? L.unit : U, sc = 1;
  const lxs = L ? [...L.names.map(n => n[0]), ...L.dots.map(d => d[0] - 7)] : [];
  // (a plain drawing, the small diagrams of a transition map, has no names at all)
  const namesW = v.plain ? 0 : L && lxs.length ? Math.max(0, 6 - R + (L.x0 - Math.min(...lxs)) * sc)
                                 : Math.max(60, ...v.rows.map(rw => ((rw.name || rw.juggler).length * 13 + 20)));
  // Every circle sits at its juggler's row plus its own vertical offset (dy, in beats, as measured in the book):
  // one row, hands stacked at some beats, two full hand rows for a synchronous drawing, or a switch between them.
  const base = [];                                   // y of each juggler's main row
  let y = v.rows.some(rw => rw.beats.some(b => b.n != null)) || (v.labels || []).some(l => !l.below) ? 45 : 27;
  v.rows.forEach((rw, j) => {
    const dys = rw.beats.map(b => b.dy || 0);
    const lo = Math.min(0, ...dys), hi = Math.max(0, ...dys);
    base.push(L && j ? base[0] + L.rows_y[j] - L.rows_y[0] : y - lo * Ux);
    y = base[base.length - 1] + hi * Ux + 63;
  });
  const beatOf = (j, t, hand) => { const bs = v.rows[j].beats.filter(b => +b.t === +t); return bs.find(b => b.hand === hand) || bs[0]; };
  const rowY = (j, hand, t) => { const b = t == null ? null : beatOf(j, t, hand); return base[j] + ((b && b.dy) || 0) * Ux; };
  // a galloped drawing keeps each circle where the book drew it (`at`, in beats); its beat is still `t`
  const at = (j, t, hand) => { const b = beatOf(j, t, hand); return b && b.at != null ? +b.at : +t; };
  const tmax = Math.max(...v.rows.flatMap(rw => rw.beats.map(b => Math.max(+b.t, b.at ?? 0))));
  const numbered = v.rows.some(rw => rw.beats.some(b => b.n != null)) || (v.labels || []).length > 0;
  const W = namesW + tmax * Ux + 2 * R + 10, H = y - 63 + 27 + R + 6 + (numbered ? 22 : 0);
  const X = t => namesW + R + t * Ux;
  const linked = new Set((v.arrows || []).flatMap(a => [a.from.slice(0, 2).join("@"), a.to.slice(0, 2).join("@")]));
  const lab = (j, t, hand) => `${v.rows[j].juggler}${+(+t).toFixed(2)}${hand || ""}`;
  // where the book's pixels fall in ours (renderer = origin + book px * sc), so a page can lay this drawing exactly
  // over the book's: its beat grid on the book's
  const bookMap = L ? ` data-bx="${(namesW + R - L.x0 * sc).toFixed(2)}" data-by="${(base[0] - L.rows_y[0] * sc).toFixed(2)}" data-sc="${sc.toFixed(4)}"` : "";
  let out = `<svg viewBox="0 0 ${W} ${H}"${bookMap} class="events-svg" style="display:block;max-width:100%;margin:0 0 8px;border:1px solid var(--line);background:#fff;font-family:Arial,Helvetica,sans-serif">
  <style>.ev-line{cursor:pointer}.ev-line:hover line:not(.hit),.ev-line:hover polyline:not(.hit),.ev-line.sel line:not(.hit),.ev-line.sel polyline:not(.hit){stroke:#06c;stroke-width:3}.ev-node{cursor:pointer}.ev-node:hover circle,.ev-node.sel circle{stroke:#06c;stroke-width:3}.ev-node .idx{display:none;font-size:11px;fill:#06c}.ev-node:hover .idx,.ev-node.sel .idx,.events-svg.show-idx .ev-node .idx{display:block}</style>`;
  const rx = px => namesW + R + (px - L.x0) * sc;
  const ry = py => {                                 // the book's y to ours, between the rows it lies between
    const ys = L.rows_y, n = ys.length - 1;
    if (py <= ys[0] || n === 0) return base[0] + (py - ys[0]) * sc;
    if (py >= ys[n]) return base[n] + (py - ys[n]) * sc;
    const k = ys.findIndex((yk, i) => i < n && py <= ys[i + 1]);
    return base[k] + (py - ys[k]) / (ys[k + 1] - ys[k]) * (base[k + 1] - base[k]);
  };
  const placed = new Set();
  if (L) {
    for (const [x0, y0, x1, y1, name] of L.names) {  // name boxes are cap height to baseline (no descenders)
      const fs = (y1 - y0 - 2) / 0.716 * sc;              // (the box has a pixel of anti-aliasing top and bottom)
      out += `<text x="${rx(x0).toFixed(1)}" y="${ry(y1).toFixed(1)}" font-size="${fs.toFixed(1)}" textLength="${((x1 - x0) * sc).toFixed(1)}" lengthAdjust="spacingAndGlyphs" fill="#000">${escHtml(name)}</text>`;
      placed.add(name);
    }
    for (const [x, y] of L.dots)
      out += `<circle cx="${rx(x).toFixed(1)}" cy="${ry(y).toFixed(1)}" r="${(6.3 * sc).toFixed(1)}" fill="#808080" stroke="#000" stroke-width="${sc.toFixed(2)}"/>`;
  }
  v.rows.forEach((rw, j) => {
    if (placed.has(rw.name) || v.plain) return;
    // the name sits on the juggler's row, or halfway between two hand rows when the second is a real row
    // (a synchronous drawing) rather than an occasional stacked beat
    const dys = rw.beats.map(b => b.dy || 0), second = dys.filter(d => d !== 0);
    const lanes = [...new Set(second)];
    const mid = lanes.length === 1 && second.length >= 0.3 * dys.length ? lanes[0] * Ux / 2 : 0;
    out += `<text x="8" y="${base[j] + mid + 9}" font-size="26" fill="#222">${escHtml(rw.name || rw.juggler)}</text>`;
  });
  (v.arrows || []).forEach((a, ai) => {
    const [j1, t1, h1] = a.from, [j2, t2, h2] = a.to;
    const title = `${lab(j1, t1, h1)} → ${lab(j2, t2, h2)}${a.head ? " (arrowhead)" : ""}${a.arc ? " (arc)" : ""}${a.grey ? " (grey)" : ""}`;
    out += `<g class="ev-line" data-line="${ai}" data-label="${escHtml(title)}"><title>${escHtml(title)}</title>`;
    const x1 = X(at(j1, t1, h1)), y1 = rowY(j1, h1, t1), x2 = X(at(j2, t2, h2)), y2 = rowY(j2, h2, t2);
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const sx = x1 + ux * R, sy = y1 + uy * R, ex = x2 - ux * R, ey = y2 - uy * R;
    const col = a.grey ? "#aaa" : "#000";
    if (a.path || a.ctrl) {
      // A long pass between rows two or more apart. The book draws them all one way, mirrored as needed: a
      // quadratic that leaves the upper circle nearly level and meets the lower circle nearly upright. Measured
      // over the 230 curves the reader fitted (up and down, rows two or three apart), its control point sits
      // at the lower circle's x (a tenth of the way back toward the upper one) and a fifth of the drop below
      // the upper row. Drawn with that one shape; the reader's ink only decides which circles are joined.
      const down = y2 > y1, [xt, yt, xb, yb] = down ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
      const C = [xb + (xt - xb) * 0.1, yt + (yb - yt) * 0.2], pts = [];
      for (let k = 0; k <= 48; k++) {
        const u = k / 48, w = 1 - u;
        pts.push([w * w * x1 + 2 * w * u * C[0] + u * u * x2, w * w * y1 + 2 * w * u * C[1] + u * u * y2]);
      }
      const vis = trimToCircles(pts, [x1, y1], [x2, y2], R);
      const pl = vis.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
      out += `<polyline points="${pl}" fill="none" stroke="${col}" stroke-width="1.5"/><polyline class="hit" points="${pl}" fill="none" stroke="transparent" stroke-width="9"/>`;
    } else if (a.arc) {   // the profile the reader fitted: offset h0 (the circle's top/bottom for a same-row arc) plus a bulge of 4.h.u(1-u)
      const h = a.arc, h0 = a.h0 || 0, sg = Math.sign(h), nx = -uy, ny = ux;
      const pts = [];
      if (h0 > 0) {
        // a same-row arc leaves each circle a little off its top/bottom, towards the middle of the arc (about 25
        // degrees from vertical), then bulges out; the ends are on the circles' edges
        const A = 25 * Math.PI / 180;
        const S = [x1 + (ux * Math.sin(A) + sg * nx * Math.cos(A)) * R, y1 + (uy * Math.sin(A) + sg * ny * Math.cos(A)) * R];
        const E = [x2 + (-ux * Math.sin(A) + sg * nx * Math.cos(A)) * R, y2 + (-uy * Math.sin(A) + sg * ny * Math.cos(A)) * R];
        // the middle of the curve sits where the reader found it: h0 + |h| from the chord through the centres
        const mid = (h0 + Math.abs(h)) - R * Math.cos(A);       // height above the start/end points
        for (let k = 0; k <= 24; k++) {
          const u = k / 24, off = sg * mid * 4 * u * (1 - u);
          pts.push([S[0] + (E[0] - S[0]) * u + nx * off, S[1] + (E[1] - S[1]) * u + ny * off]);
        }
      } else {
        for (let k = 0; k <= 24; k++) {
          const u = k / 24, s = u * L, off = h0 < 0 ? h * Math.sin(2 * Math.PI * u) : sg * h0 + 4 * h * u * (1 - u);
          pts.push([x1 + ux * s + nx * off, y1 + uy * s + ny * off]);
        }
      }
      // start and end where the curve leaves the circles (first/last point outside radius R)
      const inside = p => Math.hypot(p[0] - x1, p[1] - y1) < R || Math.hypot(p[0] - x2, p[1] - y2) < R;
      const vis = h0 > 0 ? pts : trimToCircles(pts, [x1, y1], [x2, y2], R);      // same-row arcs already start and end on the edges
      if (vis.length > 1) out += `<polyline points="${vis.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="none" stroke="${col}" stroke-width="1.5"/><polyline class="hit" points="${vis.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="none" stroke="transparent" stroke-width="9"/>`;
      if (a.head) {  // barbs at the end of the curve
        const q = vis[vis.length - 1], q0 = vis[Math.max(0, vis.length - 3)];
        const dl = Math.hypot(q[0] - q0[0], q[1] - q0[1]) || 1;
        let tx = (q[0] - q0[0]) / dl, ty = (q[1] - q0[1]) / dl;
        if (h0 > 0) {
          // a curve along the row meets the circle at its top or bottom almost tangentially; the book draws the
          // head there with one barb exactly along the row (back along the curve) and one nearly upright,
          // about 80 degrees out from the row, so both stay outside the circle
          const ox = sg * nx, oy = sg * ny;                       // outward normal (away from the row)
          const rx = -Math.sign(tx || 1), ry = 0;                 // back along the row, towards the other circle
          for (const [c1, c2] of [[1, 0], [Math.cos(80 * Math.PI / 180), Math.sin(80 * Math.PI / 180)]]) {
            const bx = q[0] + (rx * c1 + ox * c2) * 13, by = q[1] + (ry * c1 + oy * c2) * 13;
            out += `<line x1="${q[0].toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${col}" stroke-width="1.5"/>`;
          }
        } else {
          for (const s of [1, -1]) {
            const bx = q[0] - tx * 9.2 + s * (-ty) * 9.2, by = q[1] - ty * 9.2 + s * tx * 9.2;
            out += `<line x1="${q[0].toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${col}" stroke-width="1.5"/>`;
          }
        }
      }
    } else {
      out += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${col}" stroke-width="1.5"/>`;
      out += `<line class="hit" x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="transparent" stroke-width="9"/>`;
      if (a.head) {  // barbs at 45°, 13 px, from the tip on the target circle's edge
        for (const s of [1, -1]) {
          const bx = ex - ux * 9.2 + s * (-uy) * 9.2, by = ey - uy * 9.2 + s * ux * 9.2;
          out += `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${col}" stroke-width="1.5"/>`;
        }
      }
    }
    out += `</g>`;
  });
  v.rows.forEach((rw, j) => {
    for (const b of rw.beats) {
      const cx = X(b.at ?? +b.t), cy = base[j] + (b.dy || 0) * Ux, islinked = linked.has(`${j}@${+b.t}`);
      const col = b.grey ? "#aaa" : "#000";          // a circle with no line is drawn like any other, as in the book
      const id = lab(j, b.t, b.hand);
      const links = (v.arrows || []).map((a, ai) => [a, ai]).filter(([a]) => (a.from[0] === j && +a.from[1] === +b.t && (!sync || a.from[2] === b.hand)) || (a.to[0] === j && +a.to[1] === +b.t && (!sync || a.to[2] === b.hand)));
      const tip = `${id}${b.n != null ? " · beat " + b.n : ""}${links.length ? " · " + links.map(([a]) => `${lab(a.from[0], a.from[1], a.from[2])}→${lab(a.to[0], a.to[1], a.to[2])}`).join(", ") : " · no line"}`;
      out += `<g class="ev-node" data-node="${escHtml(id)}" data-t="${+b.t}" data-lines="${links.map(([, ai]) => ai).join(",")}" data-label="${escHtml(tip)}"><title>${escHtml(tip)}</title>`;
      if (b.n != null) {   // the book's beat number, on the side of the circle the book prints it
        const above = !b.n_below;
        out += `<text x="${cx.toFixed(1)}" y="${above ? cy - R - 5 : cy + R + 19}" font-size="18" text-anchor="middle" fill="#222">${b.n}</text>`;
      }
      out += `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${R}" fill="#fff" stroke="${col}" stroke-width="1.5"/><text x="${cx.toFixed(1)}" y="${cy + 7}" font-size="20" text-anchor="middle" fill="${col}">${escHtml(b.hand ?? (v.plain ? "" : "?"))}</text>`;
      out += `<text class="idx" x="${(cx + R + 1).toFixed(1)}" y="${cy - R + 2}" text-anchor="start">${escHtml(id)}</text></g>`;
    }
  });
  for (const l of v.labels || []) {   // numbers the book prints between columns (the synchronous recipe)
    out += `<text x="${X(+l.t).toFixed(1)}" y="${l.below ? base[l.row] + R + 19 : base[l.row] - R - 5}" font-size="18" text-anchor="middle" fill="#222">${l.n}</text>`;
  }
  return out + "</svg>";
}



// Hover shows the label of a circle (its index: juggler, beat, hand, and the lines at it) or of a line (index to
// index); a click pins the selection and highlights the circle's lines. The host page provides an element with
// id "ev-status" to show the label in, or a <title> tooltip does the job alone.
document.addEventListener("mouseover", e => {
  const el = e.target.closest && e.target.closest(".ev-node, .ev-line");
  const box = document.getElementById("ev-status");
  if (el && box) box.textContent = el.dataset.label;
});
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest(".ev-node, .ev-line");
  if (!el) return;
  const svg = el.closest("svg");
  const was = el.classList.contains("sel");
  svg.querySelectorAll(".sel").forEach(x => x.classList.remove("sel"));
  if (was) return;
  el.classList.add("sel");
  if (el.dataset.lines) for (const k of el.dataset.lines.split(",").filter(Boolean)) {
    const l = svg.querySelector(`.ev-line[data-line="${k}"]`); if (l) l.classList.add("sel");
  }
  const box = document.getElementById("ev-status"); if (box) box.textContent = el.dataset.label;
});

// Side-by-side diff of our reading of a drawing against the book's préchac and the book's words
// (derived.compare, built by derive.compare_rows): one small table per juggler, throws aligned at the best
// starting point, cells that differ from our reading highlighted. Collapses to one line when all agree.
function compareTable(cmp) {
  if (!cmp || !cmp.rows || !cmp.rows.length) return "";
  const srcs = [["drawing", "our reading"], ["book", cmp.book_note ? "book, in the drawing's timing" : "book's préchac"], ["words", "book's words"]];   // words: pass = any single
  const present = srcs.filter(([k]) => cmp.rows.some(r => r[k]));
  if (!cmp.differs) {
    return `<div class="m" style="margin:4px 0">${present.filter(([k]) => k !== "drawing").map(([, l]) => l).join(" and ")} agree with our reading, throw for throw</div>`;
  }
  const cell = (t, bad) => `<td style="padding:1px 5px;text-align:center;font-family:ui-monospace,monospace;${bad ? "background:#fdd;color:#a00;font-weight:bold" : ""}">${escHtml(t)}</td>`;
  let html = `<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;font-size:12px">`;
  for (const r of cmp.rows) {
    const who = r.name ? `${escHtml(r.name)} (${escHtml(r.juggler)})` : escHtml(r.juggler);
    present.forEach(([k, label], i) => {
      if (!r[k]) return;
      // words are compared by class (a "pass" is any single, 3p up to 4p), the book's préchac exactly
      const ref = k === "words" ? (r.drawing_class || r.drawing) : r.drawing;
      const cells = r[k].map((t, j) => cell(t, k !== "drawing" && t !== ref[j])).join("");
      html += `<tr style="${i === 0 ? "border-top:1px solid #ddd" : ""}"><td style="padding:1px 8px 1px 0;white-space:nowrap;color:#777">${i === 0 ? who + " · " : ""}${label}</td>${cells}</tr>`;
    });
  }
  return html + `</table></div>`;
}

// Shade beat t's column in a drawn causal diagram (on = false clears it): a position frame's beat, shown when the
// frame is hovered (the republication, viewer/graphics.html).
// (t2: light every beat from t to t2 -- a frame covering several beats)
function beatColumn(svg, t, on = true, t2 = null) {
  if (!svg) return;
  svg.querySelectorAll(".beat-col").forEach(r => r.remove());
  if (!on) return;
  const nodes = t2 == null ? [...svg.querySelectorAll(`.ev-node[data-t="${+t}"] circle`)]
    : [...svg.querySelectorAll(".ev-node")].filter(g => +g.dataset.t >= +t - 1e-6 && +g.dataset.t <= +t2 + 1e-6).map(g => g.querySelector("circle"));
  if (!nodes.length) return;
  const bs = nodes.map(c => c.getBBox());
  const x0 = Math.min(...bs.map(b => b.x)), x1 = Math.max(...bs.map(b => b.x + b.width));
  const y0 = Math.min(...bs.map(b => b.y)), y1 = Math.max(...bs.map(b => b.y + b.height));
  const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  r.setAttribute("class", "beat-col");
  r.setAttribute("x", x0 - 6); r.setAttribute("y", y0 - 10);
  r.setAttribute("width", x1 - x0 + 12); r.setAttribute("height", y1 - y0 + 20);
  r.setAttribute("rx", 8); r.setAttribute("fill", "rgba(0,110,220,0.18)"); r.setAttribute("stroke", "rgba(0,110,220,0.6)");
  svg.insertBefore(r, svg.firstElementChild ? svg.firstElementChild.nextSibling : null);
}
