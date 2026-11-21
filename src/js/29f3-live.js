/* =====================================================================
   شاشة العرض المباشر (#/live) — للشاشة في استقبال المؤسسة أو قاعة الاجتماعات
   تدور تلقائيًا بين: الأرقام · خريطة الشراكات · أحدث التوقيعات · من الميدان · شركاؤنا
   البيانات حيّة: المنصة المشتركة تُحدَّث كل 15 ثانية، والشرائح تُعاد بناؤها في كل دورة.
   ===================================================================== */
const LIVE_SLIDES = [['nums', 'بالأرقام'], ['map', 'خريطة الشراكات'], ['sign', 'أحدث التوقيعات'], ['field', 'من الميدان'], ['logos', 'شركاؤنا']];
const LIVE_MS = 12000;
function liveData() {
  const L_ = visiblePartnerships({ includeDrafts: false }).filter((p) => p.stage !== 'cancel');
  const c = liveCounts(), y = String(today().getFullYear());
  const td = isoDate(today()), signed = L_.filter((p) => p.stage === 'signed' && p.startDate && String(p.startDate).slice(0, 10) <= td).sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const photos = L_.flatMap((p) => (p.attachments || []).filter((a) => a.category === 'صور الشراكة' && /^image\//.test(a.type || 'image/')).map((a) => ({ a, p }))).sort((x, z) => ((x.a.addedAt || '') < (z.a.addedAt || '') ? 1 : -1));
  const logos = D.partners.filter((pr) => pr.logoFileId && L_.some((p) => p.partnerId === pr.id));
  return { L: L_, c, signed, thisYear: signed.filter((p) => String(p.startDate).slice(0, 4) === y).length, outputs: L_.filter((p) => p.stage === 'signed').reduce((t, p) => t + richItems(p.outputs).length, 0), photos, logos, stories: publicStories().length };
}
function liveMapSVG(L_) {
  const R = {}; L_.forEach((p) => { const g = pRegion(p).r || ''; R[g] = (R[g] || 0) + 1; });
  const max = Math.max(1, ...KSA_REGIONS.map(([n]) => R[n] || 0));
  const W = 1000, H = 760, lon0 = 34.4, lon1 = 55.8, lat0 = 16.2, lat1 = 32.3, k = Math.cos(24 * Math.PI / 180);
  const sc = Math.min((W - 60) / ((lon1 - lon0) * k), (H - 60) / (lat1 - lat0));
  const ox = (W - (lon1 - lon0) * k * sc) / 2, oy = (H - (lat1 - lat0) * sc) / 2;
  const xy = (lon, lat) => [ox + (lon - lon0) * k * sc, oy + (lat1 - lat) * sc];
  const path = TALE_KSA.map(([a, b], i) => { const [x, y] = xy(a, b); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('') + 'Z';
  const b = KSA_REGIONS.map(([n, lon, lat], i) => { const c = R[n] || 0, [x, y] = xy(lon, lat), r = c ? 16 + Math.sqrt(c / max) * 34 : 5;
    return `<g class="lv-reg ${c ? '' : 'zero'}" style="--i:${i}">${c ? `<circle class="lv-pulse" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>` : ''}<circle class="lv-b" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>${c ? `<text x="${x.toFixed(1)}" y="${(y + 7).toFixed(1)}" class="lv-n">${c}</text><text x="${x.toFixed(1)}" y="${(y + r + 24).toFixed(1)}" class="lv-l">${esc(n)}</text>` : ''}</g>`; }).join('');
  const nat = R[KSA_NATIONAL] || 0;
  return `<svg viewBox="0 0 ${W} ${H}" class="lv-map" aria-hidden="true"><path d="${path}" class="lv-land"/>${b}</svg>${nat ? `<div class="lv-nat"><b>${nat}</b><span>شراكة على مستوى المملكة</span></div>` : ''}`;
}
function liveSlideHTML(id, X) {
  if (id === 'nums') {
    const N = [[X.c.partners, 'جهة شريكة'], [X.c.active, 'شراكة سارية'], [X.thisYear, `شراكة وُقّعت في ${today().getFullYear()}`], [X.outputs, 'مخرجًا مستهدفًا'], ...(X.stories ? [[X.stories, 'قصة أثر موثّقة']] : [])];
    return `<div class="lv-nums">${N.map(([v, l], i) => `<div style="--i:${i}"><b class="lv-cu" data-v="${v}">0</b><span>${l}</span></div>`).join('')}</div>`;
  }
  if (id === 'map') return `<div class="lv-mapw">${liveMapSVG(X.L)}</div>`;
  if (id === 'sign') {
    const s = X.signed.slice(0, 3);
    return s.length ? `<div class="lv-sign">${s.map((p, i) => { const ph = partnershipPhotos(p)[0]; const pr = partnerById(p.partnerId); return `<article style="--i:${i}"><div class="lv-ph">${ph ? `<img data-file="${esc(ph.fileId)}" alt="">` : coverHTML(p.id, null, { W: 600, H: 380 })}</div><div class="lv-sb">${plateHTML(pr, 64)}<div><b>${esc(partnerName(p))}</b><span>${esc(p.classification || 'شراكة')} · وُقّعت ${fmtDate(p.startDate)}</span></div></div></article>`; }).join('')}</div>` : '<p class="lv-empty">لا توجد توقيعات مسجّلة بعد.</p>';
  }
  if (id === 'field') {
    const ph = X.photos.slice(0, 7);
    return ph.length ? `<div class="lv-field n${ph.length}">${ph.map(({ a, p }, i) => `<figure style="--i:${i}"><img data-file="${esc(a.fileId)}" alt=""><figcaption>${esc(partnerName(p))}</figcaption></figure>`).join('')}</div>` : '<p class="lv-empty">لم تُرفع صور بعد.</p>';
  }
  if (id === 'logos') return `<div class="lv-logos">${X.logos.slice(0, 40).map((pr, i) => `<span style="--i:${i}">${plateHTML(pr, 88)}</span>`).join('')}</div>`;
  return '';
}
function renderLive(el) {
  const logo = (ASSET_IMG['murooj-logo-white'] || ASSET_IMG['murooj-logo'] || {}).src;
  el.innerHTML = '<div class="lv-hold"></div>';
  document.getElementById('liveScreen')?.remove();
  const box = document.createElement('div'); box.id = 'liveScreen'; box.className = 'lv'; box.setAttribute('dir', 'rtl');
  box.innerHTML = `<header class="lv-top">${logo ? `<img src="${logo}" alt="">` : ''}<div class="lv-tt"><b>منظومة الشراكات</b><span><i class="lv-dot"></i>مباشر</span></div><div class="lv-clock"><b id="lvTime"></b><span id="lvDate"></span></div></header>
    <main class="lv-stage"><h2 class="lv-h" id="lvH"></h2><div class="lv-body" id="lvBody"></div></main>
    <footer class="lv-foot"><div class="lv-dots">${LIVE_SLIDES.map(([k, l], i) => `<button type="button" data-lv="${i}" title="${l}"><i></i><span>${l}</span></button>`).join('')}</div>
      <div class="lv-ctl"><button type="button" data-lvfs title="ملء الشاشة">${icon('expand')}</button><button type="button" data-lvx title="خروج (Esc)">${icon('x')}</button></div></footer>`;
  document.body.appendChild(box); document.documentElement.classList.add('live-on');
  let i = 0, T = null, idle = null;
  const clock = () => { const d = new Date(); const t = box.querySelector('#lvTime'); if (!t) return; t.textContent = d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
    try { box.querySelector('#lvDate').textContent = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) + ' · ' + fmtDate(isoDate(d)) + 'م'; } catch (_) { /* */ } };
  const show = (n) => {
    i = (n + LIVE_SLIDES.length) % LIVE_SLIDES.length;
    const X = liveData(); const [id, t] = LIVE_SLIDES[i];
    box.querySelector('#lvH').textContent = t;
    const body = box.querySelector('#lvBody'); body.className = 'lv-body s-' + id; body.innerHTML = liveSlideHTML(id, X); hydrateFiles(body);
    body.querySelectorAll('.lv-cu').forEach((b) => { const v = +b.dataset.v, t0 = performance.now(); const f = (now) => { const k = Math.min(1, (now - t0) / 1400); b.textContent = nf(Math.round(v * (1 - Math.pow(1 - k, 3)))); if (k < 1 && document.body.contains(b)) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    box.querySelectorAll('[data-lv]').forEach((d, k) => { d.classList.toggle('on', k === i); d.style.setProperty('--ms', LIVE_MS + 'ms'); });
    clearTimeout(T); T = setTimeout(() => show(i + 1), LIVE_MS);
  };
  const stop = () => { clearTimeout(T); clearInterval(box._clk); box.remove(); document.documentElement.classList.remove('live-on'); window.removeEventListener('hashchange', onHash); document.removeEventListener('keydown', onKey); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) { /* */ } };
  const onHash = () => { if (!location.hash.startsWith('#/live')) stop(); };
  const onKey = (e) => { if (e.key === 'Escape') { history.length > 1 ? history.back() : go('#/'); } else if (e.key === 'ArrowLeft') show(i + 1); else if (e.key === 'ArrowRight') show(i - 1); };
  window.addEventListener('hashchange', onHash); document.addEventListener('keydown', onKey);
  box.addEventListener('click', (e) => {
    const d = e.target.closest('[data-lv]'); if (d) return show(+d.dataset.lv);
    if (e.target.closest('[data-lvx]')) return history.length > 1 ? history.back() : go('#/');
    if (e.target.closest('[data-lvfs]')) { try { document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen(); } catch (_) { /* */ } }
  });
  box.addEventListener('mousemove', () => { box.classList.add('cur'); clearTimeout(idle); idle = setTimeout(() => box.classList.remove('cur'), 2500); });
  clock(); box._clk = setInterval(clock, 15000); show(0);
}
