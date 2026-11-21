/* =====================================================================
   خريطة الفجوات — تبويب في «الارتباط الاستراتيجي»
   أين لا تخدمنا أي شراكة؟ المبادرات والأهداف بلا شراكة، والمناطق والقطاعات غير المغطاة،
   ومع كل فجوة جهات مرشحة من «الجهات المستهدفة» (ترشيح أولي بقائمة تحقق المبادرة نفسها، لا قرار).
   ===================================================================== */
function gapTargets() {
  const has = new Set(D.partnerships.filter((p) => !p.isDraft && p.stage !== 'cancel').map((p) => p.partnerId));
  return D.partners.filter((pr) => (showDemo() || !pr.demo) && !has.has(pr.id));
}
/* درجة جهة مستهدفة لمبادرة: بنود قائمة التحقق التي تنطبق على ما نعرفه عنها (القطاع، المجال، الملاحظة) */
function gapScore(pr, key) {
  const pseudo = { id: 'tg-' + pr.id, partnerId: pr.id, title: pr.name, cooperationAreas: [pr.targetNote, pr.notes, pr.domain].filter(Boolean).join(' '), categories: [] };
  const checks = stratAutoChecks(pseudo, key);
  return { n: checks.filter(Boolean).length, of: checks.length };
}
function gapsData(list) {
  const S = stratSummary(list), T = gapTargets();
  const initGaps = S.goals.flatMap((g) => g.inits.filter((i) => !i.ps.length).map((i) => {
    const key = i.c; const cand = T.map((pr) => ({ pr, ...gapScore(pr, key) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.pr.name.localeCompare(b.pr.name, 'ar')).slice(0, 4);
    return { g, i, key, cand };
  }));
  const thin = S.goals.flatMap((g) => g.inits.filter((i) => i.ps.length === 1).map((i) => ({ g, i, p: i.ps[0] })));
  const regs = (typeof KSA_REGIONS !== 'undefined' ? KSA_REGIONS : []).map(([name, , , kws]) => {
    const ps = list.filter((p) => pRegion(p).r === name);
    const cand = ps.length ? [] : T.filter((pr) => { const t = mapNorm([pr.name, pr.targetNote, pr.notes].join(' ')); return kws.some((k) => t.includes(mapNorm(k))); }).slice(0, 4);
    return { name, n: ps.length, cand };
  });
  const secs = L('sectors').map((s) => ({ s, n: list.filter((p) => pSector(p) === s).length, cand: T.filter((pr) => pr.sector === s).length }));
  return { S, initGaps, thin, regs, secs, T };
}
function stratGapsHTML(list) {
  const G = gapsData(list), S = G.S;
  const missR = G.regs.filter((r) => !r.n), maxS = Math.max(1, ...G.secs.map((x) => x.n));
  const cand = (arr) => (arr.length ? `<div class="gp-cand"><small>مرشحون من الجهات المستهدفة:</small>${arr.map((c) => { const pr = c.pr || c; return `<a href="#/partners/${pr.id}" class="gp-c" title="${c.of ? `ينطبق ${c.n} من ${c.of} بنود` : ''}">${plateHTML(pr, 22)}<span>${esc(pr.name)}</span>${c.of ? `<em>${c.n}/${c.of}</em>` : ''}</a>`; }).join('')}</div>` : '<div class="gp-cand none"><small>لا توجد جهة مستهدفة مسجّلة تطابق هذه الفجوة — أضف جهات مستهدفة من «الجهات الشريكة».</small></div>');
  return `<div class="gp">
    <div class="gp-sum">
      <div class="gp-k ${G.initGaps.length ? 'bad' : 'ok'}"><b>${G.initGaps.length}</b><span>مبادرة بلا أي شراكة</span><small>من ${S.initsAll} مبادرة</small></div>
      <div class="gp-k ${G.thin.length ? 'warn' : ''}"><b>${G.thin.length}</b><span>مبادرة تعتمد على شراكة واحدة</span><small>معرّضة إن تعثّرت الشراكة</small></div>
      <div class="gp-k ${missR.length ? 'warn' : 'ok'}"><b>${missR.length}</b><span>منطقة بلا شراكة</span><small>من ${G.regs.length} مناطق</small></div>
      <div class="gp-k"><b>${G.T.length}</b><span>جهة مستهدفة متاحة للترشيح</span><small>بلا شراكة بعد</small></div>
    </div>
    <section class="gp-sec"><h3>${icon('flag')} مبادرات لا تخدمها أي شراكة</h3>
      ${G.initGaps.length ? `<div class="gp-list">${G.initGaps.map((x) => `<article class="gp-item" style="--gc:${(typeof SG_COL !== 'undefined' && SG_COL[x.g.k]) || 'var(--gold)'}"><header><span class="sg-code sm">${esc(x.key)}</span><b>${esc(x.i.t)}</b></header><p>${esc(x.g.t)}</p>${cand(x.cand)}</article>`).join('')}</div>` : '<p class="gp-ok">كل المبادرات تخدمها شراكة واحدة على الأقل.</p>'}</section>
    ${G.thin.length ? `<section class="gp-sec"><h3>${icon('alert')} مبادرات تعتمد على شراكة واحدة</h3><div class="gp-thin">${G.thin.map((x) => `<a href="#/partnerships/${x.p.id}" class="gp-t"><span class="sg-code sm">${esc(x.i.c)}</span><span>${esc(x.i.t)}</span><em>${plateHTML(partnerById(x.p.partnerId), 22)}${esc(partnerName(x.p))}</em></a>`).join('')}</div></section>` : ''}
    <div class="gp-two">
      <section class="gp-sec"><h3>${icon('map')} التغطية الجغرافية</h3><div class="gp-regs">${G.regs.map((r) => `<div class="gp-r ${r.n ? '' : 'zero'}"><span>${esc(r.name)}</span><b>${r.n || '—'}</b>${!r.n && r.cand.length ? `<small>${r.cand.map((pr) => esc(pr.name)).join('، ')}</small>` : ''}</div>`).join('')}</div>
        <p class="gp-note">المنطقة من حقل «المنطقة» في الشراكة، أو مستنتجة من نصوصها.</p></section>
      <section class="gp-sec"><h3>${icon('building')} التوازن بين القطاعات</h3><div class="gp-secs">${G.secs.map((x) => `<div class="gp-s"><span>${esc(x.s)}</span><i><b style="width:${Math.round(x.n / maxS * 100)}%"></b></i><em>${x.n}</em>${x.cand ? `<small>${x.cand} مستهدفة</small>` : ''}</div>`).join('')}</div></section>
    </div>
    <p class="gp-note">الترشيح أولي: يُحسب من قائمة تحقق المبادرة على ما هو مسجّل عن الجهة المستهدفة (القطاع والمجال والملاحظة)، ويحتاج إلى دراسة قبل التواصل.</p>
  </div>`;
}
