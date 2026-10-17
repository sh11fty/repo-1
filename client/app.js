// Vanilla PWA client. Renders server responses with textContent only (no innerHTML), so source text can never inject markup.
const $ = (s, r = document) => r.querySelector(s);
const store = { get: (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const MODES = [['teach', 'Teach'], ['first-principles', 'First principles'], ['socratic', 'Socratic'], ['test', 'Test'], ['apply', 'Apply'], ['explain-mistake', 'Explain my mistake'], ['compare', 'Compare'], ['exam-coach', 'Exam coach'], ['mark', 'Mark my answer'], ['challenge', 'Challenge'], ['revision', 'Revision']];

async function api(method, path, body) {
  const base = store.get('server', '').replace(/\/$/, '');
  const token = store.get('token');
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 401 ? 'Not authorised: check the access token in Settings.' : data.error || `Error ${res.status}`);
  return data;
}

const view = $('#view');
const show = (...n) => { view.replaceChildren(...n); window.scrollTo(0, 0); };
const err = (e) => h('div', { class: 'banner bad' }, String(e.message ?? e));

function citationEl(c) {
  return h('details', {}, h('summary', {}, `${c.sourceTitle} · tier ${c.tier} · ${c.version} · p.${c.page}`),
    h('blockquote', {}, `“${c.quote}”`),
    h('div', { class: 'mut' }, `Source ${c.sourceId} · chunk ${c.chunkId}${c.extraction === 'ocr' ? ' · OCR text, check against the original page' : ''}`),
    c.sourceCaveat ? h('div', { class: 'mut' }, `Caveat: ${c.sourceCaveat}`) : null);
}
const CLAIM_LABEL = { source_statement: 'Source statement', explanation: 'Explanation', inference: 'Inference', application: 'Application to scenario', illustration: 'Illustration', calculation: 'Calculation' };
function blocksEl(blocks = []) {
  return blocks.map((b) => h('div', { class: 'card' },
    h('span', { class: `badge t-${b.claimType}` }, b.label || CLAIM_LABEL[b.claimType] || b.claimType),
    h('div', {}, b.text),
    b.basis ? h('div', { class: 'mut' }, `Basis: ${b.basis}`) : null,
    b.calc ? h('div', { class: 'mut' }, `${b.calc.expression} = ${b.calc.result}`) : null,
    (b.citations ?? []).map(citationEl),
    !(b.citations ?? []).length ? h('div', { class: 'mut' }, 'No direct citation: this is an explanation that relies on the cited statements above.') : null));
}
function evidenceEl(ev = []) {
  if (!ev.length) return null;
  return h('div', {}, h('h3', {}, 'Source excerpts'), ev.map((e) => h('div', { class: 'card' }, h('div', { class: 'mut' }, `${e.sourceTitle} · tier ${e.tier} · ${e.version} · p.${e.page}${e.extraction === 'ocr' ? ' · OCR' : ''}`), h('blockquote', {}, e.excerpt))));
}
function reportBtn(targetType, targetId) {
  return h('button', { class: 'btn alt', onclick: async (ev) => {
    const d = prompt('What is wrong with this? (An open report withholds the related content until reviewed.)'); if (!d) return;
    try { await api('POST', '/api/report-error', { targetType, targetId, description: d }); ev.target.textContent = 'Reported'; ev.target.disabled = true; } catch (e) { alert(e.message); }
  } }, 'Report an error');
}
function resultEl(r, { onReveal } = {}) {
  const tone = r.outcome === 'verified' ? 'ok' : r.outcome === 'evidence_only' ? 'warn' : r.outcome === 'source_required' ? 'warn' : 'bad';
  const label = { verified: 'Verified against approved sources', abstain: 'Cannot answer from approved sources', unverified: 'Could not be verified', unavailable: 'Verification unavailable: no answer given', conflict: 'Sources conflict', evidence_only: 'Source excerpts only', source_required: 'Source required', withheld: 'Withheld' }[r.outcome] ?? r.outcome;
  return h('div', {},
    h('div', { class: `banner ${tone}` }, label),
    r.message ? h('p', {}, r.message) : null,
    r.solutionLocked ? h('div', { class: 'banner warn' }, 'Solution hidden. Try the prompts first.') : null,
    (r.tutorMoves ?? []).map((m) => h('div', { class: 'card' }, h('span', { class: 'badge' }, m.type), m.text)),
    r.solutionLocked && onReveal ? h('button', { class: 'btn', onclick: onReveal }, 'Reveal verified solution') : null,
    blocksEl(r.blocks), r.failureCodes?.length ? h('div', { class: 'mut' }, `Checks that failed: ${r.failureCodes.join(', ')}`) : null,
    evidenceEl(r.evidence),
    r.lesson ? h('div', { class: 'card' }, h('h3', {}, r.lesson.title), h('div', { class: 'mut' }, `Syllabus: ${(r.lesson.syllabusRefs ?? []).join(', ')}`), r.lesson.requiredSources?.length ? h('div', {}, 'Needed: ', r.lesson.requiredSources.join(', ')) : null) : null,
    (r.caveats ?? []).map((c) => h('div', { class: 'mut' }, c)),
    r.answerId ? reportBtn('answer', r.answerId) : null);
}

const screens = {
  async home() {
    const out = [h('div', { class: 'card' }, h('h3', {}, 'Welcome'), h('p', {}, 'Technical answers appear only when they pass evidence and verification checks. Otherwise you see what could not be verified.'))];
    try {
      const p = await api('GET', '/api/progress');
      out.push(h('div', { class: 'card' }, h('h3', {}, 'Progress'), h('div', {}, `Attempts: ${p.attempts} · reviews due: ${p.due.length}`),
        h('h4', {}, 'Weak areas'), p.weak.length ? h('div', {}, p.weak.map((w) => `${w.area} (${Math.round(w.pct)}%)`).join(', ')) : h('div', { class: 'mut' }, 'Not enough data yet.'),
        h('h4', {}, 'Recurring mistakes'), Object.keys(p.mistakes).length ? h('div', {}, Object.entries(p.mistakes).map(([k, v]) => `${k.replace(/-/g, ' ')} ×${v}`).join(', ')) : h('div', { class: 'mut' }, 'None recorded.')));
      const sel = h('select', {}, ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((a) => h('option', { value: a }, `Area ${a}`)));
      const rate = h('select', {}, [1, 2, 3, 4, 5].map((n) => h('option', { value: n }, `${n}`)));
      out.push(h('div', { class: 'card' }, h('h3', {}, 'Diagnostic: confidence'), h('div', { class: 'mut' }, 'Self-rating only. It is not a knowledge test and is not scored.'), h('div', { class: 'row' }, sel, rate, h('button', { class: 'btn', onclick: async () => { try { await api('POST', '/api/progress/confidence', { area: sel.value, rating: Number(rate.value) }); alert('Saved'); } catch (e) { alert(e.message); } } }, 'Save')),
        h('div', { class: 'mut' }, `Saved ratings: ${JSON.stringify(p.confidence)}`)));
      out.push(h('div', { class: 'card' }, h('button', { class: 'btn alt', onclick: async () => { if (confirm('Delete all progress data on the server?')) { await api('DELETE', '/api/progress'); screens.home().then(show); } } }, 'Delete my progress data')));
    } catch (e) { out.push(err(e)); }
    return out;
  },
  async tutor() {
    const mode = h('select', {}, MODES.map(([v, l]) => h('option', { value: v }, l)));
    const q = h('textarea', { rows: 3, placeholder: 'Ask a question about the SBR exam or syllabus' });
    const sc = h('textarea', { rows: 3, placeholder: 'Optional: scenario or your answer' });
    const out = h('div');
    const run = async (path, body, withReveal) => {
      out.replaceChildren(h('div', { class: 'mut' }, 'Checking sources and verifying…'));
      try { const r = await api('POST', path, body); out.replaceChildren(resultEl(r, withReveal ? { onReveal: async () => { try { out.replaceChildren(resultEl(await api('POST', '/api/tutor/reveal', { answerId: r.answerId }))); } catch (e) { out.replaceChildren(err(e)); } } } : {})); } catch (e) { out.replaceChildren(err(e)); }
    };
    return [h('div', { class: 'card' }, h('label', {}, 'Mode'), mode, h('label', {}, 'Question'), q, h('label', {}, 'Scenario / your answer (optional)'), sc,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => run('/api/tutor', { message: q.value, mode: mode.value, scenario: sc.value, learnerAnswer: mode.value === 'mark' || mode.value === 'explain-mistake' ? sc.value : '' }, true) }, 'Ask'),
        h('button', { class: 'btn alt', onclick: () => run('/api/evidence', { question: q.value }) }, 'Show sources only'))), out];
  },
  async practice() {
    const out = [];
    try {
      const { questions } = await api('GET', '/api/questions');
      const detail = h('div');
      const open = async (id) => {
        detail.replaceChildren(h('div', { class: 'mut' }, 'Loading…'));
        try {
          const r = await api('GET', `/api/questions/${encodeURIComponent(id)}`);
          if (!r.question) return detail.replaceChildren(resultEl(r));
          const qq = r.question; let hint = 0;
          const ans = h('textarea', { rows: 4, placeholder: 'Your answer' }); const res = h('div'); const hints = h('div');
          detail.replaceChildren(h('div', { class: 'card' }, h('span', { class: 'badge' }, qq.sourceLabel), h('h3', {}, qq.topic), h('p', {}, qq.prompt), h('div', { class: 'mut' }, `${qq.maxMarks} marks · difficulty ${qq.difficulty} · ${qq.skill}`), hints,
            (qq.hints ?? []).length ? h('button', { class: 'btn alt', onclick: () => { if (hint < qq.hints.length) hints.append(h('div', { class: 'banner' }, `Hint ${hint + 1}: ${qq.hints[hint++]}`)); } }, 'Next hint') : null, ans,
            h('div', { class: 'row' },
              h('button', { class: 'btn', onclick: async () => { try { const m = await api('POST', '/api/mark', { questionId: id, answer: ans.value }); res.replaceChildren(markEl(m)); if (m.total != null) await api('POST', '/api/progress/attempt', { questionId: id, syllabusRefs: qq.syllabusRefs, score: m.total, max: m.max, hintsUsed: hint }); } catch (e) { res.replaceChildren(err(e)); } } }, 'Mark (indicative)'),
              h('button', { class: 'btn alt', onclick: async () => { try { res.replaceChildren(resultEl(await api('POST', `/api/questions/${encodeURIComponent(id)}/reveal`, {}))); } catch (e) { res.replaceChildren(err(e)); } } }, 'Reveal model answer'),
              reportBtn('question', id)), res));
        } catch (e) { detail.replaceChildren(err(e)); }
      };
      out.push(h('div', { class: 'card' }, h('h3', {}, 'Verified practice questions'), h('div', { class: 'mut' }, 'AI-generated recall questions. They are not ACCA questions and marks are indicative only.'),
        h('select', { onchange: (ev) => ev.target.value && open(ev.target.value) }, h('option', { value: '' }, 'Choose a question…'), questions.map((x) => h('option', { value: x.id }, `${x.id} · ${x.topic}`)))), detail);
    } catch (e) { out.push(err(e)); }
    return out;
  },
  async syllabus() {
    try {
      const m = await api('GET', '/api/coverage'); const s = m.summary;
      return [h('div', { class: 'card' }, h('h3', {}, 'Coverage'), h('div', {}, `Learning outcomes: ${s.totalLearningOutcomes} · syllabus scope verified: ${s.syllabusScopeVerified}`), h('div', {}, `With a verified technical lesson: ${s.withVerifiedTechnicalLesson} · with a verified question: ${s.withVerifiedScoredQuestion}`), h('div', { class: 'banner warn' }, s.coverageClaim)),
        h('div', { class: 'card' }, h('table', {}, h('tr', {}, h('th', {}, 'LO'), h('th', {}, 'Outcome'), h('th', {}, 'Status')), m.rows.map((r) => h('tr', {}, h('td', {}, r.id), h('td', {}, r.outcome), h('td', {}, r.contentStatus)))))];
    } catch (e) { return [err(e)]; }
  },
  async sources() {
    try {
      const s = await api('GET', '/api/status'); const a = await api('GET', '/api/audit/verify');
      return [h('div', { class: 'card' }, h('h3', {}, 'System'), h('div', {}, `Target session: ${s.session.id}`), h('div', {}, `Generator: ${s.generator.name} (${s.generator.available ? 'available' : 'UNAVAILABLE'}${s.generator.isStub ? ', stub' : ''})`), h('div', {}, `Verifier: ${s.verifier.name} (${s.verifier.available ? 'available' : 'UNAVAILABLE'}${s.verifier.isStub ? ', stub' : ''})`), h('div', {}, `IFRS (tier 1) source loaded: ${s.hasTier1Source ? 'yes' : 'NO'}`), h('div', {}, `Audit chain: ${a.ok ? 'intact' : 'BROKEN'} · open error reports: ${s.openErrorReports}`)),
        h('div', { class: 'card' }, h('h3', {}, 'Approved sources'), s.sources.map((x) => h('div', {}, h('b', {}, x.title), h('div', { class: 'mut' }, `${x.id} · tier ${x.tier} · ${x.version} · ${x.status} · sha256 ${x.sha256.slice(0, 12)}…${x.caveat ? ' · ' + x.caveat : ''}`)))),
        h('div', { class: 'card' }, h('h3', {}, 'Not yet supplied'), s.missingSources.map((x) => h('div', {}, h('b', {}, x.id), ` (${x.status}): ${x.description}`, h('div', { class: 'mut' }, `Impact: ${x.impact}`))))];
    } catch (e) { return [err(e)]; }
  },
  async settings() {
    const srv = h('input', { value: store.get('server'), placeholder: 'Server URL (blank = same origin)' });
    const tok = h('input', { type: 'password', value: store.get('token'), placeholder: 'Access token (APP_TOKEN)', autocomplete: 'off' });
    return [h('div', { class: 'card' }, h('h3', {}, 'Connection'), h('div', { class: 'mut' }, 'The access token is stored only in this browser. Never put ACCA or Study Hub credentials here.'), h('label', {}, 'Server'), srv, h('label', {}, 'Access token'), tok, h('button', { class: 'btn', onclick: () => { store.set('server', srv.value.trim()); store.set('token', tok.value.trim()); ping(); alert('Saved'); } }, 'Save'))];
  },
};

let current = 'home';
async function go(tab) { current = tab; document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab)); show(h('div', { class: 'mut' }, 'Loading…')); show(...(await screens[tab]())); }
function markEl(m) {
  if (m.outcome && m.outcome !== 'marked' && !m.points) return resultEl(m);
  return h('div', {}, h('div', { class: 'banner warn' }, m.label), h('div', {}, h('b', {}, `${m.total} / ${m.max}`), ` · ${m.mode}`), m.markerNote ? h('div', { class: 'mut' }, m.markerNote) : null,
    m.points.map((p) => h('div', { class: 'card' }, h('span', { class: 'badge' }, p.judgement), `${p.text} (${p.awarded}/${p.marks})`, p.evidence ? h('blockquote', {}, `Your words: “${p.evidence}”`) : null, p.flag ? h('div', { class: 'mut' }, p.flag) : null)),
    m.feedback ? Object.entries(m.feedback).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => h('div', { class: 'card' }, h('b', {}, k.replace(/([A-Z])/g, ' $1').toLowerCase()), h('ul', {}, v.map((x) => h('li', {}, String(x)))))) : null);
}
async function ping() { const c = $('#conn'); try { await api('GET', '/api/health'); c.textContent = 'connected'; } catch { c.textContent = 'offline'; } }
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab).catch((e) => show(err(e)))));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
ping(); go(store.get('token') ? 'home' : 'settings').catch((e) => show(err(e)));
