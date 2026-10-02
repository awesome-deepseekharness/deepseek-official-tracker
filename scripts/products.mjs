import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const PRODUCT_URL = 'https://www.deepseek.com/harness/';
const clean = value => value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

export function parseProduct(html) {
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  if (!/harness/i.test(title)) throw new Error('Harness product page has no expected title');
  const summary = clean(html.match(/<meta[^>]*(?:name|property)="(?:description|og:description)"[^>]*content="([^"]*)"/i)?.[1] || '');
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => clean(m[1]));
  const links = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
    .filter(url => /\.(?:dmg|exe|msi|deb|AppImage|zip)(?:\?|$)|deepseek-harness|@deepseek-ai/.test(url)))].sort();
  const published = html.match(/(?:property="article:published_time"|name="datePublished")\s+content="(\d{4}-\d{2}-\d{2})/i)?.[1] || null;
  const fingerprint = createHash('sha256').update(JSON.stringify({ title, summary, headings, links })).digest('hex');
  return { title, summary, headings, links, published, fingerprint, url: PRODUCT_URL };
}

export async function trackProducts({ root, fetchText, now = new Date().toISOString() }) {
  const file = path.join(root, 'data', 'products.json');
  let previous = {};
  try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  const current = parseProduct(await fetchText(PRODUCT_URL));
  if (previous.harness?.fingerprint === current.fingerprint) return 0;
  const entry = { ...current, firstObservedAt: previous.harness?.firstObservedAt || now, observedAt: now };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ harness: entry }, null, 2)}\n`);
  const date = now.slice(0, 10);
  const note = previous.harness ? 'page change observed / 页面变化观测' : 'first observed / 首次观测';
  const mdFile = path.join(root, 'product-news.md');
  const prior = fs.existsSync(mdFile) ? fs.readFileSync(mdFile, 'utf8').replace(/^# [^\n]+\r?\n/, '').trim() : '';
  const body = `## [${date}] ${current.title} (${note})\n\n${current.summary}\n\n` +
    `Observation date / 观测日期: ${date}. ${current.published ? `Upstream publication date: ${current.published}.` : 'The page does not state a publication date; this is not a release date. 官方页面未注明发布日期，此日期不代表发布日。'}\n\n` +
    `[Source](${PRODUCT_URL})\n\n---\n`;
  fs.writeFileSync(mdFile, `# Official Product Pages — 官网产品动态\n\n${body}${prior ? `\n${prior}\n` : ''}`);
  return 1;
}
