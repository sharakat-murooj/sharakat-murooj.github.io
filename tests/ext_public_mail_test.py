"""روابط الجهات الخارجية v2: الرابط العام والخاص، والمراسلة بالبريد الإلكتروني.
يتطلب: Postgres محلي عليه schema.sql + external_proposals.sql + external_links_v2.sql، وخادمًا يحاكي PostgREST
يمرّر /functions/v1/shk-mail إلى دالة Deno المحلية (supabase/functions/shk-mail)، وخادم SMTP تجريبيًا على 127.0.0.1:2525
يحفظ الرسائل في المجلد SHK_MAIL_DIR."""
import asyncio, json, os, glob, email, tempfile
from email import policy
import psycopg2
PW = json.load(open(os.environ['SHK_TEST_PW']))
CURL = os.environ.get('SHK_CLOUD_URL', 'http://127.0.0.1:54400'); CKEY = os.environ.get('SHK_CLOUD_KEY', 'sb_publishable_test')
MAILS = os.environ['SHK_MAIL_DIR']
from playwright.async_api import async_playwright
URL = 'file:///home/claude/shots/app.html'
R = []
def ok(n, c, x=''): R.append(bool(c)); print('PASS' if c else 'FAIL', n, x, flush=True)
def sql(q, *a):
    c = psycopg2.connect(host=os.environ['SHK_PG'], port=int(os.environ.get('SHK_PG_PORT', 54329)), user='postgres', dbname='postgres'); c.autocommit = True
    cur = c.cursor(); cur.execute(q, a or None); r = cur.fetchall() if cur.description else None; c.close(); return r
def mails():
    out = []
    for f in sorted(glob.glob(os.path.join(MAILS, '*.eml'))):
        m = email.message_from_bytes(open(f, 'rb').read(), policy=policy.default)
        body = ''
        for part in m.walk():
            if part.get_content_type() == 'text/html': body = part.get_content()
        out.append({'to': m['To'], 'from': m['From'], 'subject': str(m['Subject']), 'html': body})
    return out
async def wait_mail(n, t=20):
    for _ in range(t * 2):
        if len(mails()) >= n: return True
        await asyncio.sleep(0.5)
    return False
CFG = f"localStorage.setItem('shk_auth_force','1');localStorage.setItem('shk_cloud_force','1');localStorage.setItem('shk_cloud_url','{CURL}');localStorage.setItem('shk_cloud_key','{CKEY}')"
async def main():
    for f in glob.glob(os.path.join(MAILS, '*.eml')): os.remove(f)
    sql('truncate shk_invites, shk_ext_tracks, shk_mail_queue, shk_mail_config'); sql("delete from shk_records where col='proposals' and data->>'external'='true'")
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        errs = []
        async def device():
            ctx = await b.new_context(viewport={'width': 1366, 'height': 900}); pg = await ctx.new_page(); pg.set_default_timeout(20000)
            pg.on('pageerror', lambda e: errs.append(str(e))); return ctx, pg
        ctxA, A = await device()
        await A.goto(URL); await A.evaluate(CFG); await A.reload(); await A.wait_for_selector('#shkLogin #lgPw')
        await A.fill('#lgUser', await A.evaluate("accUser(authAccounts().find(a=>a.id==='admin'))")); await A.fill('#lgPw', PW['admin']); await A.click('#shkLogin .lg-go'); await A.wait_for_timeout(1500)
        if await A.evaluate("!!document.querySelector('.modal [data-ok]')"): await A.click('.modal [data-ok]'); await A.wait_for_timeout(2500)
        await A.evaluate("location.hash='#/settings/external'"); await A.wait_for_timeout(2000)
        # — إعداد البريد —
        ok('mail settings panel shown', await A.evaluate("!!document.querySelector('.ml-panel [data-mlsave]')"))
        await A.select_option('[data-ml="provider"]', 'smtp'); await A.wait_for_timeout(300)
        await A.click('.ml-on .switch'); await A.wait_for_timeout(300)
        await A.fill('[data-ml="fromEmail"]', 'partnerships@murooj.test'); await A.fill('[data-ml="fromName"]', 'إدارة الشراكات')
        await A.fill('[data-ml="smtpHost"]', '127.0.0.1'); await A.fill('[data-ml="smtpPort"]', '2525'); await A.fill('[data-ml="smtpUser"]', 'partnerships@murooj.test')
        await A.fill('[data-ml="secret"]', 'app-pass-123'); await A.fill('[data-ml="siteUrl"]', 'https://example.test/')
        await A.click('[data-mlsave]'); await A.wait_for_timeout(1500)
        row = sql("select enabled, provider, from_email, secret, smtp_port from shk_mail_config")[0]
        ok('mail config saved on server (password only there)', row == (True, 'smtp', 'partnerships@murooj.test', 'app-pass-123', 2525), row[:3])
        got = await A.evaluate("Cloud.rpc('shk_mail_get',{p_token:Cloud.token()}).then(r=>JSON.stringify(r))")
        ok('password never returned to the browser', 'app-pass-123' not in got and json.loads(got)['hasSecret'] is True)
        ok('secret field shows «محفوظة» placeholder, empty value', await A.evaluate("(()=>{const i=document.querySelector('[data-ml=secret]');return i.value==='' && /محفوظة/.test(i.placeholder)})()"))
        anon = sql("set role anon; select has_table_privilege('anon','shk_mail_config','select')")
        ok('anon cannot read mail config table', anon[0][0] is False)
        await A.fill('#mlTo', 'me@test.example'); await A.click('[data-mltest]')
        ok('test email delivered', await wait_mail(1) and 'رسالة تجريبية' in mails()[0]['subject'] and 'me@test.example' in mails()[0]['to'], mails()[:1] and mails()[0]['subject'])
        await A.wait_for_timeout(800)
        ok('settings report the sent test', 'أُرسلت الرسالة التجريبية' in await A.evaluate("document.querySelector('.ml-panel').textContent"))
        # — رابط عام —
        await A.select_option('#exKind', 'public'); await A.wait_for_timeout(300)
        ok('public link: long durations incl. «مفتوح حتى أوقفه» selected by default', await A.evaluate("document.querySelector('[data-exd].on').dataset.exd") == 'open' and await A.evaluate("!!document.querySelector('[data-exd=\"730\"]')"))
        ok('public link: unlimited submissions, no per-link count chips', await A.evaluate("!document.querySelector('[data-exu]') && /غير محدود/.test(document.querySelector('.sh-new').textContent)"))
        await A.fill('#exLabel', 'حملة تويتر'); await A.click('[data-exmake]'); await A.wait_for_timeout(1500)
        plink = await A.evaluate("(document.querySelector('#exUrl')||{}).value||''")
        ok('public link created', '?propose=' in plink and sql("select kind, max_uses, expires_at > now() + interval '9 years' from shk_invites")[0] == ('public', 1000000, True))
        ok('list shows «عام» and «مفتوح»', await A.evaluate("/عام/.test(document.querySelector('.sh-tbl').textContent) && /مفتوح/.test(document.querySelector('.sh-tbl').textContent)"))
        # — رابط خاص —
        await A.select_option('#exKind', 'private'); await A.wait_for_timeout(300)
        await A.fill('#exLabel', 'جامعة الاختبار'); await A.click('[data-exmake]'); await A.wait_for_timeout(1500)
        vlink = await A.evaluate("(document.querySelector('#exUrl')||{}).value||''")
        ok('private link created', '?propose=' in vlink and vlink != plink)
        tok = lambda u: u.split('propose=')[1]
        # — زائر الرابط العام —
        ctxE, Ex = await device()
        await Ex.goto(URL); await Ex.evaluate(CFG); await Ex.goto(URL + '?propose=' + tok(plink)); await Ex.wait_for_selector('.ext-form')
        ok('public form: no strategy section', await Ex.evaluate("!document.querySelector('[data-k=strategicGoal]') && !/الاستراتيجية/.test(document.querySelector('.ext-form').textContent)"))
        ok('public form: open invitation wording (no «دعوة من»)', await Ex.evaluate("!/دعوة من/.test(document.querySelector('.ext-intro').textContent) && /اقترح شراكة مع/.test(document.querySelector('.ext-intro h1').textContent)"))
        ok('public form: email required and tells about email updates', await Ex.evaluate("/تحديث لحالة المقترح/.test(document.querySelector('[data-k=requesterEmail]').closest('.ext-f').textContent) && /بريدكم/.test(document.querySelector('.ext-intro').textContent)"))
        ok('honeypot field hidden', await Ex.evaluate("getComputedStyle(document.querySelector('.ext-hp')).opacity==='0'"))
        ok('no horizontal scroll and form painted in view (honeypot not offscreen)', await Ex.evaluate("document.documentElement.scrollWidth<=innerWidth+1 && scrollX===0 && document.querySelector('.ext-card').getBoundingClientRect().left>=0"))
        await Ex.fill('[data-k=partnerName]', 'شركة من تويتر'); await Ex.fill('[data-k=requesterName]', 'سارة'); await Ex.fill('[data-k=requesterEmail]', 'sara@visitor.test')
        await Ex.fill('[data-k=targets]', 'حملة تشجير مشتركة')
        tmp = tempfile.mkdtemp(); fp = os.path.join(tmp, 'تعريف.pdf'); open(fp, 'wb').write(b'%PDF-1.4 test')
        await Ex.set_input_files('#exFiles input[type=file]', fp); await Ex.wait_for_timeout(300)
        await Ex.click('.ext-form [type=submit]'); await Ex.wait_for_selector('.ext-link', timeout=20000)
        ok('success page confirms email', 'sara@visitor.test' in await Ex.evaluate("document.querySelector('.ext-main').textContent"))
        pr = sql("select id, data->>'extKind', data->>'strategicGoal', jsonb_array_length(data->'attachments') from shk_records where col='proposals' and data->>'partnerName'='شركة من تويتر'")[0]
        ok('proposal stored as public, no strategy field, file attached (per-visitor quota)', pr[1] == 'public' and pr[2] is None and pr[3] == 1, pr)
        ok('confirmation email to the visitor with tracking link', await wait_mail(2) and any('sara@visitor.test' in m['to'] and 'وصل مقترحكم' in m['subject'] and 'https://example.test/?track=' in m['html'] for m in mails()), [m['subject'] for m in mails()])
        ok('sender name/address from settings', any('partnerships@murooj.test' in (m['from'] or '') for m in mails()))
        # الرابط العام يقبل أكثر من مقترح
        await Ex.goto(URL + '?propose=' + tok(plink)); await Ex.wait_for_selector('.ext-form')
        ok('public link still open after a submission', await Ex.evaluate("!!document.querySelector('.ext-form')"))
        # حقل الفخ يُرفض
        hp = sql("select shk_ext_submit(%s, '{\"partnerName\":\"x\",\"requesterName\":\"y\",\"targets\":\"z\",\"requesterEmail\":\"a@b.co\",\"website\":\"spam\"}'::jsonb)", tok(plink))[0][0]
        ok('bot honeypot rejected', hp.get('error') == 'missing')
        # — زائر الرابط الخاص —
        await Ex.goto(URL + '?propose=' + tok(vlink)); await Ex.wait_for_selector('.ext-form')
        has_goal = await Ex.evaluate("!!document.querySelector('[data-k=strategicGoal]')")
        ngoals = await Ex.evaluate("document.querySelectorAll('[data-k=strategicGoal] option').length-1")
        ok('private form: strategic goal + initiative dropdowns', has_goal and ngoals >= 1 and await Ex.evaluate("document.querySelector('[data-k=initiative]').disabled"), ngoals)
        await Ex.select_option('[data-k=strategicGoal]', index=1); await Ex.wait_for_timeout(200)
        ninit = await Ex.evaluate("document.querySelectorAll('[data-k=initiative] option').length-1")
        ok('initiatives follow the chosen goal', ninit >= 1 and not await Ex.evaluate("document.querySelector('[data-k=initiative]').disabled"), ninit)
        await Ex.select_option('[data-k=initiative]', index=1)
        await Ex.fill('[data-k=requesterName]', 'خالد'); await Ex.fill('[data-k=requesterEmail]', 'khalid@uni.test'); await Ex.fill('[data-k=targets]', 'أبحاث مشتركة')
        await Ex.click('.ext-form [type=submit]'); await Ex.wait_for_selector('.ext-link', timeout=20000)
        pv = sql("select id, data->>'extKind', data->>'strategicGoal', data->>'initiative' from shk_records where col='proposals' and data->>'requesterName'='خالد'")[0]
        ok('private proposal keeps goal and initiative', pv[1] == 'private' and pv[2] and pv[3], pv[1:])
        ok('private submitter also gets confirmation email', await wait_mail(3) and any('khalid@uni.test' in m['to'] for m in mails()))
        # — تحديث الحالة من المنصة —
        n0 = len(mails())
        await A.evaluate(f"extMailUpdate({{external:true,id:'{pr[0]}'}}, 'info', 'نرجو إرسال خطة التنفيذ المقترحة.')")
        ok('status update emailed with the team message and a working tracking link', await wait_mail(n0 + 1) and any('sara@visitor.test' in m['to'] and 'مطلوب معلومات إضافية' in m['subject'] and 'خطة التنفيذ' in m['html'] for m in mails()))
        upd = [m for m in mails() if 'مطلوب معلومات' in m['subject']][-1]
        trk = upd['html'].split('?track=')[1].split('"')[0]
        st = sql("select shk_ext_status(%s)", trk)[0][0]
        ok('tracking link inside the email opens the proposal', st.get('ref') and not st.get('error'))
        ok('internal notes do not email (vis internal guarded in setPropStatus)', 'vis !== \'internal\'' in await A.evaluate("setPropStatus.toString()"))
        # إيقاف البريد يوقف الرسائل
        sql("update shk_mail_config set enabled=false")
        q0 = sql("select count(*) from shk_mail_queue")[0][0]
        sql("select shk_mail_enqueue_ext(%s,'update','review','')", pr[0])
        ok('disabled mail queues nothing', sql("select count(*) from shk_mail_queue")[0][0] == q0)
        ok('no page errors', not errs, errs[:3])
        await b.close()
    print(f'SUMMARY {sum(R)} / {len(R)}')
asyncio.run(main())
