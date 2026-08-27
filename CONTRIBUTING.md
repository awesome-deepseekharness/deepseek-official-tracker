# Contributing

Thanks for helping make this DeepSeek tracker more complete and reliable!

## How to contribute

1. **Report a missed update** — Open an Issue with link to official source (`api-docs.deepseek.com`, `deepseek.com`, `github.com/deepseek-ai`, `huggingface.co/deepseek-ai`, `npmjs.com/package/@deepseek-ai/dsh`). We aim to cover within 6h.
2. **Fix a parser** — `scripts/track.mjs` is vanilla Node.js (no deps). Test locally: `node scripts/track.mjs` (set `GITHUB_TOKEN` for higher rate limits). Ensure `data/state.json` deduping still works.
3. **Add a repo to track** — Edit `OFFICIAL_REPOS` in `scripts/track.mjs`. Only active `deepseek-ai/*` repos; avoid forks/archives.
4. **Docs/SEO** — README improvements welcome, keep bilingual `README.md` / `README.zh.md` in sync.

## Development

```bash
git clone https://github.com/awesome-deepseekharness/deepseek-official-tracker
cd deepseek-official-tracker
node scripts/track.mjs           # dry run, appends to *.md if new items
git diff                         # review
```

No `npm install` needed. Node 22+.

## PR checklist

- [ ] `node scripts/track.mjs` passes locally (or explain rate-limit 403 is expected without token)
- [ ] No duplicate entries in `FEED.md` / `data/state.json` deduped via `Set`
- [ ] Dates are `YYYY-MM-DD` or `n/a` (validated by `isValidDate`)
- [ ] README.md and README.zh.md updated together if user-facing

## Code style

- Keep fetch retry/backoff logic for robustness
- Keep `state.json` append-only but deduped
- Use `sleep(300ms)` between paginated fetches to respect rate limits
