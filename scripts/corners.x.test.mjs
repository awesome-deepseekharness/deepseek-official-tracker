import { stripHtml } from './corners.mjs';

// Captured live from Firecrawl scrape of https://x.com/deepseek_ai on 2026-10-01.
// Verbatim Firecrawl output, including its backslash escaping of - and .
const FIXTURE = String.raw`### 1. Post
Posted: 2026\-09\-10T06:10:09\.000Z
URL: [https://x\.com/deepseek\_ai/status/2097930608790167907](https://x.com/deepseek_ai/status/2097930608790167907)

> 🚀 Introducing DeepSeek-V4.1-Flash: smarter, faster, more efficient.
>
> 🔹 Introducing the smallest model in our new architecture family, with native visual understanding.

Likes: 28,578 | Retweets: 3,086

### 2. Post
Posted: 2026\-08\-21T09:17:38\.000Z
URL: [https://x\.com/deepseek\_ai/status/2090730032574631962](https://x.com/deepseek_ai/status/2090730032574631962)

> DeepSeek-V4-Flash-Vision-Exp is now live on the API.

Likes: 9,102 | Retweets: 611
`;

function parse(md) {
  const out = [];
  for (const raw of md.split(/###\s*\d+\.\s*Post/).slice(1)) {
    const post = raw.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1');
    const url = ((post.match(/URL:\s*\[([^\]]*)\]\((https:\/\/x\.com\/[^)]+)\)/) || [])[2])
      || ((post.match(/https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+/) || [])[0]);
    const posted = (post.match(/Posted:\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
    const quoted = [...post.matchAll(/^>\s?(.*)$/gm)].map(m => m[1]).join(' ').trim();
    const engagement = (post.match(/Likes:\s*([\d,]+)\s*\|\s*Retweets:\s*([\d,]+)/) || []);
    const body = stripHtml(quoted).replace(/\s+/g, ' ').trim();
    if (!url) continue;
    out.push({
      id: `x:${url.match(/status\/(\d+)/)?.[1] || url.slice(-24)}`,
      date: posted,
      url,
      title: body.slice(0, 80),
      likes: engagement[1] || null,
    });
  }
  return out;
}

const got = parse(FIXTURE);
const want = [
  { id: 'x:2097930608790167907', date: '2026-09-10', likes: '28,578' },
  { id: 'x:2090730032574631962', date: '2026-08-21', likes: '9,102' },
];

let fail = 0;
for (const [i, w] of want.entries()) {
  const g = got[i];
  const ok = g && g.id === w.id && g.date === w.date && g.likes === w.likes
    && g.url.includes(`/status/${w.id.split(':')[1]}`)
    && g.title.length > 0 && !g.title.includes('(no text)');
  if (!ok) { fail++; console.log(`FAIL post ${i + 1}`, { got: g, want: w }); }
  else console.log(`ok  post ${i + 1}  ${g.date}  ${g.likes} likes  "${g.title.slice(0, 46)}…"`);
}
if (got.length !== 2) { fail++; console.log(`FAIL expected 2 posts, got ${got.length}`); }
console.log(fail ? `\n${fail} failure(s)` : '\nx-timeline parser OK');
process.exit(fail ? 1 : 0);
