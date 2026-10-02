import { parseProduct, PRODUCT_URL } from './products.mjs';

const SOURCES = [
  PRODUCT_URL,
  'https://api.github.com/repos/deepseek-ai/deepseek-harness/releases?per_page=3',
  'https://registry.npmjs.org/-/package/@deepseek-ai/dsh/dist-tags',
  'https://raw.githubusercontent.com/deepseek-ai/DeepGEMM-Ascend/main/README.md',
  'https://raw.githubusercontent.com/deepseek-ai/DeepEP-Ascend/main/README.md',
];

// These fixed first-party URLs come from main, never from executable PR input.
// Fetch once per review so model fallback need not rediscover platform links
// hidden by reader views or download enormous release/package histories.
export async function collectReviewEvidence(fetchImpl = fetch) {
  return Promise.all(SOURCES.map(async url => {
    const fetchedAt = new Date().toISOString();
    try {
      const response = await fetchImpl(url, {
        headers: { 'User-Agent': 'deepseek-official-tracker', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.text();
      let content;
      if (url === PRODUCT_URL) {
        content = {
          ...parseProduct(raw),
          text: raw.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000),
        };
      } else if (url.includes('/releases?')) {
        content = JSON.parse(raw).map(({ tag_name, published_at, prerelease, html_url, body }) =>
          ({ tag_name, published_at, prerelease, html_url, body: (body || '').slice(0, 6000) }));
      } else if (url.endsWith('/dist-tags')) {
        content = JSON.parse(raw);
      } else {
        content = raw.slice(0, 24000);
      }
      return { url, fetchedAt, content, note: 'Live source content, possibly excerpted. fetchedAt is observation time, not publication time.' };
    } catch (error) {
      return { url, fetchedAt, error: error.message };
    }
  }));
}
