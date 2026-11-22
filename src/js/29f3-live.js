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
  { k: 'brief', t: 'الملخص التنفيذي', s: 18 },
  { k: 'strategy', t: 'المواءمة مع الاستراتيجية', s: 18 },
  { k: 'map', t: 'الانتشار الجغرافي', s: 16 },
  { k: 'spot', t: 'شراكات في الواجهة', s: 24 },
  { k: 'sectors', t: 'تنوع الشركاء', s: 16 },
  { k: 'attn', t: 'يتطلب اهتمامكم', s: 18 },
  { k: 'impact', t: 'الأثر الميداني', s: 16 },
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
  return { L: L_, c, signed, thisYear: byYear(y), lastYear: byYear(y - 1), y, S, regions, sectors, awaitMin, preparing, expiring, stories, outputs };
}
function liveMapSVG(R) {
  const max = Math.max(1, ...KSA_REGIONS.map(([n]) => R[n] || 0));
  const W = 1000, H = 760, lon0 = 34.4, lon1 = 55.8, lat0 = 16.2, lat1 = 32.3, k = Math.cos(24 * Math.PI / 180);
  const sc = Math.min((W - 60) / ((lon1 - lon0) * k), (H - 60) / (lat1 - lat0));
  const ox = (W - (lon1 - lon0) * k * sc) / 2, oy = (H - (lat1 - lat0) * sc) / 2;
  const xy = (lon, lat) => [ox + (lon - lon0) * k * sc, oy + (lat1 - lat) * sc];
  const path = TALE_KSA.map(([a, b], i) => { const [x, y] = xy(a, b); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('') + 'Z';
  const b = KSA_REGIONS.map(([n, lon, lat], i) => { const c = R[n] || 0, [x, y] = xy(lon, lat), r = c ? 12 + Math.sqrt(c / max) * 30 : 4;
    return `<g class="lx-reg ${c ? '' : 'zero'}" style="--i:${i}">${c ? `<circle class="lx-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 10).toFixed(1)}"/>` : ''}<circle class="lx-b" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>${c ? `<text x="${x.toFixed(1)}" y="${(y + 8).toFixed(1)}" class="lx-n">${c}</text>` : ''}</g>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="lx-map" aria-hidden="true"><defs><linearGradient id="lxLand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#174B3F"/><stop offset="1" stop-color="#0E3830"/></linearGradient></defs><path d="${path}" class="lx-land"/>${b}</svg>`;
}
const lxHead = (n, total, t, sub) => `<div class="lx-chh"><span class="lx-chn">${String(n).padStart(2, '0')}<i>/${String(total).padStart(2, '0')}</i></span><div><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
function liveChapterHTML(k, X, n, total) {
  const org = esc(D.settings.org.name);
  if (k === 'brief') {
    const d = X.thisYear - X.lastYear;
    const goalsOn = X.S ? X.S.goalsOn : 0, goalsN = X.S ? X.S.goals.length : 0;
    return `${lxHead(n, total, 'الملخص التنفيذي', `محفظة شراكات ${org}`)}
      <p class="lx-lead">تعمل ${org} مع <b>${lvN(X.c.partners)}</b> جهة شريكة من القطاعات الحكومية والخاصة وغير الربحية والتعليمية، منها <b>${lvN(X.c.active)}</b> شراكة سارية تُتابَع مخرجاتها.</p>
      <div class="lx-kpis">
        <div><b class="lx-cu" data-v="${X.c.partners}">0</b><span>جهة شريكة</span></div>
        <div><b class="lx-cu" data-v="${X.c.active}">0</b><span>شراكة سارية</span></div>
        <div><b class="lx-cu" data-v="${X.thisYear}">0</b><span>شراكة وُقّعت في ${X.y}</span>${X.lastYear ? `<small class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)} مقارنة بـ${X.y - 1}</small>` : ''}</div>
        ${goalsN ? `<div><b>${goalsOn}<i>/${goalsN}</i></b><span>أهداف استراتيجية تخدمها الشراكات</span></div>` : ''}
      </div>`;
  }
  if (k === 'strategy' && X.S) {
    const S = X.S, pct = S.total ? Math.round(S.linked.length / S.total * 100) : 0, max = Math.max(1, ...S.goals.map((g) => g.ps.length));
    return `${lxHead(n, total, 'المواءمة مع الاستراتيجية', `${pct}% من الشراكات مرتبطة بهدف أو مبادرة استراتيجية`)}
      <div class="lx-goals">${S.goals.map((g, i) => { const on = g.inits.filter((x) => x.ps.length).length; return `<div class="lx-g" style="--c:${(typeof SG_COL !== 'undefined' && SG_COL[g.k]) || '#B08A3E'};--i:${i}"><span class="lx-gk">${esc(g.k)}</span><div class="lx-gt"><b>${esc(String(g.t).replace(/^[A-Z]+\d?\s*[:：]\s*/, ''))}</b><i><em style="width:${Math.round(g.ps.length / max * 100)}%"></em></i></div><div class="lx-gv"><b>${g.ps.length}</b><small>شراكة · ${on}/${g.inits.length} مبادرات</small></div></div>`; }).join('')}</div>`;
  }
  if (k === 'map') {
    const top = KSA_REGIONS.map(([r]) => [r, X.regions[r] || 0]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
    const nat = X.regions[KSA_NATIONAL] || 0, covered = top.length;
    return `${lxHead(n, total, 'الانتشار الجغرافي', `شراكات في ${covered} من ${KSA_REGIONS.length} مناطق${nat ? ` · ${nat} على مستوى المملكة` : ''}`)}
      <div class="lx-geo"><div class="lx-mapw">${liveMapSVG(X.regions)}</div>
        <ol class="lx-rank">${top.slice(0, 6).map(([r, c], i) => `<li style="--i:${i}"><span>${esc(r)}</span><i><em style="width:${Math.round(c / (top[0][1] || 1) * 100)}%"></em></i><b>${c}</b></li>`).join('')}${nat ? `<li class="nat"><span>على مستوى المملكة</span><i></i><b>${nat}</b></li>` : ''}</ol></div>`;
  }
  if (k === 'spot') {
    const s = X.signed.slice(0, 3);
    return `${lxHead(n, total, 'شراكات في الواجهة', 'أحدث الشراكات الموقّعة')}
      <div class="lx-spot">${s.map((p, i) => { const ph = partnershipPhotos(p)[0], pr = partnerById(p.partnerId), areas = richItems(p.cooperationAreas).slice(0, 3);
        return `<article class="lx-sp ${i === 0 ? 'on' : ''}" data-sp="${i}"><div class="lx-spm">${ph ? `<img data-file="${esc(ph.fileId)}" alt="">` : coverHTML(p.id, null, { W: 900, H: 600 })}</div>
          <div class="lx-spb"><div class="lx-spl">${plateHTML(pr, 96)}</div><small>${esc(p.classification || 'شراكة')} · وُقّعت ${fmtDate(signedOn(p))}م</small><h3>${esc(partnerName(p))}</h3>
          ${areas.length ? `<ul>${areas.map((a) => `<li>${esc(trimP(a.title || String(a.text || '').split(/[:،.]/)[0]).slice(0, 90))}</li>`).join('')}</ul>` : ''}</div></article>`; }).join('')}
        <div class="lx-spd">${s.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div></div>`;
  }
  if (k === 'sectors') {
    const order = ['حكومي', 'شبه حكومي', 'خاص', 'غير ربحي', 'تعليمي'];
    const keys = [...order.filter((s) => X.sectors[s]), ...Object.keys(X.sectors).filter((s) => !order.includes(s))];
    return `${lxHead(n, total, 'تنوع الشركاء', 'الجهات الشريكة حسب القطاع')}
      <div class="lx-secs">${keys.map((s, i) => { const ids = [...X.sectors[s]], prs = ids.map(partnerById).filter(Boolean); const lg = prs.filter((x) => x.logoFileId).slice(0, 6);
        return `<div class="lx-sec" style="--i:${i}"><b class="lx-cu" data-v="${ids.length}">0</b><span>${esc(s)}</span><div class="lx-secl">${lg.map((pr) => plateHTML(pr, 64)).join('')}</div></div>`; }).join('')}</div>`;
  }
  if (k === 'attn') {
    const row = (p, tag, cls = '') => `<li class="${cls}">${plateHTML(partnerById(p.partnerId), 56)}<div><b>${esc(partnerName(p))}</b><small>${esc(p.classification || 'شراكة')}</small></div><em>${tag}</em></li>`;
    const has = X.awaitMin.length || X.expiring.length || X.preparing.length;
    return `${lxHead(n, total, 'يتطلب اهتمامكم', has ? 'معاملات وقرارات قريبة' : '')}
      ${has ? `<div class="lx-attn">
        <section><h4><span>${X.awaitMin.length}</span>بانتظار موافقة المعالي</h4>${X.awaitMin.length ? `<ul>${X.awaitMin.slice(0, 4).map((p) => row(p, 'المعاملة لدى مكتب المعالي', 'gold')).join('')}</ul>` : '<p>لا معاملات بانتظار الموافقة.</p>'}
          ${X.preparing.length ? `<p class="lx-prep">و${plural(X.preparing.length, 'معاملة واحدة', 'معاملتان', 'معاملات', 'معاملة')} في مرحلة إعداد خطاب طلب الموافقة.</p>` : ''}</section>
        <section><h4><span>${X.expiring.length}</span>شراكات تنتهي قريبًا</h4>${X.expiring.length ? `${X.expiring.length > 4 ? '' : ''}<ul>${X.expiring.slice(0, 4).map(({ p, d }) => row(p, `خلال ${plural(d, 'يوم واحد', 'يومين', 'أيام', 'يومًا')}`, d <= 30 ? 'red' : '')).join('')}</ul>` : '<p>لا شراكات تنتهي خلال الفترة القريبة.</p>'}</section>
      </div>` : '<div class="lx-calm"><b>لا توجد معاملات أو قرارات معلّقة</b><span>جميع الشراكات تسير وفق المسار المعتمد.</span></div>'}`;
  }
  if (k === 'impact') {
    const st = X.stories.slice(0, 3);
    return `${lxHead(n, total, 'الأثر الميداني', st.length ? `${plural(X.stories.length, 'قصة أثر موثّقة', 'قصتا أثر موثّقتان', 'قصص أثر موثّقة', 'قصة أثر موثّقة')} · ${lvN(X.outputs)} مخرجًا مستهدفًا في الشراكات الموقّعة` : '')}
      <div class="lx-imp">${st.map((a, i) => `<article style="--i:${i}"><div class="lx-impm">${coverHTML('story' + a.id, a.coverFileId, { W: 700, H: 460 })}${a.metricValue ? `<span><b>${esc(a.metricValue)}</b>${esc(a.metricLabel || '')}</span>` : ''}</div><h3>${esc(a.title)}</h3><small>${(() => { const sp = storyPartner(a); const nm = sp ? sp.name : ''; return (nm ? esc(nm) + ' · ' : '') + fmtDate(a.date, 'month'); })()}</small></article>`).join('')}</div>`;
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
  const pick = (X) => LIVE_CH.filter((c) => !(cfg.off || []).includes(c.k)).filter((c) => (c.k === 'impact' ? X.stories.length : c.k === 'spot' ? X.signed.length : c.k === 'strategy' ? !!X.S : true));
  box.innerHTML = `<div class="lx-bg" aria-hidden="true"></div>
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
    const dur = (cfg.sec ? sec() : c.s) * 1000;
    box.querySelector('#lxNav').innerHTML = chs.map((x, k) => `<button type="button" data-lx="${k}" class="${k === i ? 'on' : ''}" style="--ms:${k === i ? dur : 0}ms"><i></i><span>${x.t}</span></button>`).join('');
    const tk = liveTicker(X), tr = box.querySelector('#lxTick');
    if (tr.dataset.v !== tk) { tr.dataset.v = tk; tr.innerHTML = tk ? `<div>${tk}<i>◆</i></div><div aria-hidden="true">${tk}<i>◆</i></div>` : ''; tr.style.setProperty('--dur', Math.max(30, tk.length / 9) + 's'); }
    clearInterval(spT);
    if (c.k === 'spot') { let s = 0; const all = st.querySelectorAll('.lx-sp'), dots = st.querySelectorAll('.lx-spd i'); if (all.length > 1) spT = setInterval(() => { all[s].classList.remove('on'); dots[s].classList.remove('on'); s = (s + 1) % all.length; all[s].classList.add('on'); dots[s].classList.add('on'); }, Math.round(dur / all.length)); }
    clearTimeout(T); T = setTimeout(() => show(i + 1), dur);
  };
  const panel = () => {
    const p = box.querySelector('#lxPanel'); p.hidden = !p.hidden; if (p.hidden) return;
    p.innerHTML = `<h3>إعداد الشاشة</h3><p>يُحفظ في هذا الجهاز فقط.</p><div class="lx-pl">${LIVE_CH.map((c) => `<label><input type="checkbox" data-lxon="${c.k}" ${(cfg.off || []).includes(c.k) ? '' : 'checked'}> ${c.t}</label>`).join('')}</div>
      <label class="lx-ps">مدة كل فصل <select data-lxsec><option value="">تلقائية حسب الفصل</option>${[10, 15, 20, 30, 45, 60].map((s) => `<option value="${s}" ${+cfg.sec === s ? 'selected' : ''}>${s} ثانية</option>`).join('')}</select></label>
      <button type="button" class="lx-pok" data-lxdone>تم</button>`;
  };
  const stop = () => { clearTimeout(T); clearInterval(spT); clearInterval(box._clk); box.remove(); document.documentElement.classList.remove('live-on'); window.removeEventListener('hashchange', onHash); document.removeEventListener('keydown', onKey); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) { /* */ } };
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
