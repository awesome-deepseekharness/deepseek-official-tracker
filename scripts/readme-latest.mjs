// Select across every first-party feed. A quiet model blog must not hide a
// newer Harness/package release. Keep upstream titles and publication dates.
export function buildHighlights(sources) {
  const entries = Object.entries(sources).flatMap(([source, rows]) =>
    rows.map(row => ({ ...row, source }))
  ).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date));
  const priority = ['products', 'releases', 'npm', 'changelog', 'news', 'website', 'hf'];
  entries.sort((a, b) => b.date.localeCompare(a.date) ||
    priority.indexOf(a.source) - priority.indexOf(b.source) || a.title.localeCompare(b.title));
  if (!entries.length) return null;
  const latest = entries[0];
  const model = entries.find(e => ['changelog', 'news', 'website'].includes(e.source));
  const harness = entries.find(e => e.source === 'releases' && /deepseek-harness/i.test(e.title));
  const channel = entry => entry.source === 'products'
    ? { en: 'Product page observed; publication date may be unknown', zh: '官网产品页观测；观测日期不代表发布日期' }
    : /-(?:rc|alpha|beta|preview)[.\d-]*/i.test(entry.title)
    ? { en: 'Prerelease / preview', zh: '预发布 / 候选版' }
    : ['releases', 'npm'].includes(entry.source)
      ? { en: 'Version published; see upstream status', zh: '已发布版本；稳定状态以上游为准' }
      : { en: 'Official update', zh: '官方更新' };
  const history = [];
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.date}|${entry.url || entry.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    history.push(entry);
    if (history.length === 8) break;
  }
  const link = entry => entry.url ? `[${entry.title}](${entry.url})` : entry.title;
  const blocks = {};
  for (const lang of ['en', 'zh']) {
    const zh = lang === 'zh';
    const lines = [
      `## 🔥 ${zh ? '最新' : 'Latest'} — ${latest.title} (${latest.date})`, '',
      `**${channel(latest)[lang]}** · ${link(latest)}`, '',
      ...(latest.summary ? [latest.summary.replace(/\s+/g, ' ').slice(0, 320), ''] : []),
      ...(harness ? [`- **Harness:** ${harness.date} · ${link(harness)} · ${channel(harness)[lang]}`] : []),
      ...(model ? [`- **${zh ? '最近模型 / API 公告' : 'Latest model / API announcement'}:** ${model.date} · ${link(model)}`] : []),
      `- **${zh ? '完整官方记录' : 'All official updates'}:** [FEED.md](FEED.md) · [GitHub releases](releases.md) · [npm](npm.md)`,
      `- **${zh ? '媒体、社区与疑似消息（非官方）' : 'Media, community & rumours (unverified)'}:** [SIGNALS.md](SIGNALS.md) · [Insights](insights.md)`, '', '',
    ];
    blocks[lang] = {
      latest: lines.join('\n'),
      details: `<details>\n<summary>${zh ? '近期官方更新' : 'Recent official updates'}</summary>\n\n${history.map(e => `- **${e.date}** ${link(e)}`).join('\n')}\n</details>`,
    };
  }
  return blocks;
}
