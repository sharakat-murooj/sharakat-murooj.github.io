/* =====================================================================
   شاشة العرض المباشر (#/live) — للعرض الدائم في مكتب المعالي أو قاعة الاجتماعات
   فصول تنفيذية تُقرأ من بعيد وتدور تلقائيًا، وشريط أخبار أسفل الشاشة:
   الملخص التنفيذي · المواءمة الاستراتيجية · الانتشار الجغرافي · شراكة في الواجهة · تنوع الشركاء ·
   يتطلب اهتمامكم · الأثر الميداني
   - البيانات حيّة (المنصة المشتركة تُحدَّث كل 15 ثانية) ويُعاد بناء كل فصل عند ظهوره.
   - لا تظهر بيانات التواصل ولا الملاحظات الداخلية ولا المسودات.
   - إعداد الشاشة (الفصول والمدة) يُحفظ في هذا الجهاز فقط.
   ===================================================================== */
const LIVE_CH = [
  { k: 'wall', t: 'شركاء الأثر', n: 'الواجهة', s: 20 },
  { k: 'brief', t: 'الملخص التنفيذي', n: 'الملخص', s: 18 },
  { k: 'strategy', t: 'المواءمة مع الاستراتيجية', n: 'الاستراتيجية', s: 18 },
  { k: 'pipe', t: 'مسار المعاملات', n: 'المعاملات', s: 16 },
  { k: 'map', t: 'الانتشار الجغرافي', n: 'الخريطة', s: 16 },
  { k: 'spot', t: 'شراكات في الواجهة', n: 'شراكات بارزة', s: 24 },
  { k: 'sectors', t: 'تنوع الشركاء', n: 'القطاعات', s: 16 },
  { k: 'logos', t: 'شركاء يثقون بنا', n: 'الشركاء', s: 16 },
  { k: 'attn', t: 'يتطلب اهتمامكم', n: 'للاهتمام', s: 18 },
  { k: 'impact', t: 'الأثر الميداني', n: 'الأثر', s: 16 },
];
const liveCfg = () => { try { return JSON.parse(localStorage.getItem('shk_live_cfg') || '{}'); } catch (_) { return {}; } };
const liveCfgSave = (c) => { try { localStorage.setItem('shk_live_cfg', JSON.stringify(c)); } catch (_) { /* */ } };
const lvN = (v) => nf(v);
function liveData() {
  const td = isoDate(today()), y = today().getFullYear();
  const L_ = visiblePartnerships({ includeDrafts: false }).filter((p) => p.stage !== 'cancel');
  const c = liveCounts();
  const signed = L_.filter((p) => p.stage === 'signed' && signedOn(p) && String(signedOn(p)).slice(0, 10) <= td).sort((a, b) => (signedOn(a) < signedOn(b) ? 1 : -1));
  const byYear = (yy) => signed.filter((p) => String(signedOn(p)).slice(0, 4) === String(yy)).length;
  const S = typeof stratSummary === 'function' ? stratSummary(L_) : null;
  const regions = {}; L_.forEach((p) => { const r = pRegion(p).r || ''; regions[r] = (regions[r] || 0) + 1; });
  const sectors = {}; L_.forEach((p) => { const s = pSector(p) || 'أخرى'; (sectors[s] = sectors[s] || new Set()).add(p.partnerId); });
  const wfCur = (p) => { try { return wfInvolved(p) ? (wfStateOf('partnership', p).cur || {}).id : null; } catch (_) { return null; } };
  const awaitMin = L_.filter((p) => wfCur(p) === 'excellency');
  const preparing = L_.filter((p) => wfCur(p) === 'legal');
  const expiring = L_.filter((p) => pStatus(p) === 'soon').map((p) => ({ p, d: daysLeft(p) })).sort((a, b) => a.d - b.d);
  const stories = publicStories().filter((a) => !a.partnershipId || L_.some((p) => p.id === a.partnershipId)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const outputs = signed.reduce((t, p) => t + richItems(p.outputs).length, 0);
  const years = []; for (let k = 5; k >= 0; k--) years.push({ y: y - k, n: byYear(y - k) });
  const before = signed.filter((p) => +String(signedOn(p)).slice(0, 4) < y - 5).length;
  let run = before; const cum = years.map((x) => (run += x.n));
  const signedAll = L_.filter((p) => p.stage === 'signed').length;
  /* أين تقف المعاملات: المقترحات قيد الدراسة + الشراكات حسب مرحلة المسار الحالية */
  const phase = Object.fromEntries(WF_PHASES.map((ph) => [ph.id, []]));
  L_.forEach((p) => { try { const cur = wfStateOf('partnership', p).cur; if (cur && phase[cur.ph]) phase[cur.ph].push(p); } catch (_) { /* */ } });
  const propsIn = visibleProposals().filter((x) => ['submitted', 'review', 'info', 'accepted'].includes(x.status) && (showDemo() || !x.demo));
  /* صور المنصة: صور الشراكات الموقّعة أولًا ثم أغلفة القصص — مادة الخلفيات وجدار الصور */
  const photos = [], seenPh = new Set();
  [...signed, ...L_.filter((p) => p.stage !== 'signed')].forEach((p) => partnershipPhotos(p).forEach((ph) => { if (!seenPh.has(ph.fileId)) { seenPh.add(ph.fileId); photos.push({ fileId: ph.fileId, p }); } }));
  stories.forEach((a) => { if (a.coverFileId && !seenPh.has(a.coverFileId)) { seenPh.add(a.coverFileId); photos.push({ fileId: a.coverFileId, a }); } });
  const logos = [...new Set(L_.map((p) => p.partnerId))].map(partnerById).filter((pr) => pr && pr.logoFileId);
  const regionsN = KSA_REGIONS.filter(([r]) => regions[r]).length;
  return { photos, logos, regionsN, L: L_, c, signed, thisYear: byYear(y), lastYear: byYear(y - 1), y, S, regions, sectors, awaitMin, preparing, expiring, stories, outputs, years, cum, signedAll, phase, propsIn };
}
/* — رسوم الشاشة (SVG خفيفة تتحرك عند ظهور الفصل) — */
const LX_SEC = { 'حكومي': '#3FA27F', 'شبه حكومي': '#7CC7AA', 'خاص': '#D9B25F', 'غير ربحي': '#6FA8D6', 'تعليمي': '#B792D6' };
const lxSecC = (s, i) => LX_SEC[s] || ['#E08E6D', '#9FB4AA', '#C9A36B', '#8FB6C9'][i % 4];
function lxDonut(segs, { size = 300, w = 30, gap = 0.8, inner = '' } = {}) {
  const tot = segs.reduce((t, x) => t + x.v, 0) || 1, r = (size - w) / 2, c = size / 2; let off = 0;
  const arcs = segs.filter((x) => x.v).map((x, i) => { const len = Math.max(0, x.v / tot * 100 - (segs.length > 1 ? gap : 0)); const el = `<circle cx="${c}" cy="${c}" r="${r}" pathLength="100" stroke="${x.c}" stroke-width="${w}" stroke-dasharray="${len.toFixed(2)} 100" stroke-dashoffset="${(-off).toFixed(2)}" style="--i:${i}" class="lx-dseg"/>`; off += x.v / tot * 100; return el; }).join('');
  return `<svg class="lx-donut" viewBox="0 0 ${size} ${size}" aria-hidden="true"><g transform="rotate(-90 ${c} ${c})"><circle cx="${c}" cy="${c}" r="${r}" stroke="rgba(255,255,255,.07)" stroke-width="${w}" fill="none"/>${arcs}</g>${inner}</svg>`;
}
const lxRing = (pct, size = 120, w = 12, col = '#D9B25F') => lxDonut([{ v: pct, c: col }, { v: 100 - pct, c: 'transparent' }], { size, w, gap: 0 });
function lxBars(rows, { W = 260, H = 110 } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.n)), bw = W / rows.length;
  return `<svg class="lx-bars" viewBox="0 0 ${W} ${H + 22}" aria-hidden="true">${rows.map((r, i) => { const h = Math.max(3, r.n / max * (H - 18)), last = i === rows.length - 1;
    return `<g style="--i:${i}"><rect x="${(i * bw + bw * .2).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * .6).toFixed(1)}" height="${h.toFixed(1)}" rx="4" class="${last ? 'on' : ''}"/><text x="${(i * bw + bw / 2).toFixed(1)}" y="${(H - h - 6).toFixed(1)}" class="v">${r.n}</text><text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 18}" class="y">${String(r.y).slice(2)}</text></g>`; }).join('')}</svg>`;
}
function lxArea(years, cum) {
  /* المنحنى يتمدد مع الصندوق (أي مقاس شاشة)، والنقاط والأرقام عناصر HTML فوقه فلا تتشوه */
  const max = Math.max(1, ...cum), n = cum.length;
  const X = (i) => (n > 1 ? 3 + i / (n - 1) * 94 : 50), Y = (v) => 90 - v / max * 62;
  const line = cum.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(2)} ${Y(v).toFixed(2)}`).join('');
  return `<div class="lx-area"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lxAr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9B25F" stop-opacity=".42"/><stop offset="1" stop-color="#D9B25F" stop-opacity="0"/></linearGradient></defs>
      ${[0.33, 0.66].map((k) => `<line x1="0" x2="100" y1="${(92 - k * 80).toFixed(1)}" y2="${(92 - k * 80).toFixed(1)}" class="gr"/>`).join('')}
      <path d="${line}L${X(n - 1).toFixed(2)} 100L${X(0).toFixed(2)} 100Z" fill="url(#lxAr)" class="ar"/><path d="${line}" class="ln"/></svg>
    ${cum.map((v, i) => `<span class="pt ${i === n - 1 ? 'last' : ''}" style="left:${X(i)}%;top:${Y(v)}%;--i:${i}"><i></i><b>${lvN(v)}</b></span><em class="yr" style="left:${X(i)}%">${years[i].y}</em>`).join('')}</div>`;
}
function lxRadial(goals) {
  const size = 520, c = size / 2, max = Math.max(1, ...goals.map((g) => g.n)), w = 26, gap = 12;
  return `<svg class="lx-radial" viewBox="0 0 ${size} ${size}" aria-hidden="true">${goals.map((g, i) => { const r = c - 20 - i * (w + gap); if (r < 40) return ''; const pct = g.n / max * 75;
    return `<g style="--i:${i}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${w}" pathLength="100" stroke-dasharray="75 100" transform="rotate(-90 ${c} ${c})" stroke-linecap="round"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${g.c}" stroke-width="${w}" pathLength="100" stroke-dasharray="${Math.max(.5, pct).toFixed(2)} 100" transform="rotate(-90 ${c} ${c})" stroke-linecap="round" class="lx-dseg"/>
      <text x="${c - 12}" y="${c - r + 9}" class="k">${esc(g.k)}</text></g>`; }).join('')}</svg>`;
}
function liveMapSVG(R) {
  /* حدود المناطق الثلاث عشرة: تلوين كل منطقة بقدر شراكاتها، ودائرة بالعدد في مركزها، وأقواس من الرياض */
  const G = typeof KSA_REG_SHAPES !== 'undefined' ? KSA_REG_SHAPES : null;
  if (!G) return '';
  const max = Math.max(1, ...G.r.map((g) => R[g.ar] || 0));
  const hq = G.r.find((g) => g.ar === 'الرياض');
  const regs = G.r.map((g, i) => { const c = R[g.ar] || 0, k = c / max; return `<path class="lx-rg ${c ? 'on' : ''}" d="${g.d}" style="--k:${k.toFixed(2)};--i:${i}"/>`; }).join('');
  const arcs = hq ? G.r.filter((g) => g.ar !== 'الرياض' && R[g.ar]).map((g, i) => `<path class="lx-arc" style="--i:${i}" pathLength="100" d="M${hq.x} ${hq.y} Q${((hq.x + g.x) / 2).toFixed(1)} ${(Math.min(hq.y, g.y) - 70).toFixed(1)} ${g.x} ${g.y}"/>`).join('') : '';
  const pins = G.r.map((g, i) => { const c = R[g.ar] || 0, r = c ? 13 + Math.sqrt(c / max) * 15 : 0;
    return `<g class="lx-reg ${c ? '' : 'zero'}" style="--i:${i}">${c ? `<circle class="lx-halo" cx="${g.x}" cy="${g.y}" r="${(r + 7).toFixed(1)}"/><circle class="lx-b" cx="${g.x}" cy="${g.y}" r="${r.toFixed(1)}"/><text x="${g.x}" y="${g.y + 6}" class="lx-n">${c}</text>` : ''}<text x="${g.x}" y="${(g.y + (c ? r + 20 : 5)).toFixed(1)}" class="lx-rn">${esc(g.ar)}</text></g>`; }).join('');
  return `<svg viewBox="${G.vb}" class="lx-map" aria-hidden="true">${regs}${arcs}${pins}</svg>`;
}
const lxHead = (n, total, t, sub, aside = '') => `<div class="lx-chh"><span class="lx-chn">${String(n).padStart(2, '0')}<i>/${String(total).padStart(2, '0')}</i></span><div><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${aside ? `<div class="lx-chx">${aside}</div>` : ''}</div>`;
function liveChapterHTML(k, X, n, total) {
  const org = esc(D.settings.org.name);
  if (k === 'wall') {
    const ph = X.photos.length ? Array.from({ length: 14 }, (_, i) => X.photos[i % X.photos.length]) : [];
    const sects = Object.keys(X.sectors).filter((x) => x && x !== 'أخرى').length;
    return `<div class="lx-wall">
      <div class="lx-mos">${ph.map((x, i) => `<figure class="t${i}" style="--i:${i}"><img data-file="${esc(x.fileId)}" alt=""><figcaption>${esc(x.p ? partnerName(x.p) : (x.a ? x.a.title : ''))}</figcaption></figure>`).join('')}</div>
      <div class="lx-wall-veil"></div>
      <div class="lx-wall-t">
        <small>منظومة شراكات ${org}</small>
        <h2>شركاء <em>يصنعون</em> الأثر</h2>
        <p>شراكات حكومية وخاصة وغير ربحية وتعليمية تعمل معًا لبيئة مستدامة في كل مناطق المملكة.</p>
        <div class="lx-wall-n"><div><b class="lx-cu" data-v="${X.c.partners}">0</b><span>جهة شريكة</span></div><div><b class="lx-cu" data-v="${X.signedAll}">0</b><span>شراكة موقّعة</span></div><div><b class="lx-cu" data-v="${sects}">0</b><span>قطاعات</span></div>${X.regionsN ? `<div><b class="lx-cu" data-v="${X.regionsN}">0</b><span>مناطق</span></div>` : ''}</div>
      </div></div>`;
  }
  if (k === 'logos') {
    const per = 15, pages = [];
    for (let q = 0; q < X.logos.length; q += per) pages.push(X.logos.slice(q, q + per));
    return `${lxHead(n, total, 'شركاء يثقون بنا', `${lvN(X.c.partners)} جهة شريكة من مختلف القطاعات`)}
      <div class="lx-lgrid">${pages.map((pg, pi) => `<div class="lx-lpage ${pi === 0 ? 'on' : ''}">${pg.map((pr, i) => `<div class="lx-lg" style="--i:${i}"><div class="lx-lgp">${plateHTML(pr, 88)}</div><span>${esc(pr.name)}</span></div>`).join('')}</div>`).join('')}
        ${pages.length > 1 ? `<div class="lx-lpd">${pages.map((_, pi) => `<i class="${pi === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>`;
  }
  if (k === 'brief') {
    const d = X.thisYear - X.lastYear;
    const goalsOn = X.S ? X.S.goalsOn : 0, goalsN = X.S ? X.S.goals.length : 0;
    return `${lxHead(n, total, 'الملخص التنفيذي', `محفظة شراكات ${org}`, `<p class="lx-lead">تعمل ${org} مع <b>${lvN(X.c.partners)}</b> جهة شريكة من القطاعات الحكومية والخاصة وغير الربحية والتعليمية، منها <b>${lvN(X.c.active)}</b> شراكة سارية تُتابَع مخرجاتها.</p>`)}
      <div class="lx-kpis g">
        <div><div class="lx-kv"><b class="lx-cu" data-v="${X.c.partners}">0</b><span>جهة شريكة</span></div>${lxDonut(Object.keys(X.sectors).map((sx, i) => ({ v: X.sectors[sx].size, c: lxSecC(sx, i) })), { size: 120, w: 14, gap: 2 })}</div>
        <div><div class="lx-kv"><b class="lx-cu" data-v="${X.c.active}">0</b><span>شراكة سارية</span><small>من ${lvN(X.signedAll)} موقّعة</small></div>${lxRing(X.signedAll ? Math.round(X.c.active / X.signedAll * 100) : 0, 120, 14, '#3FA27F')}</div>
        <div><div class="lx-kv"><b class="lx-cu" data-v="${X.thisYear}">0</b><span>وُقّعت في ${X.y}</span>${X.lastYear ? `<small class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)} عن ${X.y - 1}</small>` : ''}</div>${lxBars(X.years, { W: 170, H: 96 })}</div>
        ${goalsN ? `<div><div class="lx-kv"><b>${goalsOn}<i>/${goalsN}</i></b><span>أهداف استراتيجية</span><small>تخدمها الشراكات</small></div><div class="lx-pips">${X.S.goals.map((g) => `<i style="--c:${(typeof SG_COL !== 'undefined' && SG_COL[g.k]) || '#B08A3E'}" class="${g.ps.length ? 'on' : ''}">${esc(g.k)}</i>`).join('')}</div></div>` : ''}
      </div>
      <div class="lx-grow"><h4>نمو الشراكات الموقّعة <small>العدد التراكمي حتى نهاية كل عام</small></h4>${lxArea(X.years, X.cum)}</div>`;
  }
  if (k === 'strategy' && X.S) {
    const S = X.S, pct = S.total ? Math.round(S.linked.length / S.total * 100) : 0, max = Math.max(1, ...S.goals.map((g) => g.ps.length));
    return `${lxHead(n, total, 'المواءمة مع الاستراتيجية', `${pct}% من الشراكات مرتبطة بهدف أو مبادرة استراتيجية`)}
      <div class="lx-stw"><div class="lx-radw">${lxRadial(S.goals.map((g) => ({ k: g.k, n: g.ps.length, c: (typeof SG_COL !== 'undefined' && SG_COL[g.k]) || '#B08A3E' })))}<div class="lx-radc"><b>${pct}%</b><span>مرتبطة استراتيجيًا</span></div></div>
      <div class="lx-goals">${S.goals.map((g, i) => { const on = g.inits.filter((x) => x.ps.length).length; return `<div class="lx-g" style="--c:${(typeof SG_COL !== 'undefined' && SG_COL[g.k]) || '#B08A3E'};--i:${i}"><span class="lx-gk">${esc(g.k)}</span><div class="lx-gt"><b>${esc(String(g.t).replace(/^[A-Z]+\d?\s*[:：]\s*/, ''))}</b><i><em style="width:${Math.round(g.ps.length / max * 100)}%"></em></i></div><div class="lx-gv"><b>${g.ps.length}</b><small>شراكة · ${on}/${g.inits.length} مبادرات</small></div></div>`; }).join('')}</div></div>`;
  }
  if (k === 'pipe') {
    const st = [{ t: 'مقترحات قيد الدراسة', ps: [], props: X.propsIn }, ...WF_PHASES.map((ph) => ({ t: ph.t, ps: X.phase[ph.id] || [] }))];
    const max = Math.max(1, ...st.map((x) => x.ps.length + (x.props ? x.props.length : 0))), tot = st.reduce((t, x) => t + x.ps.length + (x.props ? x.props.length : 0), 0);
    return `${lxHead(n, total, 'مسار المعاملات', `${plural(tot, 'معاملة واحدة', 'معاملتان', 'معاملات', 'معاملة')} في مراحل الإجراء المعتمد الآن`)}
      <div class="lx-pipe">${st.map((x, i) => { const v = x.ps.length + (x.props ? x.props.length : 0), r = 34 + Math.sqrt(v / max) * 52;
        const lg = x.ps.map((p) => partnerById(p.partnerId)).filter(Boolean).slice(0, 3);
        return `<div class="lx-pn ${v ? '' : 'z'}" style="--i:${i}"><div class="lx-pnc"><span style="width:${(r * 2).toFixed(0)}px;height:${(r * 2).toFixed(0)}px"><b class="lx-cu" data-v="${v}">0</b></span></div><h5>${esc(x.t)}</h5><div class="lx-pnl">${lg.map((pr) => plateHTML(pr, 48)).join('')}${x.props && x.props.length ? `<small>${x.props.slice(0, 2).map((y) => esc(y.partnerName || '')).join('، ')}</small>` : ''}</div></div>`; }).join('<i class="lx-pa"></i>')}</div>`;
  }
  if (k === 'map') {
    const top = KSA_REGIONS.map(([r]) => [r, X.regions[r] || 0]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
    const nat = X.regions[KSA_NATIONAL] || 0, covered = top.length;
    return `${lxHead(n, total, 'الانتشار الجغرافي', `شراكات في ${covered} من ${KSA_REGIONS.length} مناطق${nat ? ` · ${nat} على مستوى المملكة` : ''}`)}
      <div class="lx-geo"><div class="lx-mapw">${liveMapSVG(X.regions)}</div>
        <ol class="lx-rank">${top.slice(0, 6).map(([r, c], i) => `<li style="--i:${i}"><span>${esc(r)}</span><i><em style="width:${Math.round(c / (top[0][1] || 1) * 100)}%"></em></i><b>${c}</b></li>`).join('')}${nat ? `<li class="nat"><span>على مستوى المملكة</span><i></i><b>${nat}</b></li>` : ''}</ol></div>`;
  }
  if (k === 'spot') {
    const s = X.signed.filter((p) => partnershipPhotos(p).length).slice(0, 3).concat(X.signed.filter((p) => !partnershipPhotos(p).length)).slice(0, 3);
    return `${lxHead(n, total, 'شراكات في الواجهة', 'أحدث الشراكات الموقّعة')}
      <div class="lx-spot fb">${s.map((p, i) => { const ph = partnershipPhotos(p)[0], pr = partnerById(p.partnerId), areas = richItems(p.cooperationAreas).slice(0, 2);
        return `<article class="lx-sp ${i === 0 ? 'on' : ''}" data-sp="${i}"><div class="lx-spm">${ph ? `<img data-file="${esc(ph.fileId)}" alt="">` : coverHTML(p.id, null, { W: 900, H: 600 })}</div>
          <div class="lx-spb"><div class="lx-spl">${plateHTML(pr, 96)}</div><small>${esc(p.classification || 'شراكة')} · وُقّعت ${fmtDate(signedOn(p))}م</small><h3>${esc(partnerName(p))}</h3>
          ${p.startDate && p.endDate ? (() => { const t0 = new Date(p.startDate), t1 = new Date(p.endDate), k = Math.min(100, Math.max(0, (today() - t0) / Math.max(1, t1 - t0) * 100)); const left = daysLeft(p); return `<div class="lx-dur"><div class="lx-durb"><i style="width:${k.toFixed(1)}%"></i><u style="inset-inline-start:${k.toFixed(1)}%"></u></div><div class="lx-durl"><span>${fmtDate(p.startDate)}</span><b>${left > 0 ? `باقٍ ${plural(left, 'يوم', 'يومان', 'أيام', 'يومًا')}` : 'انتهت'}</b><span>${fmtDate(p.endDate)}</span></div></div>`; })() : ''}
          ${areas.length ? `<ul>${areas.map((a) => `<li>${esc(trimP(a.title || String(a.text || '').split(/[:،.]/)[0]).slice(0, 90))}</li>`).join('')}</ul>` : ''}</div></article>`; }).join('')}
        <div class="lx-spd">${s.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
        <div class="lx-sth">${X.signed.slice(3, 7).map((p) => { const ph = partnershipPhotos(p)[0]; return ph ? `<figure><img data-file="${esc(ph.fileId)}" alt=""><figcaption>${esc(partnerName(p))}</figcaption></figure>` : ''; }).join('')}</div></div>`;
  }
  if (k === 'sectors') {
    const order = ['حكومي', 'شبه حكومي', 'خاص', 'غير ربحي', 'تعليمي'];
    const keys = [...order.filter((s) => X.sectors[s]), ...Object.keys(X.sectors).filter((s) => !order.includes(s))];
    return `${lxHead(n, total, 'تنوع الشركاء', 'الجهات الشريكة حسب القطاع')}
      <div class="lx-secw"><div class="lx-secd">${lxDonut(keys.map((sx, i) => ({ v: X.sectors[sx].size, c: lxSecC(sx, i) })), { size: 460, w: 54, gap: 1.2 })}<div class="lx-radc"><b class="lx-cu" data-v="${X.c.partners}">0</b><span>جهة شريكة</span></div></div>
      <div class="lx-secs">${keys.map((sx, i) => { const ids = [...X.sectors[sx]], prs = ids.map(partnerById).filter(Boolean); const lg = prs.filter((x) => x.logoFileId).slice(0, 5); const tot = keys.reduce((t, q) => t + X.sectors[q].size, 0) || 1;
        return `<div class="lx-sec" style="--i:${i};--c:${lxSecC(sx, i)}"><div class="lx-sech"><b class="lx-cu" data-v="${ids.length}">0</b><span>${esc(sx)}</span><em>${Math.round(ids.length / tot * 100)}%</em></div><div class="lx-secl">${lg.map((pr) => plateHTML(pr, 56)).join('')}</div></div>`; }).join('')}</div></div>`;
  }
  if (k === 'attn') {
    const row = (p, tag, cls = '') => `<li class="${cls}">${plateHTML(partnerById(p.partnerId), 56)}<div><b>${esc(partnerName(p))}</b><small>${esc(p.classification || 'شراكة')}</small></div><em>${tag}</em></li>`;
    const has = X.awaitMin.length || X.expiring.length || X.preparing.length;
    return `${lxHead(n, total, 'يتطلب اهتمامكم', has ? 'معاملات وقرارات قريبة' : '')}
      ${has ? `<div class="lx-attn">
        <section><h4><span>${X.awaitMin.length}</span>بانتظار موافقة المعالي</h4>${X.awaitMin.length ? `<ul>${X.awaitMin.slice(0, 4).map((p) => row(p, 'المعاملة لدى مكتب المعالي', 'gold')).join('')}</ul>` : '<p>لا معاملات بانتظار الموافقة.</p>'}
          ${X.preparing.length ? `<p class="lx-prep">و${plural(X.preparing.length, 'معاملة واحدة', 'معاملتان', 'معاملات', 'معاملة')} في مرحلة إعداد خطاب طلب الموافقة.</p>` : ''}</section>
        <section><h4><span>${X.expiring.length}</span>شراكات تنتهي قريبًا</h4>${X.expiring.length ? `${X.expiring.length > 4 ? '' : ''}<ul>${X.expiring.slice(0, 4).map(({ p, d }) => row(p, `<span class="lx-cd">${lxRing(Math.max(4, Math.round(d / (D.settings.expiryDays || 90) * 100)), 64, 7, d <= 30 ? '#E5806B' : '#D9B25F')}<b>${d}</b></span>يومًا`, d <= 30 ? 'red' : '')).join('')}</ul>` : '<p>لا شراكات تنتهي خلال الفترة القريبة.</p>'}</section>
      </div>` : '<div class="lx-calm"><b>لا توجد معاملات أو قرارات معلّقة</b><span>جميع الشراكات تسير وفق المسار المعتمد.</span></div>'}`;
  }
  if (k === 'impact') {
    const st = X.stories.slice(0, 5);
    return `${lxHead(n, total, 'الأثر الميداني', st.length ? `${plural(X.stories.length, 'قصة أثر موثّقة', 'قصتا أثر موثّقتان', 'قصص أثر موثّقة', 'قصة أثر موثّقة')} · ${lvN(X.outputs)} مخرجًا مستهدفًا في الشراكات الموقّعة` : '')}
      <div class="lx-imp bento n${st.length}">${st.map((a, i) => `<article style="--i:${i}"><div class="lx-impm">${coverHTML('story' + a.id, a.coverFileId, { W: 700, H: 460 })}${a.metricValue ? `<span><b>${esc(a.metricValue)}</b>${esc(a.metricLabel || '')}</span>` : ''}</div><h3>${esc(a.title)}</h3><small>${(() => { const sp = storyPartner(a); const nm = sp ? sp.name : ''; return (nm ? esc(nm) + ' · ' : '') + fmtDate(a.date, 'month'); })()}</small></article>`).join('')}</div>`;
  }
  return '';
}
function liveTicker(X) {
  const items = [
    ...X.signed.slice(0, 5).map((p) => `وُقّعت ${esc(p.classification || 'شراكة')} مع ${esc(partnerName(p))} — ${fmtDate(signedOn(p))}م`),
    ...X.awaitMin.slice(0, 3).map((p) => `معاملة ${esc(partnerName(p))} لدى مكتب المعالي`),
    ...X.expiring.slice(0, 3).map(({ p, d }) => `تنتهي الشراكة مع ${esc(partnerName(p))} خلال ${plural(d, 'يوم واحد', 'يومين', 'أيام', 'يومًا')}`),
    ...X.stories.slice(0, 3).map((a) => `إنجاز ميداني: ${esc(a.title)}`),
  ];
  return items.length ? items.map((t) => `<span>${t}</span>`).join('<i>◆</i>') : '';
}
function renderLive(el) {
  el.innerHTML = '<div class="lv-hold"></div>';
  document.getElementById('liveScreen')?.remove();
  const logo = (ASSET_IMG['murooj-logo-white'] || ASSET_IMG['murooj-logo'] || {}).src;
  const box = document.createElement('div'); box.id = 'liveScreen'; box.className = 'lx'; box.setAttribute('dir', 'rtl');
  document.body.appendChild(box); document.documentElement.classList.add('live-on');
  let cfg = liveCfg(), chs = [], i = 0, T = null, spT = null, idle = null;
  const sec = () => Math.max(8, +(cfg.sec || 0) || 0);
  const pick = (X) => LIVE_CH.filter((c) => !(cfg.off || []).includes(c.k)).filter((c) => (c.k === 'impact' ? X.stories.length : c.k === 'wall' ? X.photos.length >= 4 : c.k === 'logos' ? X.logos.length >= 6 : c.k === 'spot' ? X.signed.length : c.k === 'strategy' ? !!X.S : c.k === 'pipe' ? (X.propsIn.length + Object.values(X.phase).reduce((t, a) => t + a.length, 0)) > 0 : true));
  box.innerHTML = `<div class="lx-bg" aria-hidden="true"></div><div class="lx-bgph" id="lxBgph" aria-hidden="true"></div>
    <header class="lx-top">${logo ? `<img src="${logo}" alt="">` : ''}<div class="lx-tt"><b>${esc(D.settings.org.name)}</b><span>منظومة الشراكات · ${esc(D.settings.org.dept || 'إدارة الشراكات')}</span></div>
      <div class="lx-clock"><b id="lxTime"></b><span id="lxHijri"></span><small id="lxGreg"></small></div></header>
    <main class="lx-stage" id="lxStage"></main>
    <div class="lx-tick"><b>آخر المستجدات</b><div class="lx-tw"><div class="lx-tr" id="lxTick"></div></div></div>
    <footer class="lx-foot"><nav class="lx-nav" id="lxNav"></nav><span class="lx-upd"><i></i>تُحدَّث البيانات تلقائيًا</span>
      <div class="lx-ctl"><button type="button" data-lxcfg title="إعداد الشاشة">${icon('settings')}</button><button type="button" data-lxfs title="ملء الشاشة">${icon('expand')}</button><button type="button" data-lxx title="خروج (Esc)">${icon('x')}</button></div></footer>
    <div class="lx-panel" id="lxPanel" hidden></div>`;
  const clock = () => { const d = new Date(); const t = box.querySelector('#lxTime'); if (!t) return;
    t.textContent = d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
    try { box.querySelector('#lxHijri').textContent = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (_) { /* */ }
    box.querySelector('#lxGreg').textContent = fmtDate(isoDate(d)) + 'م'; };
  const countUp = (root) => root.querySelectorAll('.lx-cu').forEach((b) => { const v = +b.dataset.v, t0 = performance.now(); const f = (now) => { const k = Math.min(1, (now - t0) / 1600); b.textContent = lvN(Math.round(v * (1 - Math.pow(1 - k, 3)))); if (k < 1 && document.body.contains(b)) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const show = (n) => {
    const X = liveData(); chs = pick(X); if (!chs.length) chs = [LIVE_CH[0]];
    i = (n + chs.length) % chs.length; const c = chs[i];
    const st = box.querySelector('#lxStage'); st.className = 'lx-stage c-' + c.k; st.innerHTML = `<div class="lx-ch">${liveChapterHTML(c.k, X, i + 1, chs.length)}</div>`;
    hydrateFiles(st); countUp(st);
    /* خلفية مصوّرة لكل فصل (مموّهة) — عدا جدار الصور */
    const bg = box.querySelector('#lxBgph'); const pool = X.photos;
    if (c.k !== 'wall' && pool.length) { const ph = pool[(i * 5 + Math.floor(Math.random() * pool.length)) % pool.length]; const im = document.createElement('img'); im.dataset.file = ph.fileId; im.alt = ''; im.onload = () => { requestAnimationFrame(() => im.classList.add('in')); [...bg.children].slice(0, -1).forEach((o) => { o.classList.remove('in'); setTimeout(() => o.remove(), 1600); }); }; bg.appendChild(im); hydrateFiles(bg); bg.classList.remove('off'); } else bg.classList.add('off');
    clearInterval(box._mos);
    if (c.k === 'wall' && pool.length > 1) { let q = 14; box._mos = setInterval(() => { const figs = st.querySelectorAll('.lx-mos figure'); if (!figs.length) return; const f = figs[Math.floor(Math.random() * figs.length)]; const x = pool[q++ % pool.length]; const im = f.querySelector('img'); f.classList.add('sw'); setTimeout(() => { im.dataset.file = x.fileId; hydrateFiles(f).then(() => f.classList.remove('sw')); const cap = f.querySelector('figcaption'); if (cap) cap.textContent = x.p ? partnerName(x.p) : (x.a ? x.a.title : ''); }, 700); }, 2600); }
    const dur = (cfg.sec ? sec() : c.s) * 1000;
    box.querySelector('#lxNav').innerHTML = chs.map((x, k) => `<button type="button" data-lx="${k}" title="${x.t}" class="${k === i ? 'on' : ''}" style="--ms:${k === i ? dur : 0}ms"><i></i><span>${x.n || x.t}</span></button>`).join('');
    const tk = liveTicker(X), tr = box.querySelector('#lxTick');
    if (tr.dataset.v !== tk) { tr.dataset.v = tk; tr.innerHTML = tk ? `<div>${tk}<i>◆</i></div><div aria-hidden="true">${tk}<i>◆</i></div>` : ''; tr.style.setProperty('--dur', Math.max(30, tk.length / 9) + 's'); }
    clearInterval(spT);
    if (c.k === 'logos') { let s = 0; const all = st.querySelectorAll('.lx-lpage'), dots = st.querySelectorAll('.lx-lpd i'); if (all.length > 1) spT = setInterval(() => { all[s].classList.remove('on'); dots[s] && dots[s].classList.remove('on'); s = (s + 1) % all.length; all[s].classList.add('on'); dots[s] && dots[s].classList.add('on'); }, Math.max(4000, Math.round(dur / all.length))); }
    if (c.k === 'spot') { let s = 0; const all = st.querySelectorAll('.lx-sp'), dots = st.querySelectorAll('.lx-spd i'); if (all.length > 1) spT = setInterval(() => { all[s].classList.remove('on'); dots[s].classList.remove('on'); s = (s + 1) % all.length; all[s].classList.add('on'); dots[s].classList.add('on'); }, Math.round(dur / all.length)); }
    clearTimeout(T); T = setTimeout(() => show(i + 1), dur);
  };
  const panel = () => {
    const p = box.querySelector('#lxPanel'); p.hidden = !p.hidden; if (p.hidden) return;
    p.innerHTML = `<h3>إعداد الشاشة</h3><p>يُحفظ في هذا الجهاز فقط.</p><div class="lx-pl">${LIVE_CH.map((c) => `<label><input type="checkbox" data-lxon="${c.k}" ${(cfg.off || []).includes(c.k) ? '' : 'checked'}> ${c.t}</label>`).join('')}</div>
      <label class="lx-ps">مدة كل فصل <select data-lxsec><option value="">تلقائية حسب الفصل</option>${[10, 15, 20, 30, 45, 60].map((s) => `<option value="${s}" ${+cfg.sec === s ? 'selected' : ''}>${s} ثانية</option>`).join('')}</select></label>
      <button type="button" class="lx-pok" data-lxdone>تم</button>`;
  };
  const stop = () => { clearTimeout(T); clearInterval(spT); clearInterval(box._mos); clearInterval(box._clk); box.remove(); document.documentElement.classList.remove('live-on'); window.removeEventListener('hashchange', onHash); document.removeEventListener('keydown', onKey); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) { /* */ } };
  const leave = () => (history.length > 1 ? history.back() : go('#/'));
  const onHash = () => { if (!location.hash.startsWith('#/live')) stop(); };
  const onKey = (e) => { if (e.key === 'Escape') { const p = box.querySelector('#lxPanel'); if (!p.hidden) { p.hidden = true; return; } leave(); } else if (e.key === 'ArrowLeft') show(i + 1); else if (e.key === 'ArrowRight') show(i - 1); else if (e.key === 'f' || e.key === 'F') box.querySelector('[data-lxfs]').click(); };
  window.addEventListener('hashchange', onHash); document.addEventListener('keydown', onKey);
  box.addEventListener('click', (e) => {
    const d = e.target.closest('[data-lx]'); if (d) return show(+d.dataset.lx);
    if (e.target.closest('[data-lxx]')) return leave();
    if (e.target.closest('[data-lxcfg]')) return panel();
    if (e.target.closest('[data-lxdone]')) { box.querySelector('#lxPanel').hidden = true; return show(0); }
    if (e.target.closest('[data-lxfs]')) { try { document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen(); } catch (_) { /* */ } }
  });
  box.addEventListener('change', (e) => {
    const on = e.target.closest('[data-lxon]'); if (on) { const off = new Set(cfg.off || []); on.checked ? off.delete(on.dataset.lxon) : off.add(on.dataset.lxon); cfg = { ...cfg, off: [...off] }; liveCfgSave(cfg); }
    if (e.target.closest('[data-lxsec]')) { cfg = { ...cfg, sec: e.target.value ? +e.target.value : 0 }; liveCfgSave(cfg); }
  });
  box.addEventListener('mousemove', () => { box.classList.add('cur'); clearTimeout(idle); idle = setTimeout(() => box.classList.remove('cur'), 3000); });
  clock(); box._clk = setInterval(clock, 10000); show(0);
}
