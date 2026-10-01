// A moving pattern (extract/moving.py: people, their track over beats, walks, passes, relabelling) drawn at any
// moment as seen from above, played as an animation, or drawn as still frames in the style of the books' frames.
// Coordinates are a unit square, y down.

const MV = { R: 0.045, pad: 0.12 };

function mvEsc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c])); }

// everyone's position and label at time t (beats, looping over the model's mod), between the quarter-beat samples
function mvAt(m, t) {
  const mod = m.mod, tt = ((t % mod) + mod) % mod;
  const tr = m.track, q = (tt - tr.t0) / tr.step, i = Math.floor(q), f = q - i;
  const a = tr.at[Math.min(i, tr.at.length - 1)], b = tr.at[Math.min(i + 1, tr.at.length - 1)];
  return a.map((p, k) => [p[0] + (b[k][0] - p[0]) * f, p[1] + (b[k][1] - p[1]) * f, f < 0.5 ? p[2] : b[k][2]]);
}

// the passes in the air at time t: [pass, progress 0..1]
function mvPassesAt(m, t) {
  const mod = m.mod, loop = Math.floor(t / mod), tt = ((t % mod) + mod) % mod, out = [];
  for (const p of m.passes) {
    if (p.first_iteration === true && loop > 0) continue;
    if (p.first_iteration === false && loop === 0) continue;
    let d = tt - p.beat; if (d < 0) d += mod;
    // (with when it was thrown: t - d, in the previous loop when it crosses the loop's start)
    if (d <= p.duration) out.push([p, d / p.duration, t - d]);
  }
  return out;
}

// the walks under way or about to start (within `ahead` beats) at time t: [move, progress (negative: not yet)]
function mvMovesAt(m, t, ahead = 0) {
  const mod = m.mod, tt = ((t % mod) + mod) % mod, out = [];
  for (const mv of m.moves) {
    let d = tt - mv.beat; if (d < -ahead) d += mod;
    if (d >= -ahead && d <= mv.duration) out.push([mv, mv.duration ? d / mv.duration : 1]);
  }
  return out;
}

// Which way each person faces. Keyframes at their passes: tossing, they face their catcher; catching, their
// thrower (both at once: between the two). Walking, they face the way they walk -- nobody is tracked on the move.
// Standing between passes, they face whoever their nearer pass (in time) is with. mvFacing turns them gradually.
function mvFacing(m, t, pos) {
  // (followed once per pattern on a fixed grid of eighths of a beat, over a loop to settle and then the loop kept,
  // so every moment shares the same history; between grid points the angle is interpolated the short way)
  // (turning up to 45 degrees an eighth of a beat, aiming an eighth of a beat ahead so a turn is made by the pass)
  const STEP = 0.125, MAX = Math.PI / 4, LEAD = 0.125;
  if (!m._face) {
    const n = Math.round(m.mod / STEP), face = [];
    let f = null;
    for (let i = -n; i < n; i++) {
      const ts = i * STEP, P = mvAt(m, ts + LEAD), aim = mvFacingAt(m, ts + LEAD, P);
      if (!f) f = aim.map(v => v && Math.atan2(v[1], v[0]));
      else f = f.map((a, k) => {
        if (!aim[k]) return a;
        const b = Math.atan2(aim[k][1], aim[k][0]);
        if (a == null) return b;
        let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
        if (Math.abs(d) > 2.8) {
          // (turning right about: through the side facing into the group)
          const cx = P.reduce((s_, q) => s_ + q[0], 0) / P.length - P[k][0], cy = P.reduce((s_, q) => s_ + q[1], 0) / P.length - P[k][1];
          d = (Math.cos(a + Math.PI / 2) * cx + Math.sin(a + Math.PI / 2) * cy >= 0 ? 1 : -1) * Math.abs(d);
        }
        return a + Math.max(-MAX, Math.min(MAX, d));
      });
      if (i >= 0) face.push(f.slice());
    }
    m._face = face;
  }
  const n = m._face.length, q = ((t % m.mod) + m.mod) % m.mod / STEP, i = Math.floor(q) % n, u = q - Math.floor(q);
  const A = m._face[i], B = m._face[(i + 1) % n];
  return A.map((a, k) => {
    if (a == null) return null;
    let b = B[k] == null ? a : B[k], d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
    const ang = a + d * u;
    return [Math.cos(ang), Math.sin(ang)];
  });
}

// the angle a fraction u of the way from a to b, the short way round (unit vectors in and out)
function mvSlerp(a, b, u) {
  if (!a) return b; if (!b) return a;
  const a0 = Math.atan2(a[1], a[0]); let d = Math.atan2(b[1], b[0]) - a0;
  while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
  return [Math.cos(a0 + d * u), Math.sin(a0 + d * u)];
}

// the walk person k is on at time t: [walk, how far along (0-1)], or null
function mvWalkOf(m, t, k) {
  const mod = m.mod, tt = ((t % mod) + mod) % mod;
  for (const mv of m.moves) {
    if (mv.person !== k || !mv.duration) continue;
    let d = tt - mv.beat; if (d < 0) d += mod;
    if (d <= mv.duration) return [mv, d / mv.duration];
  }
  return null;
}

// opts.standing: leave out the walking rule; opts.only: work out that one person (the others null)
function mvFacingAt(m, t, pos, opts = {}) {
  const mod = m.mod, tt = ((t % mod) + mod) % mod, NEAR = 0.35;
  const circ = e => { let d = e - tt; while (d > mod / 2) d -= mod; while (d < -mod / 2) d += mod; return d; };
  const before = mvAt(m, t - 0.1), after = mvAt(m, t + 0.1);
  return pos.map((P, k) => {
    if (opts.only != null && k !== opts.only) return null;
    // (someone the book says keeps one facing: a dropback line's throwers, passing back over their shoulder)
    if (m.facing_fixed && m.facing_fixed[k]) return m.facing_fixed[k];
    const ev = [];                                  // [time from now, the other person]
    for (const p of m.passes) {
      if (p.from === k && p.to !== k) ev.push([circ(p.beat), p.to, true]);          // (a toss)
      if (p.to === k && p.from !== k) ev.push([circ(p.beat + p.duration), p.from, false]);
    }
    const toward = j => { const dx = pos[j][0] - P[0], dy = pos[j][1] - P[1], L = Math.hypot(dx, dy); return L ? [dx / L, dy / L] : null; };
    // exchanges: a person's passes in time order, those in a row with the same partner (a toss and the catch of the
    // reply, or several) making one exchange; during one (from its first pass to its last, NEAR either side) they
    // face that partner, whatever else is happening
    ev.sort((p_, q_) => p_[0] - q_[0]);
    const ex = [];                                  // [start, end, partner, first toss or null]
    for (const [d, j, toss] of ev) {
      const last = ex[ex.length - 1];
      if (last && last[2] === j) { last[1] = d; if (toss && last[3] == null) last[3] = d; }
      else ex.push([d, d, j, toss ? d : null]);
    }
    // a feed: throws to different people a beat or less apart ("pass pass" to two feedees), found from the throws
    // alone (the replies caught in between would split it), lasting until those replies are caught -- faced towards
    // the middle of the feedees. Everything else goes by exchanges.
    const feeds = [];                               // [start, end, [partners], last toss]
    for (const [d, j] of ev.filter(e => e[2])) {
      const f = feeds[feeds.length - 1];
      if (f && d - f[3] <= 1.0 + 1e-6) { f[1] = d; f[3] = d; if (!f[2].includes(j)) f[2].push(j); }
      else feeds.push([d, d, [j], d]);
    }
    const fed = feeds.filter(f => f[2].length >= 2);
    for (const f of fed) {
      const replies = ev.filter(([d, j, toss]) => !toss && f[2].includes(j) && d > f[1] && d <= f[1] + 1.5).map(([d]) => d);
      if (replies.length) f[1] = Math.max(f[1], ...replies);
    }
    // (an exchange overlapping a feed is cut back to the part outside it, not dropped: after feeding, a feedee's
    // exchange with the new feeder runs on from the feed -- Anticlockwise pass pass self runaround)
    const cut = [];
    for (const [a0, b0, j] of ex) {
      let parts = [[a0, b0]];
      for (const f of fed) {
        parts = parts.flatMap(([a_, b_]) => b_ < f[0] - 1e-6 || a_ > f[1] + 1e-6 ? [[a_, b_]]
          : [...(a_ < f[0] - 1e-6 ? [[a_, f[0] - 1e-3]] : []), ...(b_ > f[1] + 1e-6 ? [[f[1] + 1e-3, b_]] : [])]);
      }
      for (const [a_, b_] of parts) cut.push([a_, b_, [j]]);
    }
    const groups = [...fed.map(f => [f[0], f[1], f[2]]), ...cut].sort((x, y) => x[0] - y[0]);
    const inG = groups.find(([a_, b_]) => a_ - NEAR <= 0 && 0 <= b_ + NEAR);
    if (inG) {
      let x = 0, y = 0;
      for (const j of inG[2]) { const u = toward(j); if (u) { x += u[0]; y += u[1]; } }
      const L = Math.hypot(x, y);
      if (L > 1e-3) return [x / L, y / L];
    }
    // walking, from 0 (leaving) to 1 (arriving): facing whoever they last passed with at 0 and whoever they pass
    // with next at 1; an unhurried walk turns towards the way they go over its first quarter, faces it, and turns
    // to the next pass over its last quarter; a quick one (a beat or less: the Bruno's) never faces the way it goes,
    // turning steadily from one partner to the next (an exchange on the way still takes the facing, above)
    const vx = after[k][0] - before[k][0], vy = after[k][1] - before[k][1], v = Math.hypot(vx, vy);
    const V = v > 0.01 ? [vx / v, vy / v] : null;
    if (!opts.standing) {
      const w = mvWalkOf(m, t, k);
      if (w) {
        const [mv, u] = w, s0 = t - u * mv.duration, e0 = s0 + mv.duration;
        // (the same for every pass through the walk: kept on it)
        if (!mv._F) mv._F = [mvFacingAt(m, s0 - 0.05, mvAt(m, s0 - 0.05), {standing: true, only: k})[k],
                             mvFacingAt(m, e0 + 0.05, mvAt(m, e0 + 0.05), {standing: true, only: k})[k]];
        const [F0, F1] = mv._F;
        // (someone who never stops -- walking on either side of a frame, the weaves, Cyclone -- keeps facing their
        // partners, not the way they walk)
        const wT = mv.continuous ? 0 : Math.max(0, Math.min(1, (mv.duration - 1) / 2));
        const tw = wT * (u < 0.25 ? u / 0.25 : u > 0.75 ? (1 - u) / 0.25 : 1);
        const base = mvSlerp(F0 || V, F1 || V, u * u * (3 - 2 * u));
        return V ? mvSlerp(base, V, tw) : base;
      }
    }
    // standing between exchanges: one steady turn from the last partner to the next (no stopping in between, no
    // turning back -- Traffic lights' Ben from Anne to Clare). (A walk's start and end facing come from here too,
    // never from the walk itself.)
    if (!groups.length) return null;
    const dirOf = g => { let x = 0, y = 0; for (const j of g[2]) { const u = toward(j); if (u) { x += u[0]; y += u[1]; } } const L = Math.hypot(x, y); return L > 1e-3 ? [x / L, y / L] : null; };
    const prev = [...groups].reverse().find(([, b_]) => b_ + NEAR < 0), next = groups.find(([a_]) => a_ - NEAR > 0);
    if (prev && next) {
      const s0 = prev[1] + NEAR, e0 = next[0] - NEAR, u = e0 > s0 ? Math.max(0, Math.min(1, -s0 / (e0 - s0))) : 1;
      return mvSlerp(dirOf(prev), dirOf(next), u * u * (3 - 2 * u));
    }
    return dirOf(next || prev);
  });
}

// each person's hands at time t: [right, left], a little in front of them and out to either side of the way they
// face (at their middle when nobody knows which way that is)
function mvHands(m, t, pos, R) {
  const face = mvFacing(m, t, pos);
  return pos.map((P, k) => {
    const f = face[k] || [0, -1], rt = [-f[1], f[0]], fw = R * 1.35, sd = R * 1.25;
    return [[P[0] + f[0] * fw + rt[0] * sd, P[1] + f[1] * fw + rt[1] * sd], [P[0] + f[0] * fw - rt[0] * sd, P[1] + f[1] * fw - rt[1] * sd]];
  });
}
const mvHand = (hands, k, h) => hands[k] ? hands[k][h === "L" ? 1 : 0] : null;

function mvTick(P, f, R, sw, colour) {
  if (!f) return "";
  return `<line x1="${P[0] + f[0] * R}" y1="${P[1] + f[1] * R}" x2="${P[0] + f[0] * R * 1.7}" y2="${P[1] + f[1] * R * 1.7}" stroke="${colour}" stroke-width="${sw * 3}" stroke-linecap="round"/>`;
}

function mvBounds(m) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const row of m.track.at) for (const [x, y] of row) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const s = Math.max(x1 - x0, y1 - y0, 0.3) + 2 * MV.pad, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [cx - s / 2, cy - s / 2, s, s];
}

const MV_COLOURS = ["#d9534f", "#2a7ab9", "#3c9a3c", "#c77c11", "#8a4fb3", "#1a9a9a", "#b0457a", "#666"];

// the scene at time t. opts.style: "live" (coloured people, clubs in flight, walks as dashed paths) or "still"
// (the books' frames: lettered circles, a black line for each pass at that beat, grey arrows for the walks that
// follow it)
function mvSvg(m, t, opts = {}) {
  const style = opts.style || "live", vb = opts.viewBox || mvBounds(m), R = (style === "still" ? 0.12 : MV.R) * vb[2] / 1.2;
  const pos = mvAt(m, t);
  let s = `<svg viewBox="${vb.join(" ")}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%;font-family:Arial,Helvetica,sans-serif">`;
  s += `<defs><marker id="mvhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1 L8 5 L1 9" fill="none" stroke="#aaa" stroke-width="1.6"/></marker></defs>`;
  const sw = vb[2] / 300;
  // the frame's drawn track (a figure of eight, three circles, crossed ellipses: opts.track, [cx, cy, a, b, th]),
  // grey in a still as the book draws it, faint while playing
  for (const [cx, cy, a, b, th] of (opts.track || [])) {
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${a}" ry="${b}" transform="rotate(${th * 180 / Math.PI} ${cx} ${cy})" fill="none" stroke="${style === "still" ? "#dcdcdc" : "#f0f0f0"}" stroke-width="${sw * (style === "still" ? 1.6 : 1.2)}"/>`;
  }
  // the spots of the polygon the pattern was put on, very light: where people stand and walk to
  // (a pattern put on neither a polygon nor a track: where people stand at the frames, very light)
  for (const [x, y] of (m.spots || []))
    s += `<circle cx="${x}" cy="${y}" r="${R * 0.9}" fill="#f0f0f0" stroke="#e2e2e2" stroke-width="${sw}"/>`;
  if (m.polygon) {
    const pg = m.polygon, n = pg.vertices;
    for (let k = 0; k < n; k++) {
      const a = pg.offset + 2 * Math.PI * k / n;
      s += `<circle cx="${pg.centre[0] + pg.radius * Math.cos(a)}" cy="${pg.centre[1] + pg.radius * Math.sin(a)}" r="${R * 0.9}" fill="#f0f0f0" stroke="#e2e2e2" stroke-width="${sw}"/>`;
    }
  }
  if (style === "live") {
    for (const [mv, u] of mvMovesAt(m, t, 1.5))
      s += `<path d="${mv.d}" fill="none" stroke="${MV_COLOURS[mv.person % 8]}" stroke-opacity="${u < 0 ? 0.25 : 0.5}" stroke-width="${sw * 2}" stroke-dasharray="${sw * 5} ${sw * 4}" marker-end="url(#mvhead)"/>`;
    for (const [p, u, thrown] of mvPassesAt(m, t)) {
      // straight from the thrower's hand as it throws to the catcher's hand as it catches (their middles when the
      // hands are not known)
      const t0 = thrown, t1 = t0 + p.duration;
      const a = mvAt(m, t0), b = mvAt(m, t1);
      if (!a[p.from] || !b[p.to]) continue;
      const A = p.hand_from ? mvHand(mvHands(m, t0, a, R), p.from, p.hand_from) : a[p.from];
      const B = p.hand_to ? mvHand(mvHands(m, t1, b, R), p.to, p.hand_to) : b[p.to];
      // (a drop-back, thrown back over the thrower's head: dashed)
      s += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${p.dropback ? "#888" : "#bbb"}" stroke-width="${p.dropback ? sw * 1.6 : sw}"${p.dropback ? ` stroke-dasharray="${sw * 4} ${sw * 3}"` : ""}><title>${p.dropback ? "drop-back: thrown back over the head" : "pass"}</title></line>`;
      // (its direction: a chevron two thirds along, clear of the club at its middle, pointing at the catcher)
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, vx = (B[0] - A[0]) / L, vy = (B[1] - A[1]) / L;
      const hx = A[0] + (B[0] - A[0]) * 0.68, hy = A[1] + (B[1] - A[1]) * 0.68, ah = R * 0.8, c = Math.cos(0.65), sn = Math.sin(0.65);
      s += `<polyline points="${hx - ah * (vx * c - vy * sn)},${hy - ah * (vy * c + vx * sn)} ${hx},${hy} ${hx - ah * (vx * c + vy * sn)},${hy - ah * (vy * c - vx * sn)}" fill="none" stroke="#777" stroke-width="${sw * 2}"/>`;
      s += `<circle cx="${A[0] + (B[0] - A[0]) * u}" cy="${A[1] + (B[1] - A[1]) * u}" r="${R * 0.28}" fill="#222"/>`;
    }
    const face = mvFacing(m, t, pos), hands = mvHands(m, t, pos, R);
    pos.forEach(([x, y, lab], k) => {
      const nm = (m.people[k] || {}).name;
      s += mvTick([x, y], face[k], R, sw, "#333");
      s += `<g><title>${mvEsc(nm || lab)}</title><circle cx="${x}" cy="${y}" r="${R}" fill="${MV_COLOURS[k % 8]}" fill-opacity="0.9" stroke="#222" stroke-width="${sw}"/>`;
      s += `<text x="${x}" y="${y + R * 0.38}" font-size="${R * 1.05}" text-anchor="middle" fill="#fff" font-weight="bold">${mvEsc(lab)}</text></g>`;
      // (the hands on top: right filled, left open)
      hands[k].forEach((H, h) => { s += `<circle cx="${H[0]}" cy="${H[1]}" r="${R * 0.3}" fill="${h ? "#fff" : MV_COLOURS[k % 8]}" stroke="${MV_COLOURS[k % 8]}" stroke-width="${sw * 1.5}"><title>${h ? "left" : "right"} hand</title></circle>`; });
    });
  } else {
    // a still: the passes made on this beat as black lines, the walks leaving from here as grey arrows
    // one line per pair passing on this beat; a pass one way carries a chevron at its middle pointing at the
    // catcher (as Highgate draws them), an exchange both ways is a plain line
    const eps = 1e-6, tt = ((t % m.mod) + m.mod) % m.mod, pairs = new Map();
    for (const p of m.passes) {
      // (a frame may cover a span of beats, opts.span: every pass in it)
      const [lo_, hi_] = opts.span ? opts.span.map(x => ((x % m.mod) + m.mod) % m.mod) : [tt, tt];
      if (p.beat < lo_ - eps || p.beat > hi_ + eps || p.from === p.to) continue;
      const k = [p.from, p.to].sort((a, b) => a - b).join("-");
      if (!pairs.has(k)) pairs.set(k, []);
      pairs.get(k).push(p);
    }
    for (const ps of pairs.values()) {
      const p = ps[0], both = ps.some(q => q.from === p.to && q.to === p.from);
      const A = pos[p.from], B = pos[p.to];
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
      s += `<line x1="${A[0] + ux * R}" y1="${A[1] + uy * R}" x2="${B[0] - ux * R}" y2="${B[1] - uy * R}" stroke="#000" stroke-width="${sw * 3}"/>`;
      if (!both) {
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, a = R * 0.9, c = Math.cos(0.7), sn = Math.sin(0.7);
        const e1 = [mx - a * (ux * c - uy * sn), my - a * (uy * c + ux * sn)], e2 = [mx - a * (ux * c + uy * sn), my - a * (uy * c - ux * sn)];
        s += `<polyline points="${e1[0]},${e1[1]} ${mx},${my} ${e2[0]},${e2[1]}" fill="none" stroke="#000" stroke-width="${sw * 3}"/>`;
      }
    }
    const next = (opts.nextFrame ?? tt + 1);
    for (const mv of m.moves) {
      let d = mv.beat - tt; if (d < -eps) d += m.mod;
      if (d < -eps || d >= (next - tt) - eps) continue;
      s += `<path d="${mv.d}" fill="none" stroke="#a8a8a8" stroke-width="${sw * 3.5}" marker-end="url(#mvhead)"/>`;
    }
    const face = mvFacing(m, t, pos);
    pos.forEach(([x, y, lab], k) => {
      s += mvTick([x, y], face[k], R * 0.95, sw * 0.8, "#000");
      s += `<circle cx="${x}" cy="${y}" r="${R}" fill="#fff" stroke="#000" stroke-width="${sw * 3}"/>`;
      s += `<text x="${x}" y="${y + R * 0.4}" font-size="${R * 1.1}" text-anchor="middle" font-weight="bold">${mvEsc(lab)}</text>`;
    });
  }
  return s + `</svg>`;
}

// a player in el: the scene, play / pause, speed, a beat slider; onTime(t) is told the time as it changes
function mvPlayer(el, m, onTime) {
  el.innerHTML = `<div class="mv-stage"></div>
    <div class="mv-ctl"><button class="mv-play">▶</button>
      <input class="mv-slider" type="range" min="0" max="${m.mod}" step="0.05" value="0">
      <span class="mv-beat"></span>
      <select class="mv-speed"><option value="0.5">½ beat/s</option><option value="1">1 beat/s</option><option value="2" selected>2 beats/s</option><option value="4">4 beats/s</option></select></div>`;
  const stage = el.querySelector(".mv-stage"), play = el.querySelector(".mv-play"), slider = el.querySelector(".mv-slider"), lab = el.querySelector(".mv-beat");
  const vb = mvBounds(m);
  let t = 0, running = false, last = 0;
  const draw = () => {
    const fp = (m.frame_panels || []).filter(p => p.beat <= (t % m.mod) + 1e-6).pop() || (m.frame_panels || [])[0];
    stage.innerHTML = mvSvg(m, t, {viewBox: vb, track: fp && fp.track});
    slider.value = t % m.mod;
    lab.textContent = `beat ${(t % m.mod).toFixed(1)} of ${m.mod}`;
    if (onTime) onTime(t % m.mod);
  };
  const tick = now => {
    if (!running) return;
    t += (now - last) / 1000 * +el.querySelector(".mv-speed").value; last = now;
    draw(); requestAnimationFrame(tick);
  };
  play.onclick = () => { running = !running; play.textContent = running ? "❚❚" : "▶"; last = performance.now(); if (running) requestAnimationFrame(tick); };
  slider.oninput = () => { t = +slider.value; draw(); };
  draw();
  return { seek: x => { t = x; draw(); }, stop: () => { running = false; } };
}
