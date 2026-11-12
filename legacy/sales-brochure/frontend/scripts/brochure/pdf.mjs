// Export Merino Court's sales brochure to A4 PDF (print stylesheet). Needs `npm run dev` running.
//   node scripts/brochure/pdf.mjs merino-sales      → public/merino-court/brochure/Merino-Court-sales-brochure.pdf
//   node scripts/brochure/pdf.mjs merino-zh-sales   …in Chinese → Merino-Court-sales-brochure-zh.pdf
//   node scripts/brochure/pdf.mjs out.pdf [url]
import { BASE, launch } from './browser.mjs';
const arg = process.argv[2];
// Merino Court's sales brochure (/merino-court/brochure/sales and /zh/sales)
const MERINO = {
  'merino-sales': ['Merino-Court-sales-brochure.pdf', '/sales'],
  'merino-zh-sales': ['Merino-Court-sales-brochure-zh.pdf', '/zh/sales'],
};
const ed = MERINO[arg];
const out = ed ? new URL(`../../public/merino-court/brochure/${ed[0]}`, import.meta.url).pathname : arg;
const url = process.argv[3] || `${BASE}${ed ? ed[1] : ''}`;
const b = await launch();
const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
await p.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
await p.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
});
await p.emulateMedia({ media: 'print' });
await p.waitForTimeout(800);
await p.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
console.log(out);
await b.close();
