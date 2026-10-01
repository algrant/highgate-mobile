// Notes: a hidden way to report problems while using the site. Turned on, with an optional GitHub token, from
// the About page (#/notes). The token stays in this browser's storage only, never in the site. With a token a note
// is posted straight to the repo's issues; without one, it opens GitHub's new-issue page prefilled. Notes wait on
// the phone until sent, so a bad signal mid-session loses nothing.
"use strict";
const NOTES_REPO = "algrant/highgate-mobile";
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const notesOn = () => store.get("hg-notes-on", false);
const notesToken = () => store.get("hg-gh-token", "");

function noteContext(p) {
  const tab = document.querySelector(".tabs .chip.on"), beat = document.querySelector(".mv-beat");
  const bits = [`Pattern: ${p.name}${p.label ? ` (book page ${p.label})` : ""}`, `Site: ${location.href}`];
  if (p.pdf) bits.push(`Original: ${p.pdf}`);
  if (document.querySelector("#player")) bits.push(`Animation: ${tab ? tab.textContent : "Highgate"}${beat && beat.textContent ? `, ${beat.textContent}` : ""}`);
  bits.push(`Drawings shown: ${ORIG ? "original" : "redrawn"}`, `Device: ${navigator.userAgent}`);
  return bits.join("\n");
}

function noteButtonHtml() {
  return notesOn() ? `<button class="btn" id="note-open">✎ Note</button>` : "";
}

function wireNote(p) {
  const b = $("#note-open");
  if (!b) return;
  b.onclick = () => {
    if ($("#note-box")) return $("#note-box textarea").focus();
    b.insertAdjacentHTML("afterend", `<div id="note-box" class="card"><textarea rows="4" placeholder="What's wrong or worth changing?"></textarea>
      <div class="note-row"><button class="btn primary" id="note-send">${notesToken() ? "Send" : "Send via GitHub ↗"}</button><button class="btn" id="note-cancel">Cancel</button><span class="note-msg"></span></div></div>`);
    const box = $("#note-box"), ta = box.querySelector("textarea");
    ta.focus();
    $("#note-cancel").onclick = () => box.remove();
    $("#note-send").onclick = async () => {
      const text = ta.value.trim();
      if (!text) return ta.focus();
      const first = text.split("\n")[0].slice(0, 60);
      queueNote({title: `${p.name}: ${first}`, body: `${text}\n\n---\n${noteContext(p)}`, at: new Date().toISOString()});
      const r = await flushNotes();
      box.querySelector(".note-msg").textContent = r.sent ? "Sent ✓" : r.opened ? "Opened on GitHub" : "Saved; will send when online";
      ta.value = "";
      setTimeout(() => box.remove(), 1500);
    };
  };
}

function queueNote(n) { store.set("hg-notes", [...store.get("hg-notes", []), n]); }

async function flushNotes() {
  const queue = store.get("hg-notes", []), sent = store.get("hg-notes-sent", []);
  const token = notesToken(), left = [];
  let nSent = 0, opened = false;
  for (const n of queue) {
    if (!token) {  // no token: hand the newest note to GitHub's page; older ones stay listed on #/notes
      if (n === queue[queue.length - 1]) {
        window.open(`https://github.com/${NOTES_REPO}/issues/new?title=${encodeURIComponent(n.title)}&body=${encodeURIComponent(n.body)}`, "_blank");
        opened = true; sent.push({...n, url: null});
      } else left.push(n);
      continue;
    }
    try {
      const r = await fetch(`https://api.github.com/repos/${NOTES_REPO}/issues`, {method: "POST",
        headers: {Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json"},
        body: JSON.stringify({title: n.title, body: n.body})});
      if (!r.ok) throw new Error(`${r.status}`);
      sent.push({...n, url: (await r.json()).html_url}); nSent++;
    } catch (e) { left.push({...n, error: e.message}); }
  }
  store.set("hg-notes", left);
  store.set("hg-notes-sent", sent.slice(-30));
  return {sent: nSent, opened, left: left.length};
}

async function notesPage() {
  const q = store.get("hg-notes", []), sent = store.get("hg-notes-sent", []).slice().reverse();
  const item = n => `<li><b>${esc(n.title)}</b><br><span class="note-when">${esc(new Date(n.at).toLocaleString())}${n.error ? ` · failed (${esc(n.error)})` : ""}</span>${n.url ? ` · <a href="${esc(n.url)}" target="_blank" rel="noopener">issue ↗</a>` : ""}</li>`;
  $("#main").innerHTML = `<div class="card notes-page"><h2>Notes</h2>
    <label class="note-row"><input type="checkbox" id="notes-on" ${notesOn() ? "checked" : ""}> Show a ✎ Note button on patterns</label>
    <p class="note-when">Notes become issues on <a href="https://github.com/${NOTES_REPO}/issues" target="_blank" rel="noopener">${NOTES_REPO}</a>. With a GitHub token they are sent quietly; without one each opens GitHub's page to submit. The token is kept in this browser only.</p>
    <div class="note-row"><input type="password" id="gh-token" placeholder="GitHub token (optional)" value="${esc(notesToken())}" autocomplete="off"><button class="btn" id="token-save">Save</button></div>
    <div class="note-msg" id="token-msg"></div>
    <details class="note-help"><summary>Making a token</summary><p>On GitHub: Settings → Developer settings → Fine-grained tokens → Generate new token. Repository access: only <i>${NOTES_REPO}</i>; permissions: Issues → Read and write. (A fine-grained token only reaches repositories you own or collaborate on; anyone else can use a classic token with the <i>public_repo</i> scope.)</p></details>
    ${q.length ? `<h2>Waiting to send (${q.length})</h2><ul class="note-list">${q.map(item).join("")}</ul><button class="btn primary" id="notes-flush">Send now</button>` : ""}
    ${sent.length ? `<h2>Sent</h2><ul class="note-list">${sent.map(item).join("")}</ul>` : ""}</div>`;
  $("#notes-on").onchange = e => store.set("hg-notes-on", e.target.checked);
  $("#token-save").onclick = async () => {
    const t = $("#gh-token").value.trim(), msg = $("#token-msg");
    store.set("hg-gh-token", t);
    if (!t) return (msg.textContent = "Token cleared.");
    msg.textContent = "Checking…";
    try {
      const r = await fetch(`https://api.github.com/repos/${NOTES_REPO}`, {headers: {Authorization: `Bearer ${t}`}});
      msg.textContent = r.ok ? "Saved ✓ token works." : `Saved, but GitHub said ${r.status}: check the token.`;
    } catch (e) { msg.textContent = "Saved; couldn't reach GitHub to check it."; }
  };
  const f = $("#notes-flush");
  if (f) f.onclick = async () => { await flushNotes(); notesPage(); };
}

// anything waiting goes when the site opens or the phone comes back online
window.addEventListener("online", () => { if (notesToken()) flushNotes(); });
if (notesToken() && store.get("hg-notes", []).length) flushNotes();
