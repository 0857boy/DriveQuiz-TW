import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
const pdf = await getDocument({
  data: new Uint8Array(readFileSync('題庫pdf/115_5_29.pdf')),
  useSystemFonts: true,
}).promise;
mkdirSync('tmp/pdfs', { recursive: true });
console.log('Pages', pdf.numPages);
for (const n of [1, 2, 3, 8, 20, 79]) {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent();
  console.log(
    'PAGE',
    n,
    content.items
      .slice(0, 65)
      .map((x) => ({
        text: x.str,
        x: Math.round(x.transform[4]),
        y: Math.round(x.transform[5]),
        w: Math.round(x.width),
      })),
  );
  if ([1, 8].includes(n)) {
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = createCanvas(viewport.width, viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
    writeFileSync(`tmp/pdfs/page-${n}.png`, canvas.toBuffer('image/png'));
  }
}
