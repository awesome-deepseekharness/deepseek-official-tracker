// Refined: the 8px overflow at 390px had no element whose border box crossed the
// viewport, which means it comes from something getBoundingClientRect does not
// account for — margins, an element's own scrollWidth, or a pseudo-element. This
// checks all three, and includes html/body so the culprit is named rather than
// inferred.
const doc = document.documentElement;
const clientWidth = doc.clientWidth;
const out = [];
const note = [];

if (doc.scrollWidth > clientWidth + 1) note.push(`html scrollWidth ${doc.scrollWidth} > ${clientWidth}`);
if (document.body.scrollWidth > clientWidth + 1) note.push(`body scrollWidth ${document.body.scrollWidth} > ${clientWidth}`);

const describe = el => {
  let sel = el.tagName.toLowerCase();
  if (el.id) sel += `#${el.id}`;
  const cls = (typeof el.className === 'string' ? el.className : '')
    .trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
  if (cls) sel += `.${cls}`;
  return sel;
};

for (const el of document.querySelectorAll('html, body, body *')) {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();

  // 1. border box past the right edge
  const overBox = r.right - clientWidth;
  // 2. right margin pushing past the edge (invisible to getBoundingClientRect)
  const overMargin = parseFloat(cs.marginRight) || 0;
  // 3. internal overflow: content wider than the box (nowrap text, min track)
  const overInner = el.scrollWidth - el.clientWidth;

  const reasons = [];
  if (overBox > 1) reasons.push(`box +${Math.round(overBox)}px`);
  if (overMargin > 1) reasons.push(`margin-right ${Math.round(overMargin)}px`);
  if (overInner > 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') reasons.push(`inner +${overInner}px`);

  if (reasons.length) out.push({ sel: describe(el), why: reasons.join(', '), worst: Math.round(Math.max(overBox, overMargin, overInner)), width: Math.round(r.width) });
}
out.sort((a, b) => b.worst - a.worst);

return { clientWidth, scrollWidth: doc.scrollWidth, note, overflowing: out.slice(0, 16) };