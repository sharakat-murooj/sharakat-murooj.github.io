/* =====================================================================
   الارتباط الاستراتيجي — العرض البصري والطباعة
   ===================================================================== */
const SG_COL = { SO1: '#B08A3E', SO2: '#2F7A5E', SO3: '#1F5F6B', SO4: '#5B6FA8', EO: '#8A6A9C' };
const sgCol = (k) => SG_COL[k] || '#2F7A5E';
const sgRing = (pct, size = 120, stroke = 10, col = '#E6C786', track = 'rgba(255,255,255,.14)') => {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(Math.max(0, Math.min(1, pct)) * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
};
const sgLogo = (p) => { const pr = partnerById(p.partnerId), s = pStrat(p); return `<a class="sgv-lg ${s.src === 'auto' ? 'auto' : ''}" href="#/partnerships/${p.id}" title="${esc(partnerName(p))}${s.src === 'auto' ? ' — مقترح آلي' : ''}">${plateHTML(pr, 36)}</a>`; };

function stratMapHTML(S) {
  const pct = S.total ? S.linked.length / S.total : 0, L = Math.max(1, S.linked.length);
  const hero = `<section class="sgv-hero">
    <div class="sgv-hero-t"><span class="sgv-eye">الارتباط الاستراتيجي للمحفظة</span>
      <h2><b>${S.linked.length}</b> من ${S.total} شراكة تخدم أهداف المؤسسة</h2>
      <p>${S.goalsOn} من ${S.goals.length} أهداف تخدمها شراكات · ${S.initsOn} من ${S.initsAll} مبادرة · ${S.initsAll - S.initsOn ? `${S.initsAll - S.initsOn} مبادرة بلا شراكات` : 'كل المبادرات مغطاة'}</p>
      <div class="sgv-dist" role="img" aria-label="توزيع الشراكات على الأهداف">${S.goals.map((g) => g.ps.length ? `<i style="flex:${g.ps.length};background:${sgCol(g.k)}" title="${esc(g.k)}: ${g.ps.length}"><span>${esc(g.k)}</span><b>${g.ps.length}</b></i>` : '').join('')}</div>
      <div class="sgv-leg">${S.goals.map((g) => `<span><i style="background:${sgCol(g.k)}"></i>${esc(g.k)} <b>${Math.round(g.ps.length / L * 100)}%</b></span>`).join('')}</div></div>
    <div class="sgv-ring">${sgRing(pct, 150, 12)}<div><b>${Math.round(pct * 100)}%</b><span>تغطية المحفظة</span></div></div>
    ${S.pending.length ? `<div class="sgv-pend">${icon('alert')} ${S.pending.length} ارتباطًا مقترحًا آليًا بانتظار الاعتماد — <a href="#" data-sgv="rv">مراجعة الربط</a></div>` : ''}
  </section>`;
  const goals = S.goals.map((g) => {
    const c = sgCol(g.k), on = g.inits.filter((i) => i.ps.length).length;
    return `<section class="sgv-g ${g.ps.length ? '' : 'gap'}" style="--gc:${c}">
      <header class="sgv-gh">
        <span class="sgv-code">${esc(g.k)}</span>
        <div class="sgv-gt"><h3>${esc(g.t)}</h3><small>${g.inits.length ? `${on} من ${g.inits.length} مبادرات تخدمها شراكات` : ''}${g.noInit.length ? ` · ${g.noInit.length} مرتبطة بالهدف كاملًا` : ''}</small></div>
        <div class="sgv-gn"><div class="sgv-mring">${sgRing(g.inits.length ? on / g.inits.length : 0, 56, 6, c, 'var(--line)')}<span>${on}/${g.inits.length}</span></div><div><b>${g.ps.length}</b><small>${g.ps.length === 1 ? 'شراكة' : 'شراكات'}</small></div></div>
      </header>
      <div class="sgv-inits">${g.inits.map((i) => `<div class="sgv-i ${i.ps.length ? '' : 'gap'}">
          <div class="sgv-ih"><em>${esc(i.c.split('.')[1] || '')}</em><b>${esc(i.t)}</b><span class="sgv-in">${i.ps.length || ''}</span></div>
          ${i.ps.length ? `<div class="sgv-lgs">${i.ps.slice(0, 8).map(sgLogo).join('')}${i.ps.length > 8 ? `<span class="sgv-more">+${i.ps.length - 8}</span>` : ''}</div>` : `<div class="sgv-gap">${icon('alert')} فجوة — لا توجد شراكة تخدم هذه المبادرة</div>`}
        </div>`).join('')}</div>
      ${g.noInit.length ? `<div class="sgv-whole"><small>تخدم الهدف كاملًا</small><div class="sgv-lgs">${g.noInit.map(sgLogo).join('')}</div></div>` : ''}
    </section>`;
  }).join('');
  const un = `<section class="sgv-un"><h3>${icon('flag')} شراكات لا تحقق 75% من أي هدف أو مبادرة <span>${S.unlinked.length}</span></h3>
    ${S.unlinked.length ? `<div class="sg-ps wrap">${S.unlinked.map((p) => `<span class="sg-unp">${stratChip(p)}${stratMiniHTML(p)}</span>`).join('')}</div>` : '<p class="muted small">كل الشراكات تحقق الحد الأدنى لهدف أو مبادرة.</p>'}</section>`;
  return hero + `<div class="sgv-goals">${goals}</div>` + un;
}

/* ===== الطباعة: A4 أفقي — صفحة ملخص ثم صفحة لكل هدفين ===== */
function stratPrintHTML(S) {
  const o = D.settings.org, logo = (ASSET_IMG['murooj-logo'] || {}).src, pct = S.total ? S.linked.length / S.total : 0, L = Math.max(1, S.linked.length), maxG = Math.max(1, ...S.goals.map((g) => g.ps.length));
  const head = (t) => `<header class="sgp-h">${logo ? `<img src="${logo}" alt="">` : ''}<div><b>${esc(o.name)}</b><span>${esc(o.dept)}</span></div><div class="sgp-ht"><b>${t}</b><span>${fmtDate(isoDate(today()))}م</span></div></header>`;
  const pname = (p) => esc(partnerName(p));
  const p1 = `<div class="sgp-pg">${head('الارتباط الاستراتيجي للمحفظة')}
    <section class="sgp-hero"><div class="sgp-ring">${sgRing(pct, 120, 11, '#D9B467', 'rgba(255,255,255,.18)')}<div><b>${Math.round(pct * 100)}%</b><span>تغطية المحفظة</span></div></div>
      <div class="sgp-hk">${[[`${S.linked.length}/${S.total}`, 'شراكة تخدم الأهداف'], [`${S.goalsOn}/${S.goals.length}`, 'أهداف تخدمها شراكات'], [`${S.initsOn}/${S.initsAll}`, 'مبادرات تخدمها شراكات'], [S.initsAll - S.initsOn, 'مبادرة بلا شراكات (فجوة)']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div></section>
    <table class="sgp-t"><thead><tr><th>الهدف</th><th>الشراكات</th><th style="width:22%">التوزيع</th><th>المبادرات المغطاة</th><th>الفجوات (مبادرات بلا شراكات)</th></tr></thead><tbody>
      ${S.goals.map((g) => { const gaps = g.inits.filter((i) => !i.ps.length); return `<tr><td><span class="sgp-code" style="background:${sgCol(g.k)}">${esc(g.k)}</span>${esc(g.t)}</td><td class="c"><b>${g.ps.length}</b><small> (${Math.round(g.ps.length / L * 100)}%)</small></td><td><span class="sgp-bar"><i style="width:${(g.ps.length / maxG * 100).toFixed(0)}%;background:${sgCol(g.k)}"></i></span></td><td class="c">${g.inits.length - gaps.length} / ${g.inits.length}</td><td class="sgp-gaps">${gaps.length ? gaps.map((i) => esc(i.t)).join('، ') : '—'}</td></tr>`; }).join('')}
    </tbody></table>
    <p class="sgp-note">تُعدّ الشراكة تابعة لهدف أو مبادرة إذا حققت 75% على الأقل من قائمة التحقق (3 من 4 عناصر). ${S.pending.length ? `${S.pending.length} ارتباطًا ما زال مقترحًا آليًا بانتظار اعتماد إدارة الشراكات.` : 'كل الارتباطات معتمدة.'}</p>
    <footer class="sgp-f"><span>${esc(o.platform)}</span><span>المصدر: سجلات المنظومة لحظة الطباعة</span></footer></div>`;
  const pages = [];
  for (let k = 0; k < S.goals.length; k += 2) {
    pages.push(`<div class="sgp-pg">${head('الأهداف والمبادرات والشراكات')}<div class="sgp-gs">${S.goals.slice(k, k + 2).map((g) => `<section class="sgp-g" style="--gc:${sgCol(g.k)}"><h3><span class="sgp-code" style="background:${sgCol(g.k)}">${esc(g.k)}</span>${esc(g.t)}<em>${g.ps.length} ${g.ps.length === 1 ? 'شراكة' : 'شراكات'}</em></h3>
        <table class="sgp-t sm"><tbody>${g.inits.map((i) => `<tr class="${i.ps.length ? '' : 'gap'}"><td class="sgp-ic">${esc(i.c.split('.')[1] || '')}</td><td class="sgp-in">${esc(i.t)}</td><td class="c"><b>${i.ps.length || '—'}</b></td><td>${i.ps.length ? i.ps.map(pname).join('، ') : '<span class="sgp-gap">فجوة</span>'}</td></tr>`).join('')}
        ${g.noInit.length ? `<tr><td class="sgp-ic">—</td><td class="sgp-in">تخدم الهدف كاملًا</td><td class="c"><b>${g.noInit.length}</b></td><td>${g.noInit.map(pname).join('، ')}</td></tr>` : ''}</tbody></table></section>`).join('')}</div>
      <footer class="sgp-f"><span>${esc(o.platform)}</span><span>${k / 2 + 2}</span></footer></div>`);
  }
  if (S.unlinked.length) pages[pages.length - 1] = pages[pages.length - 1].replace('<footer class="sgp-f">', `<section class="sgp-un"><h3>شراكات لا تحقق 75% من أي هدف أو مبادرة (${S.unlinked.length})</h3><p>${S.unlinked.map(pname).join('، ')}</p></section><footer class="sgp-f">`);
  return `<article class="sgp" dir="rtl">${p1}${pages.join('')}</article>`;
}
function stratPrint(S) {
  document.querySelectorAll('#sgPrint').forEach((x) => x.remove());
  const host = document.createElement('div'); host.id = 'sgPrint'; host.innerHTML = stratPrintHTML(S);
  document.body.appendChild(host);
  const html = document.documentElement; html.classList.add('printing-sg');
  let st = $('#sgPage'); if (!st) { st = document.createElement('style'); st.id = 'sgPage'; document.head.appendChild(st); }
  st.textContent = '@page{size:A4 landscape;margin:9mm}';
  const done = () => { html.classList.remove('printing-sg'); st.textContent = ''; host.remove(); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => window.print(), 200);
}
