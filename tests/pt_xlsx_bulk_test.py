import asyncio, json, os, shutil, tempfile
from playwright.async_api import async_playwright
from PIL import Image
import openpyxl
URL = 'file:///home/claude/shots/app.html'
R = []
def ok(n, c, x=''): R.append(c); print('PASS' if c else 'FAIL', n, x, flush=True)
async def main():
    tmp = tempfile.mkdtemp()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_selector('#main .page'); await pg.wait_for_timeout(700)
        E = pg.evaluate
        async def go(h): await E(f"location.hash={json.dumps(h)}"); await pg.wait_for_timeout(900)
        pid = await E("D.partnerships.find(p=>!p.demo&&!p.isDraft&&p.startDate).id")
        await go('#/partnerships/' + pid)
        ok('Excel button in partnership toolbar', await E("!!document.querySelector('[data-ptxl]')"))
        await pg.click('[data-ptxl]'); await pg.wait_for_timeout(300)
        ok('dialog offers download and upload', await E("!!document.querySelector('[data-pxdl]') && !!document.querySelector('[data-pxup]')"))
        async with pg.expect_download() as dl: await pg.click('[data-pxdl]')
        d = await dl.value; f = os.path.join(tmp, 'pt.xlsx'); await d.save_as(f)
        wb = openpyxl.load_workbook(f)
        ws = wb.worksheets[0]
        ok('first sheet is «بيانات الشراكة», lists sheet hidden', ws.title == 'بيانات الشراكة' and wb['القوائم'].sheet_state == 'hidden', wb.sheetnames)
        ok('marker and partnership id in hidden column A', ws['A1'].value == 'shk-pt-v1' and ws['A2'].value == pid and ws.column_dimensions['A'].hidden)
        keys = {ws.cell(r, 1).value: r for r in range(6, ws.max_row + 1) if ws.cell(r, 1).value}
        ok('core fields exported', all(k in keys for k in ['title', 'classification', 'startDate', 'endDate', 'cooperationAreas', 'outputs', 'owners', 'contactPhone', 'stage']), list(keys)[:8])
        ok('dropdowns present (data validation)', len(ws.data_validations.dataValidation) >= 4, len(ws.data_validations.dataValidation))
        cur = await E(f"(()=>{{const p=D.partnerships.find(x=>x.id==='{pid}');return {{cls:p.classification,title:p.title,code:p.code}}}})()")
        ok('values match the record', ws.cell(keys['title'], 3).value == cur['title'] and ws.cell(keys['code'], 3).value == cur['code'])
        # تعديل الملف كما يفعل شخص آخر
        newcls = 'مذكرة تعاون' if cur['cls'] != 'مذكرة تعاون' else 'مذكرة تفاهم'
        ws.cell(keys['classification'], 3).value = newcls
        ws.cell(keys['outputs'], 3).value = 'زراعة 500 شجرة\nحملة توعوية'
        import datetime; ws.cell(keys['endDate'], 3).value = datetime.datetime(2029, 12, 31)
        ws.cell(keys['contactPhone'], 3).value = '501234567'
        ws.cell(keys['code'], 3).value = 'XXX'  # للاطلاع — يجب ألا يُحدَّث
        f2 = os.path.join(tmp, 'pt2.xlsx'); wb.save(f2)
        await pg.click('[data-ptxl]'); await pg.wait_for_timeout(300)
        await pg.set_input_files('[data-pxup]', f2); await pg.wait_for_timeout(900)
        rows = await E("[...document.querySelectorAll('.px-tbl tbody tr th')].map(t=>t.textContent)")
        ok('review lists exactly the 4 changed fields (read-only ignored)', len(rows) == 4 and 'رمز الشراكة' not in rows, rows)
        await pg.click('.px-dlg [data-ok]'); await pg.wait_for_timeout(900)
        got = await E(f"(()=>{{const p=D.partnerships.find(x=>x.id==='{pid}');return [p.classification,p.outputs,p.endDate,p.contactPhone,p.code]}})()")
        ok('record updated from Excel', got[0] == newcls and got[1] == 'زراعة 500 شجرة\nحملة توعوية' and got[2] == '2029-12-31' and got[3] == '0501234567' and got[4] == cur['code'], got)
        ok('change logged', 'تحديث من نموذج Excel' in await E(f"JSON.stringify(D.audit.filter(a=>a.entityId==='{pid}').slice(-3))"))
        # ملف ليس نموذجًا
        bad = os.path.join(tmp, 'bad.xlsx'); w = openpyxl.Workbook(); w.active['A1'] = 'x'; w.save(bad)
        await pg.click('[data-ptxl]'); await pg.wait_for_timeout(300)
        await pg.set_input_files('[data-pxup]', bad); await pg.wait_for_timeout(700)
        ok('foreign file rejected', 'ليس نموذج بيانات شراكة' in await E("document.querySelector('.toasts').textContent"))
        # — الرفع الجماعي —
        info = await E("(()=>{const L=D.partnerships.filter(p=>!p.demo&&!p.isDraft);const u=L.filter(p=>L.filter(q=>q.partnerId===p.partnerId).length===1);return {a:u[0].id,an:partnerName(u[0]),b:u[1].id,bc:u[1].code,na:(u[0].attachments||[]).length,nb:(u[1].attachments||[]).length}})()")
        root = os.path.join(tmp, 'صور الشراكات')
        for folder, n in [(info['an'], 2), (info['bc'], 1), ('مجلد لا يطابق', 1)]:
            os.makedirs(os.path.join(root, folder), exist_ok=True)
            for i in range(n): Image.new('RGB', (40, 30), (30 * i, 120, 90)).save(os.path.join(root, folder, f'img{i}.jpg'))
        open(os.path.join(root, 'readme.txt'), 'w').write('x')
        await go('#/partnerships')
        ok('bulk photos button in register', await E("!!document.querySelector('[data-bulkph]')"))
        await pg.click('[data-bulkph]'); await pg.wait_for_timeout(300)
        await pg.set_input_files('[data-bpin]', root); await pg.wait_for_timeout(800)
        summ = await E("document.querySelector('.bp-sum').textContent")
        ok('3 folders, 2 matched, 3 images queued', await E("document.querySelectorAll('.bp-row').length") == 3 and await E("document.querySelectorAll('.bp-row:not(.off)').length") == 2 and '3' in summ, summ)
        await pg.click('[data-bpgo]'); await pg.wait_for_timeout(2500)
        na = await E(f"D.partnerships.find(x=>x.id==='{info['a']}').attachments.filter(a=>a.category==='صور الشراكة').length")
        nb = await E(f"D.partnerships.find(x=>x.id==='{info['b']}').attachments.filter(a=>a.category==='صور الشراكة').length")
        ok('photos landed in their partnerships', na >= 2 and nb >= 1, (na, nb))
        await pg.screenshot(path='/tmp/claude-0/-home-user/f89444e8-a801-5e25-ad85-0de653cd9a60/scratchpad/bp.png')
        await pg.click('[data-bpgo]'); await pg.wait_for_timeout(500)
        # إعادة الرفع لا تكرر الصور
        await pg.click('[data-bulkph]'); await pg.wait_for_timeout(300)
        await pg.set_input_files('[data-bpin]', root); await pg.wait_for_timeout(800)
        await pg.click('[data-bpgo]'); await pg.wait_for_timeout(2000)
        na2 = await E(f"D.partnerships.find(x=>x.id==='{info['a']}').attachments.filter(a=>a.category==='صور الشراكة').length")
        ok('re-upload skips existing images', na2 == na, (na, na2))
        ok('no page errors', not errs, errs[:3])
        await b.close()
    shutil.rmtree(tmp)
    print(f'{sum(R)}/{len(R)}')
asyncio.run(main())
