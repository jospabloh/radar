// Layout scan: overlapping interactive elements, horizontal overflow, clipped
// button text and controls covered by fixed chrome (corner ThemeSwitcher,
// sticky bars), per role, on phone / tablet / desktop widths, in Chromium.
//
// Usage:  node scripts/responsive-scan.mjs [--only 390x844,834x1194] [--role company_admin] [--dist dir] [--shots dir] [--json out.json]
//   Serves the Vite build (npm run build first) and fulfils EVERY /api/ request locally with
//   fixtures (nothing reaches Base44). Exits 1 when it finds a problem.
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ALL = [
  ['390x844', 390, 844, true], ['320x568', 320, 568, true],
  ['768x1024', 768, 1024, true], ['834x1194', 834, 1194, true],
  ['1024x1366', 1024, 1366, true], ['1024x768', 1024, 768, true],
  ['1440x900', 1440, 900, false],
];
const only = argOf('--only')?.split(',');
const VPS = ALL.filter((v) => !only || only.includes(v[0]));
const ONLY_ROLE = argOf('--role');
const SHOTS = argOf('--shots');
const JSON_OUT = argOf('--json');

const C = 'co1';
const T = '2026-09-01T12:00:00.000000';
const today = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
const day = { works: true, start: '09:00', end: '18:00' };
const schedule = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((d) => [d, day]));
const USERS = {
  super_admin: { id: 'u0', email: 'owner@example.invalid', full_name: 'Dueño de Plataforma', app_role: 'super_admin', role: 'admin' },
  company_admin: { id: 'u1', email: 'admin@example.invalid', full_name: 'Admin Prueba Con Nombre Largo', app_role: 'company_admin', role: 'user', company_id: C, employee_id: 'e1' },
  store_manager: { id: 'u2', email: 'gerente@example.invalid', full_name: 'Gerente Prueba', app_role: 'store_manager', role: 'user', company_id: C, employee_id: 'e2' },
  employee: { id: 'u3', email: 'empleado@example.invalid', full_name: 'Empleado Prueba', app_role: 'employee', role: 'user', company_id: C, employee_id: 'e3' },
};
const ROUTES = {
  super_admin: ['/companies'],
  company_admin: ['/dashboard', '/employees', '/approvals', '/reports', '/analitica-productividad', '/panel-incidencias', '/calendario-asistencias', '/configuracion-horarios', '/configuracion-empresa', '/gestion-licencias', '/configuracion-notificaciones', '/manual-usuario', '/soporte', '/historial-cambios'],
  store_manager: ['/dashboard', '/approvals', '/panel-incidencias', '/calendario-asistencias', '/soporte'],
  employee: ['/portal', '/perfil-empleado', '/mis-solicitudes', '/calendario-asistencias', '/configuracion-notificaciones', '/manual-usuario', '/soporte', '/historial-cambios'],
};
const PUBLIC = ['/login', '/register', '/forgot-password', '/no-such-page'];

const emps = [['e1', 'Admin Prueba Con Nombre Largo', 'company_admin'], ['e2', 'Gerente Prueba', 'store_manager'], ['e3', 'Empleado Prueba', 'employee'], ['e4', 'María Fernanda de los Ángeles Hernández', 'employee'], ['e5', 'Luis', 'employee']]
  .map(([id, n, role]) => ({ id, company_id: C, user_id: `u${id.slice(1)}`, email: `${id}.persona.larga.de.correo@example.invalid`, full_name: n, role, schedule, created_date: T }));
function fixtures() {
  return {
    Company: [{ id: C, name: 'Empresa de Prueba con Nombre Bastante Largo S.A. de C.V.', status: 'active', tier: 'starter', max_employees: 25, license_expiry: '2027-01-01', timezone: 'America/Mexico_City', created_date: T }],
    Employee: emps,
    AttendanceRecord: emps.map((e, i) => ({ id: `a${i}`, company_id: C, employee_id: e.id, date: today, check_in_time: '09:0' + i, check_out_time: i % 2 ? '18:00' : null, status: i % 2 ? 'late' : 'on_time', hours_worked: 8.5, created_date: T })),
    ExtensionRequest: [{ id: 'x1', company_id: C, employee_id: 'e3', employee_name: 'Empleado Prueba', attendance_record_id: 'a2', status: 'pending', reason: 'Motivo de prueba largo '.repeat(4), date: today, created_date: T }],
    PTORequest: [{ id: 'p1', company_id: C, employee_id: 'e3', employee_name: 'Empleado Prueba', status: 'pending', start_date: today, end_date: today, reason: 'Permiso de prueba', created_date: T }],
    ScheduleChangeRequest: [{ id: 's1', company_id: C, employee_id: 'e4', employee_name: 'María Fernanda de los Ángeles Hernández', status: 'pending', created_date: T, new_schedule: schedule }],
    Holiday: [], ShiftTemplate: [{ id: 'st1', company_id: C, name: 'Matutino', schedule, created_date: T }],
    NotificationPreference: [], EmployeeDocument: [], PermissionProfile: [], AppSession: [],
    SupportTicket: [{ id: 't1', company_id: C, subject: 'Ticket de prueba con un asunto largo', description: 'Descripción', status: 'open', priority: 'normal', category: 'bug', created_date: T }],
  };
}
function matches(row, f) {
  if (!f) return true;
  return Object.entries(f).every(([k, v]) => {
    if (k === '$and') return v.every((x) => matches(row, x));
    if (k === '$or') return v.some((x) => matches(row, x));
    if (v && typeof v === 'object') return true;
    if (row[k] === undefined) return true;
    return String(row[k]) === String(v);
  });
}
async function mock(ctx, who) {
  const db = fixtures();
  const me = USERS[who];
  // No network beyond the local server (web fonts etc. would only stall the load).
  await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
  await ctx.route((u) => u.pathname.startsWith('/api/') || /socket\.io/.test(u.href), async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname;
    const json = (x, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(x) });
    if (/socket\.io/.test(url.href)) return route.abort();
    if (p.includes('public-settings')) return json({ id: 'mockapp', public_settings: {} });
    if (p.endsWith('/entities/User/me')) return who ? json(me) : json({ detail: 'no' }, 401);
    let m = p.match(/\/entities\/(\w+)(?:\/(\w+))?$/);
    if (m) {
      const rows = db[m[1]] || [];
      if (req.method() !== 'GET') return json({ id: 'mock_' + Date.now() });
      if (m[2]) return json(rows.find((r) => r.id === m[2]) || {});
      let q = {}; try { q = JSON.parse(url.searchParams.get('q') || '{}'); } catch { /* */ }
      return json(rows.filter((r) => matches(r, q)));
    }
    if (/\/functions\//.test(p)) return json({ ok: true });
    return json({});
  });
}

// ---- in-page detector ------------------------------------------------------
// `bottom` = the page (or dialog) is scrolled to its end, or does not scroll.
// Content that scrolls under fixed/sticky chrome is normal; a control that can
// NOT scroll away from under the corner switcher or a fixed bar is the bug, and
// that only shows once everything has been scrolled as far as it goes.
function detect(bottom) {
  const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=combobox],[role=switch],[role=checkbox],[role=menuitem],[tabindex]:not([tabindex="-1"])';
  const sw = document.querySelector('[data-theme-switcher]');
  const dialogs = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')];
  // The visible box: the element's rect cut by every scrolling/clipping ancestor.
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return null;
    let { left, top, right, bottom: bt } = el.getBoundingClientRect();
    if (right - left < 2 || bt - top < 2) return null;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p);
      if (o.overflowX !== 'visible' || o.overflowY !== 'visible') {
        const r = p.getBoundingClientRect();
        if (o.overflowX !== 'visible') { left = Math.max(left, r.left); right = Math.min(right, r.right); }
        if (o.overflowY !== 'visible') { top = Math.max(top, r.top); bt = Math.min(bt, r.bottom); }
      }
    }
    if (right - left < 2 || bt - top < 2) return null;
    return { left, top, right, bottom: bt, width: right - left, height: bt - top };
  };
  const pin = (el) => { let sticky = false; for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed') return 'fixed'; if (p === 'sticky') sticky = true; } return sticky ? 'sticky' : null; };
  const label = (el) => `${el.tagName.toLowerCase()}${el.hasAttribute('data-theme-switcher') ? '[theme-switcher]' : ''} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  let els = [...document.querySelectorAll(SEL)].filter((e) => !(sw && sw.contains(e)));
  if (sw) els.push(sw);                                  // the switcher counts as ONE box
  if (dialogs.length) els = els.filter((e) => e === sw || dialogs.some((d) => d.contains(e)));
  const items = els.map((el) => ({ el, r: vis(el), pin: pin(el) })).filter((x) => x.r);
  const out = { overlaps: [], clipped: [], covered: [], overflowX: null };
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) {
    const wide = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1 && vis(e)).slice(0, 3).map(label);
    out.overflowX = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, culprits: wide };
  }
  // Two in-flow (or two equally pinned) elements always count. Fixed chrome
  // against flow content counts at the scroll end only; sticky chrome never
  // covers content that starts below it.
  const counts = (a, b) => (a.pin === b.pin) || ((a.pin || b.pin) === 'fixed' && bottom);
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (!counts(a, b)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 2 && h > 2) out.overlaps.push(`${label(a.el)} x ${label(b.el)} (${Math.round(w)}x${Math.round(h)})`);
  }
  for (const { el, r, pin: pn } of items) {
    const cs = getComputedStyle(el);
    if ((el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') && el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible')
      out.clipped.push(`${label(el)} scrollW ${el.scrollWidth} > ${el.clientWidth}`);
    if (r.right > innerWidth + 1 || r.left < -1) out.clipped.push(`${label(el)} extends past the viewport (${Math.round(r.left)}..${Math.round(r.right)})`);
    if (!bottom || pn || el === sw) continue;
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), cy = r.top + r.height / 2;
    if (cy < 0 || cy > innerHeight) continue;
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el) && pin(top) === 'fixed') out.covered.push(`${label(el)} covered by ${label(top.closest('[data-theme-switcher]') || top)}`);
  }
  return out;
}

const server = await preview({ build: { outDir: argOf('--dist') || 'dist' }, preview: { port: 5199, strictPort: false }, logLevel: 'error' });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ args: ['--disable-gpu', '--no-proxy-server'], ...(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}) });
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const findings = [];
const seen = new Set();
const add = (key, kind, msg) => { const k = key + kind + msg; if (seen.has(k)) return; seen.add(k); findings.push({ where: key, kind, msg }); };

async function scanPage(page, key) {
  const total = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, ...[...document.querySelectorAll('main')].map((m) => m.scrollHeight)));
  const vh = page.viewportSize().height;
  const offsets = [0]; for (let y = vh * 0.6; y < total - vh && offsets.length < 5; y += vh * 0.6) offsets.push(y);
  if (total > vh) offsets.push(total);
  const dlg = '[role=dialog],[role=alertdialog]';
  for (const y of offsets) {
    const last = y === offsets[offsets.length - 1];
    await page.evaluate(([y, dlg, last]) => {
      window.scrollTo({ top: y, behavior: 'instant' });
      document.querySelectorAll('main').forEach((m) => { m.scrollTop = y; });
      document.querySelectorAll(dlg).forEach((d) => { d.scrollTop = last ? d.scrollHeight : 0; });
      document.querySelectorAll('[role=dialog] nav').forEach((n) => { n.scrollTop = last ? n.scrollHeight : 0; });
    }, [y, dlg, last]);
    await page.waitForTimeout(60);
    const r = await page.evaluate(detect, last);
    r.overlaps.forEach((m) => add(key, 'OVERLAP', m));
    r.clipped.forEach((m) => add(key, 'CLIPPED', m));
    r.covered.forEach((m) => add(key, 'COVERED', m));
    if (r.overflowX) add(key, 'OVERFLOW-X', JSON.stringify(r.overflowX));
  }
  await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelectorAll('main').forEach((m) => { m.scrollTop = 0; }); });
}

async function visit(who, route, [vn, w, h, touch]) {
  console.error(`... ${who || 'anon'} ${route} @${vn}`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 700, deviceScaleFactor: 1, locale: 'es-MX' });
  await ctx.addInitScript((t) => { try { if (t) localStorage.setItem('base44_access_token', t); localStorage.setItem('theme', 'light'); } catch { /* */ } }, who ? 'tok' : null);
  await mock(ctx, who);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => add(`${who || 'anon'} ${route} @${vn}`, 'PAGEERROR', String(e).slice(0, 120)));
  try {
    await page.goto(base + route, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const key = `${who || 'anon'} ${route} @${vn}`;
    await scanPage(page, key);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${(who || 'anon')}${route.replace(/\//g, '_')}@${vn}.png` });
    // Shell chrome: open the mobile drawer; open dialogs by clicking action buttons.
    const menu = page.getByRole('button', { name: 'Abrir menú' });
    if (await menu.count() && await menu.first().isVisible()) {
      await menu.first().click(); await page.waitForTimeout(350);
      await scanPage(page, key + ' [drawer]');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${(who || 'anon')}${route.replace(/\//g, '_')}@${vn}-drawer.png` });
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    }
    const names = await page.$$eval('main button, form button, body > div > div button', (bs) => bs.filter((b) => b.getBoundingClientRect().width > 0 && !b.closest('[data-theme-switcher]')).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim()).filter((t) => /nuev|solicit|agreg|crear|editar|horario|ticket|invit|licen|eliminar|exportar/i.test(t)).slice(0, 4));
    for (const name of [...new Set(names)]) {
      const btn = page.locator('main button, form button, body > div > div button').filter({ hasText: name }).first();
      if (!(await btn.count())) continue;
      try { await btn.click({ timeout: 1500 }); } catch { continue; }
      await page.waitForTimeout(450);
      if (await page.locator('[role=dialog],[role=alertdialog]').count()) {
        await scanPage(page, `${key} [dialog "${name}"]`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${(who || 'anon')}${route.replace(/\//g, '_')}@${vn}-dlg-${name.replace(/\W+/g, '').slice(0, 14)}.png` });
        await page.keyboard.press('Escape'); await page.waitForTimeout(250);
      }
      if (new URL(page.url()).pathname !== route) { await page.goto(base + route, { waitUntil: 'load' }); await page.waitForTimeout(500); }
    }
  } catch (e) { add(`${who || 'anon'} ${route} @${vn}`, 'SCRIPT', String(e).slice(0, 120)); }
  await ctx.close();
}

for (const vp of VPS) {
  for (const route of PUBLIC) if (!ONLY_ROLE) await visit(null, route, vp);
  for (const [who, routes] of Object.entries(ROUTES)) {
    if (ONLY_ROLE && ONLY_ROLE !== who) continue;
    for (const route of routes) await visit(who, route, vp);
  }
}
await browser.close(); await new Promise((r) => server.httpServer.close(r));
if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(findings, null, 1));
for (const f of findings) console.log(`${f.kind.padEnd(10)} ${f.where}\n           ${f.msg}`);
console.log(`\n${findings.length} finding(s)`);
process.exit(findings.length ? 1 : 0);
