#!/usr/bin/env node
// Builds the local chunk store (data/corpus/*.json) from raw source files listed in sources/registry.json.
// Raw files and the corpus are gitignored (protected third-party content). Re-run after any source change.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, normText } from '../engine/util.js';
import { flagChunk } from '../engine/corpus.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(`${root}/sources/registry.json`, 'utf8'));
mkdirSync(`${root}/data/corpus`, { recursive: true });

// Known PDF font artefact: the 'ff' ligature glyph is extracted as U+01AF in ACCA PDFs. Logged below.
const FIXES = [[/Ư/g, 'ff']];
const MAX_CHARS = 900;

function pageCount(pdf) {
  const out = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  return Number(out.match(/Pages:\s+(\d+)/)[1]);
}

function splitParagraphs(text) {
  const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const merged = [];
  for (const p of paras) {
    if (merged.length && (merged.at(-1).length < 80 || p.length < 40)) merged[merged.length - 1] += ' ' + p;
    else merged.push(p);
  }
  const out = [];
  for (const p of merged) {
    if (p.length <= MAX_CHARS) { out.push(p); continue; }
    let cur = '';
    for (const s of p.split(/(?<=[.;:])\s+/)) {
      if ((cur + ' ' + s).length > MAX_CHARS && cur) { out.push(cur.trim()); cur = s; } else cur += ' ' + s;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

function ocrPage(file, page) {
  // Image-only page: rasterise and OCR. OCR text is flagged so the UI tells the learner to verify against the PDF page.
  const dir = mkdtempSync(`${tmpdir()}/ocr-`);
  try {
    execFileSync('pdftoppm', ['-r', '300', '-f', String(page), '-l', String(page), '-png', file, `${dir}/p`]);
    const img = `${dir}/p-${String(page).padStart(2, '0')}.png`;
    const alt = `${dir}/p-${page}.png`;
    const use = existsSync(img) ? img : existsSync(alt) ? alt : `${dir}/p-${String(page).padStart(3, '0')}.png`;
    return execFileSync('tesseract', [use, '-', '--psm', '3'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

let failed = false;
const log = [];
for (const src of registry.sources) {
  const file = `${root}/${src.file}`;
  if (!existsSync(file)) { log.push(`SKIP ${src.id}: raw file absent (${src.file})`); continue; }
  const actual = sha256(readFileSync(file));
  if (actual !== src.sha256) {
    console.error(`HASH MISMATCH for ${src.id}: registry ${src.sha256}, file ${actual}. Refusing to ingest. Update the registry deliberately (new version) if the source legitimately changed.`);
    failed = true; continue;
  }
  const n = pageCount(file);
  const chunks = [];
  let fixCount = 0;
  for (let page = 1; page <= n; page++) {
    let text = execFileSync('pdftotext', ['-f', String(page), '-l', String(page), file, '-'], { encoding: 'utf8' });
    let extraction = 'text-layer';
    if (text.replace(/\s/g, '').length < 40) { text = ocrPage(file, page); extraction = 'ocr'; }
    for (const [re, rep] of FIXES) { const m = text.match(re); if (m) fixCount += m.length; text = text.replace(re, rep); }
    text = text.normalize('NFKC');
    splitParagraphs(text).forEach((t, i) => {
      if (normText(t).length < 15) return;
      chunks.push({ chunkId: `${src.id}:p${page}:c${i + 1}`, page, text: t, textHash: sha256(t), extraction, flags: flagChunk(t) });
    });
  }
  writeFileSync(`${root}/data/corpus/${src.id}.json`, JSON.stringify({ sourceId: src.id, sourceSha256: src.sha256, ingestedAt: new Date().toISOString(), pages: n, chunks }, null, 1));
  log.push(`OK ${src.id}: ${n} pages, ${chunks.length} chunks, ${fixCount} glyph fixes, ${chunks.filter((c) => c.flags.length).length} flagged, ${chunks.filter((c) => c.extraction === 'ocr').length} OCR chunks`);
}
console.log(log.join('\n'));
if (failed) process.exit(1);
