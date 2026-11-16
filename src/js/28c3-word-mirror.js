/* =====================================================================
   Word مطابق للمعاينة: يُرسم المستند نفسه خارج الشاشة، ثم يُحوَّل كل عنصر
   إلى ما يفهمه Word مع نسخ ألوانه وخطوطه وحدوده وحشوه الفعلية:
   الصفوف المرنة والشبكات ← جداول، والرسوم SVG ← صور، والصور تُضمَّن داخل
   الملف (MHTML) فتظهر الشعارات. النص يبقى قابلًا للتعديل.
   ===================================================================== */
const WM_FONT = "'IBM Plex Sans Arabic','Expo Arabic','Segoe UI','Sakkal Majalla',Arial,sans-serif";
const wmPt = (px) => `${Math.max(0, Math.round(parseFloat(px || 0) * 0.75 * 10) / 10)}pt`;
const wmHasColor = (c) => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
function wmBg(cs) {
  if (wmHasColor(cs.backgroundColor)) return cs.backgroundColor;
  const m = (cs.backgroundImage || '').match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i);
  return m && wmHasColor(m[1]) ? m[1] : '';
}
/* rgba ← لون صلب ممزوج بالأبيض (Word لا يدعم الشفافية) */
function wmSolid(c, under = [255, 255, 255]) {
  const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return c;
  const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
  const mix = (v, u) => Math.round(v * a + u * (1 - a));
  return `rgb(${mix(r, under[0])},${mix(g, under[1])},${mix(b, under[2])})`;
}
const wmRGB = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').slice(0, 3).map((x) => parseFloat(x)) : [255, 255, 255]; };
function wmBorders(cs) {
  return ['Top', 'Right', 'Bottom', 'Left'].map((s) => {
    const w = parseFloat(cs[`border${s}Width`]), st = cs[`border${s}Style`], col = cs[`border${s}Color`];
    return w > 0 && st !== 'none' && wmHasColor(col) ? `border-${s.toLowerCase()}:${wmPt(Math.max(w, 0.75))} ${st === 'dashed' || st === 'dotted' ? st : 'solid'} ${wmSolid(col)};` : '';
  }).join('');
}
const wmPad = (cs) => `padding:${wmPt(cs.paddingTop)} ${wmPt(cs.paddingRight)} ${wmPt(cs.paddingBottom)} ${wmPt(cs.paddingLeft)};`;
function wmText(cs, under) {
  const col = wmHasColor(cs.color) ? wmSolid(cs.color, under) : '';
  return `${col ? `color:${col};` : ''}font-size:${wmPt(cs.fontSize)};${+cs.fontWeight >= 600 ? 'font-weight:bold;' : ''}${cs.fontStyle === 'italic' ? 'font-style:italic;' : ''}${cs.textDecorationLine && cs.textDecorationLine.includes('line-through') ? 'text-decoration:line-through;' : ''}`;
}
async function wmToB64(src) {
  if (/^data:/.test(src)) { const m = src.match(/^data:([^;,]+)[^,]*,(.*)$/); if (!m) return null; return /;base64/.test(src.slice(0, src.indexOf(','))) ? { mime: m[1], b64: m[2] } : { mime: m[1], b64: btoa(unescape(encodeURIComponent(decodeURIComponent(m[2])))) }; }
  try { const bl = await (await fetch(src)).blob(); const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(bl); }); return { mime: bl.type || 'image/png', b64 }; } catch (_) { return null; }
}
/* SVG ← PNG مع نسخ الألوان المحسوبة لكل عنصر داخله */
async function wmSvgPng(svg, w, h) {
  const cl = svg.cloneNode(true), src = [svg, ...svg.querySelectorAll('*')], dst = [cl, ...cl.querySelectorAll('*')];
  src.forEach((e, i) => { const cs = getComputedStyle(e); ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity'].forEach((p) => { const v = cs.getPropertyValue(p); if (v) dst[i].style.setProperty(p, v); }); if (cs.color) dst[i].style.color = cs.color; });
  cl.setAttribute('width', w); cl.setAttribute('height', h); cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl));
  const im = new Image(); im.src = url; try { await im.decode(); } catch (_) { return null; }
  const k = 2, c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return { mime: 'image/png', b64: c.toDataURL('image/png').split(',')[1] };
}
async function wmConvert(root) {
  const parts = []; const add = (img) => { if (!img) return ''; const name = `img${parts.length + 1}.${img.mime.includes('png') ? 'png' : img.mime.includes('svg') ? 'svg' : 'jpg'}`; parts.push({ name, ...img }); return name; };
  const blockLike = (cs) => /block|flex|grid|table|list-item/.test(cs.display) && !/inline/.test(cs.display);
  async function walk(n, under, pw = 0) {
    if (n.nodeType === 3) return esc(n.textContent).replace(/\n\s*/g, ' ');
    if (n.nodeType !== 1) return '';
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return '';
    const tag = n.tagName.toLowerCase(), r = n.getBoundingClientRect();
    if (tag === 'br') return '<br>';
    if (tag === 'img') { if (!n.src || r.width < 2) return ''; const nm = add(await wmToB64(n.src)); return nm ? `<img src="${nm}" width="${Math.round(r.width)}" height="${Math.round(r.height)}" style="width:${wmPt(r.width)};height:${wmPt(r.height)}">` : ''; }
    if (tag === 'svg') { if (r.width < 2) return ''; const par = n.parentElement; if (par && [...par.children].some((c) => c !== n && getComputedStyle(c).position === 'absolute' && c.textContent.trim())) return ''; const nm = add(await wmSvgPng(n, r.width, r.height)); return nm ? `<img src="${nm}" width="${Math.round(r.width)}" height="${Math.round(r.height)}" style="width:${wmPt(r.width)};height:${wmPt(r.height)}">` : ''; }
    if (cs.position === 'absolute' && !n.textContent.trim() && !n.querySelector('img,svg')) return '';
    const bg = wmBg(cs), bgS = bg ? wmSolid(bg, under) : '', under2 = bgS ? wmRGB(bgS) : under;
    const kids = [...n.childNodes];
    const cw0 = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const inner = async (list) => (await Promise.all(list.map((c) => walk(c, under2, cw0)))).join('');
    const txt = wmText(cs, under2);
    if (!blockLike(cs)) return `<span style="${txt}${bgS ? `background:${bgS};` : ''}">${await inner(kids)}</span>`;
    /* جداول حقيقية: تُحفظ بنيتها */
    if (tag === 'table') {
      const rows = [...n.rows];
      const out = await Promise.all(rows.map(async (tr) => `<tr>${(await Promise.all([...tr.cells].map(async (c) => { const ccs = getComputedStyle(c), cb = wmBg(ccs), cbS = cb ? wmSolid(cb, under2) : ''; const cw = c.getBoundingClientRect().width; return `<td${c.colSpan > 1 ? ` colspan="${c.colSpan}"` : ''}${c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : ''} width="${Math.round(cw / r.width * 100)}%" style="${cbS ? `background:${cbS};` : ''}${wmBorders(ccs)}${wmPad(ccs)}${wmText(ccs, cbS ? wmRGB(cbS) : under2)}text-align:${ccs.textAlign === 'center' ? 'center' : ccs.textAlign === 'left' ? 'left' : 'right'};vertical-align:${ccs.verticalAlign === 'middle' ? 'middle' : 'top'}">${(await Promise.all([...c.childNodes].map((k) => walk(k, cbS ? wmRGB(cbS) : under2)))).join('') || '&nbsp;'}</td>`; }))).join('')}</tr>`));
      return `<table dir="rtl" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:${wmPt(cs.marginTop)} 0 ${wmPt(cs.marginBottom)};${bgS ? `background:${bgS};` : ''}">${out.join('')}</table>`;
    }
    const els = kids.filter((c) => c.nodeType === 1 && getComputedStyle(c).display !== 'none' && !(getComputedStyle(c).position === 'absolute' && !c.textContent.trim() && !c.querySelector('img,svg')));
    const flexRow = /flex/.test(cs.display) && !/column/.test(cs.flexDirection);
    const grid = /grid/.test(cs.display);
    const box = (content) => {
      const deco = bgS || wmBorders(cs) || parseFloat(cs.paddingTop) + parseFloat(cs.paddingRight) > 2;
      const al = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'left' || cs.textAlign === 'end' ? 'left' : 'right';
      if (!deco) return `<div style="${txt}text-align:${al};margin:${wmPt(cs.marginTop)} 0 ${wmPt(cs.marginBottom)}">${content}</div>`;
      const pct = pw && r.width < pw * 0.95 ? Math.max(1, Math.round(r.width / pw * 100)) : 100;
      const emptyBar = !n.textContent.trim() && !n.querySelector('img,svg') && r.height < 16;
      if (emptyBar) return `<table dir="rtl" width="${pct}%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:${pct}%;margin:${wmPt(cs.marginTop)} 0 ${wmPt(cs.marginBottom)}"><tr><td style="${bgS ? `background:${bgS};` : ''}${wmBorders(cs)}height:${wmPt(Math.max(3, r.height))};font-size:1pt;line-height:1pt">&nbsp;</td></tr></table>`;
      return `<table dir="rtl" width="${pct}%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:${pct}%;margin:${wmPt(cs.marginTop)} 0 ${wmPt(cs.marginBottom)}"><tr><td style="${bgS ? `background:${bgS};` : ''}${wmBorders(cs)}${wmPad(cs)}${txt}text-align:${al};vertical-align:top">${content || '&nbsp;'}</td></tr></table>`;
    };
    if (/^h[1-4]$/.test(tag)) {
      const al = cs.textAlign === 'center' ? 'center' : 'right';
      const parts2 = kids.map((c) => { if (c.nodeType === 3) return esc(c.textContent); if (c.nodeType !== 1) return ''; const ccs = getComputedStyle(c); if (ccs.display === 'none') return ''; const cb = wmBg(ccs), cbS = cb ? wmSolid(cb, under2) : ''; return `<span style="${wmText(ccs, cbS ? wmRGB(cbS) : under2)}${cbS ? `background:${cbS};` : ''}">${cbS ? '&nbsp;' : ''}${esc(c.textContent)}${cbS ? '&nbsp;' : ''}</span>&nbsp; `; }).join('');
      return `<p style="${txt}text-align:${al};margin:${wmPt(cs.marginTop)} 0 ${wmPt(cs.marginBottom)};${wmBorders(cs)}${wmPad(cs)}">${parts2}</p>`;
    }
    const directText = kids.some((c) => c.nodeType === 3 && c.textContent.trim());
    if ((flexRow || grid) && els.length > 1 && !directText) {
      /* الصفوف حسب موضع العناصر الفعلي (يغطي الالتفاف والشبكات) */
      const rowsMap = []; els.forEach((c) => { const cr = c.getBoundingClientRect(); let row = rowsMap.find((x) => Math.abs(x.top - cr.top) < Math.max(6, cr.height * 0.5)); if (!row) { row = { top: cr.top, items: [] }; rowsMap.push(row); } row.items.push({ c, cr }); });
      rowsMap.sort((a, b) => a.top - b.top);
      const W = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) || r.width;
      const rowsHTML = await Promise.all(rowsMap.map(async (row) => { row.items.sort((a, b) => b.cr.left - a.cr.left); /* يمين ← يسار */
        const cells = await Promise.all(row.items.map(async ({ c, cr }) => { const ccs = getComputedStyle(c); const cb = wmBg(ccs), cbS = cb ? wmSolid(cb, under2) : ''; const u3 = cbS ? wmRGB(cbS) : under2; const al = ccs.textAlign === 'center' ? 'center' : ccs.textAlign === 'left' ? 'left' : 'right';
          const content = (await Promise.all([...c.childNodes].map((k) => walk(k, u3)))).join('');
          return `<td width="${Math.max(1, Math.round(cr.width / W * 100))}%" style="${cbS ? `background:${cbS};` : ''}${wmBorders(ccs)}${wmPad(ccs)}${wmText(ccs, u3)}text-align:${al};vertical-align:${/center/.test(cs.alignItems) ? 'middle' : 'top'}">${content || '&nbsp;'}</td>`; }));
        const gap = parseFloat(cs.columnGap) || 0;
        return `<tr>${cells.join(gap > 4 ? `<td width="1%" style="width:${wmPt(gap)}"></td>` : '')}</tr>`; }));
      const rgap = parseFloat(cs.rowGap) || 0;
      const t = `<table dir="rtl" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">${rowsHTML.join(rgap > 4 ? `<tr><td style="height:${wmPt(rgap)};font-size:2pt">&nbsp;</td></tr>` : '')}</table>`;
      return box(t);
    }
    return box(await inner(kids));
  }
  const html = await walk(root, [255, 255, 255]);
  return { html, parts };
}
function wmMhtml(title, body, parts) {
  const B = '----=_NextPart_SHK_' + Date.now().toString(36);
  const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/.{76}/g, '$&\r\n');
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>@page WordSection1{size:595.3pt 841.9pt;margin:36pt 36pt 36pt 36pt}div.WordSection1{page:WordSection1}body{font-family:${WM_FONT};direction:rtl}td,div,span,p{font-family:${WM_FONT}}p{margin:0}table{mso-table-lspace:0;mso-table-rspace:0}</style></head><body dir="rtl" lang="AR-SA"><div class="WordSection1" dir="rtl">${body}</div></body></html>`;
  let out = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\n--${B}\r\nContent-Location: file:///C:/shk/doc.htm\r\nContent-Transfer-Encoding: base64\r\nContent-Type: text/html; charset="utf-8"\r\n\r\n${b64u(doc)}\r\n`;
  parts.forEach((p) => { out += `\r\n--${B}\r\nContent-Location: file:///C:/shk/${p.name}\r\nContent-Transfer-Encoding: base64\r\nContent-Type: ${p.mime}\r\n\r\n${p.b64.replace(/.{76}/g, '$&\r\n')}\r\n`; });
  return out + `\r\n--${B}--\r\n`;
}
/* المستند (HTML المعاينة) ← ملف Word */
async function wordFromDocHTML(docHTML, title, filename) {
  const host = document.createElement('div');
  host.className = 'fdoc-prev wm-host';
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:760px;background:#fff;z-index:-1;pointer-events:none';
  host.innerHTML = docHTML; document.body.appendChild(host);
  try {
    await hydrateFiles(host);
    try { await document.fonts.ready; } catch (_) { /* */ }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const root = host.firstElementChild || host;
    const { html, parts } = await wmConvert(root);
    download(filename, new Blob([wmMhtml(title, html, parts)], { type: 'application/msword' }));
    toast('نُزّل النموذج بصيغة Word');
  } finally { host.remove(); }
}
