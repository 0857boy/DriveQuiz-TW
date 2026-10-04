// Build-time conversion only. The website never parses PDFs in the browser.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getDocument, OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';

const pdf = await getDocument({
  data: new Uint8Array(readFileSync('題庫pdf/115_5_29.pdf')),
  useSystemFonts: true,
}).promise;
mkdirSync('public/questions', { recursive: true });
mkdirSync('public/images/questions', { recursive: true });
const records = [];
let current,
  structure = '',
  category = '';
const clean = (s) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/([\u3400-\u9fff]) (?=[\u3400-\u9fff])/g, '$1')
    .trim();
const tagWords = [
  '酒駕',
  '酒測',
  '手機',
  'ADAS',
  '安全距離',
  '內輪差',
  '視野死角',
  '行人',
  '方向燈',
  '停車',
  '平交道',
  '高速公路',
  '輪胎',
  '煞車',
  '路口',
  '超車',
  '安全帶',
  '事故',
  '號誌',
  '標線',
];

for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent();
  const items = content.items.filter((i) => typeof i.str === 'string');
  const headers = items.filter((i) => i.str === '題號').map((i) => i.transform[5]);
  const rows = [];
  const headings = new Map();
  for (const i of items.filter(
    (i) => i.height >= 12.5 && i.transform[5] > 50 && i.transform[5] < 790,
  )) {
    const key = Math.round(i.transform[5]);
    if (!headings.has(key)) headings.set(key, []);
    headings.get(key).push(i);
  }
  const handled = new Set();
  for (const item of items) {
    const { str, height } = item;
    const x = item.transform[4],
      y = item.transform[5];
    if (!str.trim() || y < 50 || y > 790) continue;
    if (height >= 12.5) {
      const key = Math.round(y);
      if (handled.has(key)) continue;
      handled.add(key);
      const line = clean(
        headings
          .get(key)
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map((i) => i.str)
          .join(' '),
      );
      if (line.startsWith('架構')) {
        structure = line.replace(/^架構[一二三四]\s*/, '');
        category = '';
      } else if (line !== '新版汽車筆試題庫')
        category = line
          .replace(/^分類\s*/, '')
          .replace(/（.*$/, '')
          .trim();
      continue;
    }
    if (headers.some((h) => Math.abs(y - h) < 13)) continue;
    if (x < 95 && /^\d+$/.test(str) && Number(str) === records.length + 1) {
      current = {
        id: Number(str),
        sourceVersion: '115.5.29',
        structure,
        category,
        sourcePage: n,
        body: '',
        answerText: '',
        images: [],
      };
      records.push(current);
      rows.push({ q: current, y });
      continue;
    }
    if (!current) continue;
    if (height > 10.5 && x >= 94 && x < 132) {
      current.answerText += str;
      continue;
    }
    if (x >= 118 && height < 10.7) current.body += str;
  }
  const ops = await page.getOperatorList();
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [],
    bounds = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i],
      args = ops.argsArray[i];
    if (fn === OPS.save) stack.push([...matrix]);
    else if (fn === OPS.restore) matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) matrix = Util.transform(matrix, args);
    else if ([OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(fn)) {
      const points = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map((p) => {
        Util.applyTransform(p, matrix);
        return p;
      });
      const b = {
        x: Math.min(...points.map((p) => p[0])),
        y: Math.min(...points.map((p) => p[1])),
        right: Math.max(...points.map((p) => p[0])),
        top: Math.max(...points.map((p) => p[1])),
      };
      if (b.x > 115 && b.y > 50 && rows.length) {
        const row = [...rows].sort(
          (a, b2) => Math.abs(a.y - (b.y + b.top) / 2) - Math.abs(b2.y - (b.y + b.top) / 2),
        )[0];
        if (Math.abs(row.y - (b.y + b.top) / 2) > 75)
          throw new Error(`Ambiguous image on page ${n}`);
        bounds.push({ ...b, q: row.q });
      }
    }
  }
  if (bounds.length) {
    const scale = 3,
      viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
    const buffer = canvas.toBuffer('image/png');
    for (const q of new Set(bounds.map((b) => b.q))) {
      const group = bounds.filter((b) => b.q === q);
      // Composite option images embed labels 2/3; label 1 is often PDF text just
      // outside the bitmap. Include that original label without the answer column.
      const minX = Math.min(...group.map((b) => b.x)),
        minY = Math.min(...group.map((b) => b.y)),
        maxY = Math.max(...group.map((b) => b.top));
      if (Math.max(...group.map((b) => b.right)) - minX > 150) {
        const labelLines = new Map();
        for (const item of items.filter(
          (i) =>
            i.height < 10.7 &&
            i.transform[4] >= 118 &&
            i.transform[4] < minX &&
            i.transform[5] >= minY - 4 &&
            i.transform[5] <= maxY,
        )) {
          const key = Math.round(item.transform[5]);
          if (!labelLines.has(key)) labelLines.set(key, []);
          labelLines.get(key).push(item);
        }
        const label = [...labelLines.values()].find((line) =>
          /[（(]\s*[１1]\s*[）)]/.test(line.map((i) => i.str).join('')),
        );
        if (label)
          group.push({
            x: Math.min(...label.map((i) => i.transform[4])),
            y: Math.min(...label.map((i) => i.transform[5])) - 3,
            right: Math.max(...label.map((i) => i.transform[4] + i.width)),
            top: Math.max(...label.map((i) => i.transform[5] + i.height)),
          });
      }
      const left = Math.max(0, Math.floor(Math.min(...group.map((b) => b.x)) * scale) - 2);
      const top = Math.max(
        0,
        Math.floor(viewport.height - Math.max(...group.map((b) => b.top)) * scale) - 2,
      );
      const width = Math.min(
        canvas.width - left,
        Math.ceil(Math.max(...group.map((b) => b.right)) * scale) - left + 2,
      );
      const bottom = Math.ceil(viewport.height - Math.min(...group.map((b) => b.y)) * scale) + 2;
      const path = `images/questions/q${q.id}.webp`;
      await sharp(buffer)
        .extract({ left, top, width, height: Math.min(canvas.height - top, bottom - top) })
        .webp({ quality: 92 })
        .toFile(`public/${path}`);
      q.images.push(path);
    }
  }
}

const questions = records.map((r) => {
  const normalized = clean(r.body).replace(
    /[（(]\s*([１２３123])\s*[）)]/g,
    (_, num) => `(${num.normalize('NFKC')})`,
  );
  const matches = [...normalized.matchAll(/\(([123])\)/g)];
  // Start at the first consecutive 1, 2, 3 option sequence; reject ambiguous data.
  const first = matches.findIndex(
    (m, i) => m[1] === '1' && matches[i + 1]?.[1] === '2' && matches[i + 2]?.[1] === '3',
  );
  if (first < 0) throw new Error(`Missing options for #${r.id}: ${normalized}`);
  const markers = matches.slice(first, first + 3);
  const choices = markers.map((m, i) => ({
    id: Number(m[1]),
    text: normalized
      .slice(m.index + m[0].length, markers[i + 1]?.index ?? normalized.length)
      .trim(),
  }));
  if (r.images.length && choices.every((c) => !c.text.replace(/[。．.]/g, '').trim())) {
    choices.forEach((c) => {
      c.text = `圖中選項 ${c.id}`;
    });
    console.log(`Image-only choices: #${r.id}`);
  }
  const answer = Number(r.answerText.replace(/\D/g, ''));
  if (![1, 2, 3].includes(answer) || choices.some((c) => !c.text) || !r.structure || !r.category)
    throw new Error(`Invalid #${r.id}: ${JSON.stringify(r)}`);
  if (r.images.length > 1) throw new Error(`Multiple image pages for #${r.id}, needs review`);
  const question =
    normalized.slice(0, markers[0].index).trim() || '這個交通標誌／標線代表什麼意思？';
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        question,
        choices,
        answer,
        image: r.images[0]
          ? createHash('sha256')
              .update(readFileSync(`public/${r.images[0]}`))
              .digest('hex')
          : '',
      }),
    )
    .digest('hex')
    .slice(0, 16);
  return {
    id: r.id,
    sourceVersion: r.sourceVersion,
    structure: r.structure,
    category: r.category,
    type: r.images.length ? 'image' : 'text',
    question,
    choices,
    answer,
    ...(r.images.length ? { image: r.images[0] } : {}),
    tags: tagWords.filter((t) => normalized.includes(t)),
    sourcePage: r.sourcePage,
    fingerprint,
  };
});
if (questions.length !== 1090) throw new Error(`Expected 1090 questions, got ${questions.length}`);
writeFileSync(
  'public/questions/questions.json',
  JSON.stringify({ version: '115.5.29', source: '題庫pdf/115_5_29.pdf', questions }, null, 2),
);
console.log(
  `Built ${questions.length} questions, ${questions.filter((q) => q.image).length} image questions.`,
);
console.log('Categories:', [...new Set(questions.map((q) => q.category))]);
