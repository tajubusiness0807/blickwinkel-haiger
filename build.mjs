#!/usr/bin/env node
// Baut die statischen Seiten aus _src/ zusammen – ohne Abhängigkeiten.
//
//   node build.mjs
//
// Jede Datei in _src/pages/ wird mit _src/layout.html zu einer fertigen
// HTML-Datei im Projektordner (z. B. _src/pages/sehanalyse.html -> sehanalyse.html).
//
// Platzhalter:
//   {{> name}}          bindet _src/partials/name.html (oder .svg) ein
//   {{site.key}}        Wert aus SITE (unten)
//   {{page.key}}        Wert aus dem Seitenkopf <!--{ ... }-->
//   {{current:key}}     wird zu aria-current="page", wenn page.nav === key

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, '_src');

// Zentrale Geschäftsdaten – hier ändern, dann `node build.mjs` ausführen.
export const SITE = {
  url: 'https://www.blickwinkel-haiger.de',
  name: 'Blickwinkel',
  fullName: 'Blickwinkel – Moderne Augenoptik & Kontaktlinsen',
  owner: 'Tim Hofmeister',
  street: 'Hinterm Graben 4',
  zip: '35708',
  city: 'Haiger',
  phone: '02773 912303',
  phoneHref: '+492773912303',
  email: 'info@blickwinkel-haiger.de',
  careerEmail: 'karriere@blickwinkel-haiger.de',
  rating: '4,9',
  reviewCount: '66',
  googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJtQYaeg0WvEcRNYZCJio4-48',
  googleReviewsUrl: 'https://search.google.com/local/reviews?placeid=ChIJtQYaeg0WvEcRNYZCJio4-48',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Blickwinkel+Augenoptik+Hinterm+Graben+4+35708+Haiger',
  mapsEmbed: 'https://www.google.com/maps?q=Blickwinkel+Augenoptik,+Hinterm+Graben+4,+35708+Haiger&output=embed',
  lensAboUrl: 'http://www.kontaktlinse-sorglos.de/blickwinkel-haiger',
  year: String(new Date().getFullYear()),
};

const read = (p) => readFileSync(p, 'utf8');

function partial(name) {
  for (const ext of ['.html', '.svg']) {
    const p = join(SRC, 'partials', name + ext);
    if (existsSync(p)) return read(p);
  }
  throw new Error(`Partial nicht gefunden: ${name}`);
}

function render(tpl, page, depth = 0) {
  if (depth > 10) throw new Error('Partials zu tief verschachtelt');
  let out = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => render(partial(n), page, depth + 1));
  out = out.replace(/\{\{current:([\w-]+)\}\}/g, (_, key) => (page.nav === key ? 'aria-current="page"' : ''));
  out = out.replace(/\{\{(site|page)\.([\w]+)\}\}/g, (m, scope, key) => {
    const src = scope === 'site' ? SITE : page;
    if (!(key in src)) throw new Error(`Unbekannter Platzhalter ${m} in ${page.file}`);
    return src[key];
  });
  return out;
}

const layout = read(join(SRC, 'layout.html'));
const pages = readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const sitemap = [];

for (const file of pages) {
  const raw = read(join(SRC, 'pages', file));
  const m = raw.match(/^<!--(\{[\s\S]*?\})-->\s*/);
  if (!m) throw new Error(`Seitenkopf fehlt in ${file}`);
  const meta = JSON.parse(m[1]);
  const slug = file.replace(/\.html$/, '');
  const page = {
    file,
    nav: '',
    bodyClass: '',
    robots: 'index,follow',
    extraHead: '',
    canonical: SITE.url + '/' + (slug === 'index' ? '' : slug),
    ...meta,
  };
  page.content = render(raw.slice(m[0].length), page);
  const html = render(layout.replace('{{page.content}}', '\u0000CONTENT\u0000'), page)
    .replace('\u0000CONTENT\u0000', page.content);
  writeFileSync(join(ROOT, file), html);
  if (page.robots.startsWith('index')) sitemap.push(page.canonical);
  console.log('✓', file);
}

writeFileSync(
  join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .sort()
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`
);
console.log('✓ sitemap.xml');
