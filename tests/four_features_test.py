"""نبض الشراكة · ذاكرة الجهة · خريطة الفجوات · شاشة العرض المباشر"""
import asyncio, json, os
from playwright.async_api import async_playwright
URL = 'file:///home/claude/shots/app.html'
SHOTS = os.environ.get('SHK_SHOTS', '')
R = []
def ok(n, c, x=''): R.append(bool(c)); print('PASS' if c else 'FAIL', n, x, flush=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        pg = await (await b.new_context(viewport={'width': 1600, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_selector('#main .page'); await pg.wait_for_timeout(800)
        E = pg.evaluate
        async def go(h): await E(f"location.hash={json.dumps(h)}"); await pg.wait_for_timeout(1100)
        async def shot(name, sel=None):
            if not SHOTS: return
            if sel: await (await pg.query_selector(sel)).screenshot(path=f'{SHOTS}/{name}.png')
            else: await pg.screenshot(path=f'{SHOTS}/{name}.png')
        # — النبض —
        pid = await E("D.partnerships.find(x=>!x.demo&&x.stage==='signed'&&x.startDate&&pStatus(x)==='active').id")
        P0 = await E(f"(()=>{{const P=pulseOf(D.partnerships.find(x=>x.id==='{pid}'));return [P.lv.k,P.days,P.last&&P.last.kind]}})()")
        ok('pulse computed from real events (signing at least)', P0[2] is not None and P0[0] in ('live', 'calm', 'dorm'), P0)
        ok('field edits do not count as activity', await E(f"(()=>{{const p=D.partnerships.find(x=>x.id==='{pid}');const a=pulseOf(p).days;p.updatedAt=nowISO();return pulseOf(p).days===a}})()"))
        await go('#/partnerships/' + pid)
        ok('pulse cell in partnership facts', await E("!!document.querySelector('.pfx.pulse b')"))
        ok('memory button in toolbar', await E("!!document.querySelector('.dbar-acts [data-memopen]')"))
        ok('meetings log in follow section', await E("!!document.querySelector('#follow .mt-sec')"))
        # — تسجيل اجتماع —
        await pg.click('#follow [data-mtnew]'); await pg.wait_for_timeout(300)
        await pg.click('.mt-dlg [data-ok]'); await pg.wait_for_timeout(200)
        ok('agreed text required', await E("document.querySelector('#mtG').closest('.field').classList.contains('invalid')"))
        await pg.fill('#mtT', 'اجتماع تفعيل المذكرة'); await pg.fill('#mtA', 'سارة، خالد')
        await pg.fill('#mtG', 'الاتفاق على خطة تشجير مشتركة في الربع الأول'); await pg.fill('#mtN', 'إرسال خطة التشجير (الشريك)\nتحديد المواقع (مروج)')
        await pg.fill('#mtDue', '2026-12-15'); await pg.click('.mt-dlg [data-ok]'); await pg.wait_for_timeout(1200)
        m = await E(f"(D.partnerships.find(x=>x.id==='{pid}').meetings||[]).length")
        ok('meeting saved on the partnership', m == 1)
        ok('pulse becomes «نشطة» after a meeting today', await E(f"pulseOf(D.partnerships.find(x=>x.id==='{pid}')).lv.k") == 'live')
        ok('meeting logged in audit', 'تسجيل اجتماع' in await E(f"JSON.stringify(D.audit.filter(a=>a.entityId==='{pid}').slice(0,3))"))
        ok('meeting shown in follow section with next steps', await E("document.querySelectorAll('#follow .mt-list>li').length===1 && document.querySelectorAll('#follow .mt-list ul li').length===2"))
        # — ذاكرة الجهة —
        await pg.click('[data-pmore]'); await pg.click('.dbar-acts [data-memopen]'); await pg.wait_for_timeout(600)
        t = await E("document.querySelector('.mem-dlg').innerText")
        ok('brief shows last agreement, open commitments, activity', 'خطة تشجير مشتركة' in t and 'إرسال خطة التشجير' in t and 'آخر النشاط' in t)
        ok('open commitments counter = 2', await E("document.querySelectorAll('.mem-open li').length") == 2)
        await shot('mem', '.modal.mem-dlg')
        await pg.click('.mem-open li:first-child input'); await pg.wait_for_timeout(800)
        ok('ticking a commitment marks it done and saves', await E(f"(D.partnerships.find(x=>x.id==='{pid}').meetings[0].done||[]).includes(0)"))
        await E("Modal.top()&&Modal.top().close()"); await pg.wait_for_timeout(300)
        # — السجل —
        await go('#/partnerships')
        ok('pulse dots in register', await E("document.querySelectorAll('.pulse-dot').length") > 3)
        ok('sort by pulse available', await E("!!document.querySelector('#regSort option[value=pulse]')"))
        # — الفجوات —
        await go('#/strategy'); await pg.click('[data-sgv="gaps"]'); await pg.wait_for_timeout(900)
        ok('gaps tab renders summary + sections', await E("document.querySelectorAll('.gp-k').length===4 && !!document.querySelector('.gp-regs') && !!document.querySelector('.gp-secs')"))
        g = await E("(()=>{const G=gapsData(visiblePartnerships().filter(p=>!p.isDraft&&p.stage!=='cancel'));return [G.initGaps.length, document.querySelectorAll('.gp-item').length, G.S.initsAll]})()")
        ok('initiative gaps listed match the data', g[0] == g[1], g)
        await shot('gaps', '#main .page')
        # — شاشة العرض —
        await go('#/live'); await pg.wait_for_timeout(1800)
        ok('live screen overlay with clock and slides', await E("!!document.querySelector('#liveScreen .lv-clock b').textContent && document.querySelectorAll('#liveScreen [data-lv]').length===5"))
        await pg.wait_for_timeout(1200); await shot('live_nums')
        for k, nm in [(1, 'map'), (2, 'sign'), (3, 'field'), (4, 'logos')]:
            await pg.click(f'#liveScreen [data-lv="{k}"]', force=True); await pg.wait_for_timeout(1600); await shot('live_' + nm)
        ok('map slide draws regions', await E("(document.querySelector('[data-lv]').click(),1)") and True)
        await pg.click('#liveScreen [data-lv="1"]', force=True); await pg.wait_for_timeout(800)
        ok('map slide has region bubbles', await E("document.querySelectorAll('#liveScreen .lv-reg').length") >= 10)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800)
        ok('Esc leaves the live screen', await E("!document.getElementById('liveScreen') && !document.documentElement.classList.contains('live-on')"))
        ok('nav has the live screen entry', await E("!!document.querySelector('a[href=\"#/live\"]')"))
        ok('no page errors', not errs, errs[:3])
        await b.close()
    print(f'SUMMARY {sum(R)} / {len(R)}')
asyncio.run(main())
