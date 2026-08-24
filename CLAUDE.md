# RADAR — Project Notes

Attendance/HR SaaS (Base44 backend + Vite/React front-end), multi-tenant via
`company_id` on every operational entity. Roles: `super_admin` (platform),
`company_admin`, `store_manager`, `employee` (`user.app_role`).

## Billing write-gate on Safe functions (module 3, fixed 2026-08-18)

A portfolio-standard audit (`jospabloh/acacia-app-standard`, module 3) found
`updateAttendanceRecord`, `resolveApprovalRequest`, `createManagedRecord`, and
`createEmployee` re-checked `app_role` and tenant scoping but never
`Company.status` — a suspended or view_only tenant's manager could still
approve requests, edit attendance, create shift templates, and invite
employees. Fixed: all four now check `Company.status` before writing
(`_billingGuard.ts`, colocated per function directory — Deno can't import
across function dirs — checked right after the existing tenant-scoping
check, `super_admin` bypasses same as every other check in this app).
`createEmployee`'s check runs before `base44.users.inviteUser` fires, so a
blocked company doesn't send a real invite email before rejecting the write.
`updateSupportTicket` deliberately left ungated so a suspended company keeps
its one path to fix the underlying billing problem.

**Not verified:** `deno` isn't available in this sandbox, and this repo's CI
has no `deno lint`/`deno test` step for `base44/functions/*.ts` at all
(confirmed via `.github/workflows/ci.yml`) — reviewed all four edited
`entry.ts` files by hand for syntax/logic; live behavior needs a manual
check against the deployed backend before treating this as fully verified.

## Account & danger zone (module 7, added 2026-08-18)

A portfolio-standard audit (`jospabloh/acacia-app-standard`, module 7) found
`CompanySettings.jsx` only ever exposed 3 editable fields (name, timezone,
`whatsapp_enabled`) — no data export, no danger zone. New:

- **`exportCompanyData`** (`company_admin`/`store_manager`/`super_admin`) —
  service role, but every read explicitly filtered by the caller's own
  `company_id`. Returns `Employee`, `EmployeeDocument`, `AttendanceRecord`,
  `ExtensionRequest`, `PTORequest`, `ScheduleChangeRequest`, `ShiftTemplate`,
  `Holiday` as one JSON payload; `CompanySettings.jsx` turns it into a
  client-side download.
- **"Solicitar eliminación de la empresa"** — **not** a direct delete.
  `Company.delete`'s RLS requires `role: admin` (the platform owner) —
  a tenant's own `company_admin` cannot delete their own company via RLS at
  all, by design. So this creates a `SupportTicket` (`category: 'account'`,
  `priority: 'high'`) and notifies Mission Control via the existing
  `notifyTicketCreated` function (same call `SupportCenter.jsx` already
  makes on ticket creation), same principle as every other irreversible,
  tenant-wide deletion in this portfolio going through a human rather than
  instant self-service (see `jospabloh/liuma`'s own module-7 finding for the
  cautionary counter-example of *not* doing this).

**Verified:** `npm run lint`, `npm run build` pass. No `deno`/RLS-validator
script in this repo to run locally (see the 2026-08-17 fix's PR for the same
caveat) — unverified against a live deploy.

## No "trial" state on `Company.status` — investigated, correctly modeled as-is (2026-08-18)

A portfolio-standard audit flagged module 1 (licencias) for not modeling a
"trial" phase on `Company.status` (`["active", "suspended", "view_only"]`),
the way `jospabloh/acacia-mission-control`'s unified lifecycle models it for
other apps (a `trial` **plan** value plus a `trialField` date, per
`api/_lib/licenseControl.js`). Investigated rather than added by default,
because a trial phase needs a real trigger — something that starts the
clock — and RADAR genuinely doesn't have one:

- **There is no self-serve "create a company" signup.** `Register.jsx`
  creates a Base44 **user** account only (`base44.auth.register`); it never
  creates a `Company`. `completeOnboarding/entry.ts` — the server-side
  function that actually assigns a new user's `app_role`/`company_id` — has
  exactly two paths: (1) an admin already created an `Employee` row for that
  email beforehand (an invitation, inheriting whatever role/company that
  admin assigned), or (2) zero `Company` rows exist **anywhere in the whole
  app** yet, making this the one-time founder bootstrap. Once the first
  company ever exists, path 2 is permanently dead — every subsequent company
  is created exclusively through `SuperAdminCompanies.jsx`, a `super_admin`-
  only manual form that sets `tier`/`max_employees` directly and leaves
  `status` at its `active` default. No code path anywhere sets a trial
  length or a trial-end date, because nothing needs to.
- **This isn't an oversight — it matches how the product is actually sold.**
  Unlike flowfin/rumbo/liuma/puntos/stockflow, which all have a public
  self-serve signup that starts a trial clock the moment someone creates a
  tenant, RADAR's tenants are provisioned by ACACIA directly — sales-led,
  not self-serve. **Correction (2026-08-19):** this section originally cited
  "no `apps/radar.html` marketing page in `acaciaco-site`" as supporting
  evidence for that claim — module 9's own gap at the time this was written.
  `apps/radar.html` was added the same day (see module 9 elsewhere in this
  file's git history / the portfolio audit), so that specific citation is
  now stale; a marketing page existing doesn't create a self-serve signup
  flow on its own, so the underlying conclusion (no trial trigger, `active`-
  by-default is correct) still holds — just not for that specific reason
  anymore. A "trial" status with no trigger anywhere to enter it would be
  exactly the same shape of problem as `jospabloh/liuma`'s unwired
  danger-zone table — schema and UI built for a flow that doesn't exist,
  which reads as done without doing anything.

**Conclusion: `Company.status`'s three-value enum is correct for RADAR's
actual onboarding model.** If self-serve signup is ever built for RADAR,
that is the point to add `trial` (mirroring rumbo's `plans: ['trial', ...]`
+ `billing.trialField` pattern in `licenseControl.js`) — building it now,
ahead of any real entry point, would be speculative.

## Billing-status banner (module 10, added 2026-08-18)

`Company.status` was never read anywhere in the client before this — not
just missing from the login screen (structurally correct, same reasoning
as `jospabloh/flowfin`'s equivalent finding: a pre-auth screen can't know
which tenant it is), but missing **everywhere**, including every
authenticated page. The module-3 billing write-gate
(`base44/functions/*/_billingGuard.ts`) already rejects writes server-side
for a `suspended`/`view_only` company, but a blocked user saw only a
generic error toast with no explanation of why.

New **`CompanyStatusBanner`** (`src/components/layout/`), wired into
`AppLayout.jsx` — the shared authenticated shell every admin/manager page
already renders through — right above `<Outlet />`, so it's visible
regardless of which page the block happens on. `AppLayout` already fetched
`Company` (for the sidebar's company name); this just also captures
`.status` and passes it down. Not shown to `super_admin` (platform role,
no `company_id`, never subject to this gate) or while status is still
loading. Links to `/gestion-licencias` (the existing `LicenseManagement`
page) rather than duplicating license detail in the banner itself.

**Gap found and fixed 2026-08-19 (independent re-verification audit):**
`AppLayout.jsx` has an earlier early-return branch, for the plain
`employee` role (which has no `NAV_BY_ROLE` entry — see the module-9-
adjacent comment in that file), that rendered a bare `<Outlet />` with
**no banner**. Employees are subject to the exact same `_billingGuard.ts`
write-gate as admin/manager roles (e.g. clocking in via
`updateAttendanceRecord`), so a blocked employee saw the same
unexplained generic error toast this banner exists to fix — just on the
one role path that mattered most (employees clock in far more often than
admins approve requests). Fixed by rendering `CompanyStatusBanner` in that
branch too, using the `companyStatus` state `AppLayout` already fetches
regardless of role.

**Verified:** `npm run lint`, `npm run build` pass. Not visually verified
against a live suspended/view_only company — not achievable in this
environment; risk is bounded since this only adds a new read-only display,
touching no write path.

## In-app version & changelog refresh (module 6, added 2026-08-18)

`src/pages/ChangeLog.jsx` existed but was a hardcoded array last updated
2026-07-28 — three weeks of real, verified fixes (the 2026-08-10 dependency
patch, this session's billing-gate/export/danger-zone work) were never
reflected in-app, even though `CHANGELOG.md` at the repo root was kept
current the whole time. New `src/lib/appConfig.js` (`APP_VERSION`/
`RELEASE_DATE`, mirroring the same file's role in stockflow/cateqhub/
puntos) now feeds a version stamp at the bottom of the changelog page, and
`CHANGES` got a new entry summarizing this session's actual changes.
`package.json`'s `version` bumped to `0.1.3` alongside a matching
`CHANGELOG.md` entry — kept in sync by hand, same as the rest of this
portfolio outside stockflow's automated release workflow; not attempting
to build a dedicated release script here since nothing in this repo's
`package.json`/CI suggests one was ever planned (same reasoning
`jospabloh/puntos`'s CLAUDE.md gives for not guessing at a release
pipeline that doesn't exist yet).

**Verified:** `npm run lint`, `npm run build` pass.

## Modules 2 and 3 — a real role declaration and a real permission system (2026-08-21)

A portfolio-standard re-audit found these were the two modules RADAR did not
have. Everything else was in place; these were genuinely absent, not
partially built.

### Module 2 — roles declared in one file

The four roles existed only as string literals scattered across
`AppLayout.jsx`, `CompanySettings.jsx`, `Approvals.jsx`, `Employees.jsx`,
`EmployeeProfile.jsx`, `AttendanceCalendar.jsx` and five backend functions —
with **three independent copies of the manager set** and **three of the label
map, already drifted**: `Employees.jsx` labelled `store_manager` "Store
Manager", `EmployeeProfile.jsx` "Gerente de tienda", and neither knew
`super_admin` existed.

New **`src/lib/rbac.js`** is now the only place a role is declared: `ROLES`,
`ROLE_LABELS`, `MANAGER_ROLES`, `TENANT_ROLES` and the `isSuperAdmin` /
`isCompanyAdmin` / `isManager` / `isEmployee` / `hasTenant` helpers. Every
client copy was replaced with an import. The file also states the Layer 1 /
Layer 2 separation explicitly, so nobody conflates these with Mission
Control's operator roles.

### Module 3 — granular permissions, enforced on both sides

Before this, RADAR had **no permission concept at all** beyond the role:
`MANAGER_ROLES.has(app_role)` was the entire answer, client and server. There
was no way for a `company_admin` to say "my store_managers may approve PTO but
may not export the company's data", and no key for anything to check.

- **`src/lib/permissionRegistry.js`** — 13 keys across Asistencias,
  Aprobaciones, Empleados, Horarios, Empresa and Soporte, each with a default
  per role, plus `resolvePermission()` documenting the precedence.
  `Soporte:*` is open to every role including `employee` on purpose: a person
  locked out of everything else still has to be able to say so, which is the
  same reason `updateSupportTicket` stays outside the billing gate.
- **`PermissionProfile` entity** — one sparse row per `(company_id,
  role_key)`, holding only the keys a company_admin explicitly overrode. Sparse
  matters: changing a registry default still reaches every tenant that never
  overrode it. RLS scopes writes to the caller's own company.
- **`src/lib/PermissionContext.jsx`** — `usePermissions().can(key)`, mounted in
  `App.jsx`. Fails **closed to the registry defaults**, not open: a failed
  `PermissionProfile` read yields the same answer the server computes when no
  override row exists.
- **Server-side re-check in all five write/export functions** —
  `resolveApprovalRequest` (`Aprobaciones:resolve`), `updateAttendanceRecord`
  (`Asistencias:edit`), `createManagedRecord` (`Horarios:manage` /
  `Empleados:propose_schedule`, via `ENTITY_PERMISSION` so a new managed entity
  cannot be added without choosing a key), `createEmployee`
  (`Empleados:create`, checked **before** `inviteUser` fires so a denied caller
  doesn't cause a real invitation email) and `exportCompanyData`
  (`Empresa:export_data`). Each is checked against the **record's own**
  `company_id`, never one from the request body.
- **`exportCompanyData` gets the permission check but deliberately no billing
  gate** — it is read-only, and a suspended tenant getting its data out is
  exactly the case the export exists for. Gating it would make the danger zone
  a trap.

### The copies, and why they can't drift

`_permissions.ts` follows the same "one colocated copy per function directory"
shape `_billingGuard.ts` already had (Deno can't import across function dirs),
but unlike `_billingGuard.ts` — whose header says "keep all copies identical;
regenerate by hand" — these are **generated and checked**:

- `base44/functions/_shared/_permissions.ts` is the canonical source;
- `npm run generate:function-permissions` fans it out to the five functions;
- `npm run validate:permissions` (wired into `npm run lint`) fails if the
  canonical file drifts from `permissionRegistry.js` **or** if any colocated
  copy differs from the canonical file byte-for-byte.

Confirmed both halves are real, not no-ops, by flipping one default and
watching each check fail before restoring it.

**Deploy note: this pass adds an entity.** `PermissionProfile.jsonc` must be
pushed (`npx base44 entities push`) — a repo `.jsonc` alone changes nothing at
runtime, and until it exists in the deployed schema every override read returns
nothing, which degrades to the registry defaults rather than breaking (the
fail-closed-to-defaults design above), so the ordering is safe either way.

**Verified:** `npm run lint` (eslint + `validate:rls` 15 entities, 13
tenant-scoped + `validate:permissions` 13 keys, 5 synced copies) and
`npm run build` both pass. `deno` still isn't available in this sandbox and
this repo's CI has no `deno lint`/`deno test` step — the five edited `entry.ts`
files were reviewed by hand, same caveat as the 2026-08-18 billing-gate pass.
**Not verified:** a browser session as a `store_manager` with an explicit
override. Risk is bounded: with no `PermissionProfile` row (i.e. every tenant
today) the new checks resolve to exactly the role defaults the previous
`MANAGER_ROLES` gate already enforced, with one deliberate tightening —
`Empleados:create` and `Horarios:manage` are now `company_admin`-only, where a
`store_manager` previously passed the coarse manager check.

## ACACIA Portfolio Standard

This app is part of the ACACIA portfolio and must stay compliant with
`jospabloh/acacia-app-standard`. Read `STANDARD.md` there before implementing
any item below for the first time, and re-read the relevant section before
touching a module that's already implemented.

- [x] Module 1 — License lifecycle: `Company.status`
      (active|view_only|suspended), written ONLY by Mission Control. No native
      lifecycle cron. The absence of a `trial` state is deliberate and
      documented above — RADAR is sales-led, with no self-serve signup to
      start a trial clock.
- [x] Module 2 — Roles declared once in `src/lib/rbac.js` (2026-08-21),
      mapped onto the `app_role` field. Mission Control's operator roles are a
      separate layer, never conflated.
- [x] Module 3 — Granular permissions: `src/lib/permissionRegistry.js` +
      `PermissionProfile` overrides + server-side re-check in all five
      write/export functions, behind `_billingGuard.ts`. Generated server
      copies, drift-checked in `npm run lint` (2026-08-21).
- [x] Module 4 — RLS: tenant branch + service-role admin branch on every
      `company_id` entity, `validate-entity-rls.mjs` blocking in lint.
- [x] Module 5 — Health: Mission Control polls `acaciaControl`'s `ping`.
- [x] Module 6 — `src/lib/appConfig.js` + `ChangeLog.jsx`.
- [x] Module 7 — `CompanySettings.jsx`: data export + deletion request routed
      through support (a tenant admin cannot delete their own company by RLS,
      by design).
- [x] Module 8 — `SupportCenter.jsx` writes `SupportTicket` here first, pushed
      by `notifyTicketCreated` and pulled by `acaciaControl`.
- [x] Module 9 — `apps/radar.html` on `jospabloh/acaciaco-site`.
- [x] Module 10 — Login on-brand with real error states;
      `CompanyStatusBanner` explains suspended/view_only post-login on every
      role path including the plain `employee` branch.

Last audited against the standard: 2026-08-21 — modules 2 and 3 were the only
open items; both closed in this pass.

## Deploy: el id de la app vive en el repo (módulo 11, 2026-08-21)

El 2026-08-21, un `git pull` fallido dejó la terminal parada en `flowfin` y los
seis comandos siguientes desplegaron **el backend de FlowFin** en puntos, radar,
stockflow y ctrlhq: la CLI toma el origen del **directorio actual** y el destino
de `--app-id`, y nada comprueba que coincidan. En radar el `entities push` llegó
a completarse y borró el modelo de datos entero. Detalle en
`jospabloh/acacia-app-standard` → `docs/incidents.md`.

Por eso este repo ya no se deploya a mano:

```bash
npm run deploy            # funciones — lee el appId de base44.app.json
npm run deploy:site       # frontend — mergear a main NO lo hace por ti
npm run deploy:entities   # schema — DESTRUCTIVO, pide escribir "RADAR"
npm run functions:audit   # quién llama a cada endpoint
```

**Mergear a `main` no deploya el sitio.** Se creyó lo contrario durante meses.
En flowfin se comprobó al revés: un fix se mergeó a `main` y, horas después, el
árbol que el app realmente servía seguía siendo el de antes del fix — mergear no
propaga nada (detalle en el CLAUDE.md de flowfin). El
frontend se deploya a mano con `npm run deploy:site`, igual que las funciones.
Y comprueba el resultado por **contenido**, no por hashes: el checkpoint del app
puede reportar un `git_commit_hash` igual al HEAD de `main` mientras el árbol que
de verdad se sirve está atrasado.

`scripts/base44-deploy.mjs` **rechaza** un `--app-id` por argumento, así que el
directorio y la app destino no pueden desalinearse. `deploy:entities` imprime la
lista de entidades y el nombre de la app antes de pedir confirmación — ver
"36 entidades de FlowFin" mientras crees estar desplegando otra app es la señal
de alto que faltaba.

`npm run validate:functions` (dentro de `npm run lint`) falla si los endpoints
pasan de `maxFunctions` en `base44.app.json` — hoy **40**, con
Base44 cortando en 50. El margen importa: por encima del tope el deploy falla a
media aplicación y la CLI **no** llega a su fase de poda, así que las funciones
viejas siguen ocupando los slots que harían falta para arreglarlo.

**Antes de consolidar o borrar cualquier función, corre `npm run functions:audit`.**
Una función sin llamadores en el repo casi nunca está muerta: el llamador vive
fuera, donde grep no ve — un entity hook de Base44, un cron del panel, un
`tool_config` de un agente, la URL de un webhook. El audit marca esas como
`REVISAR EN PANEL` en vez de adivinar; confírmalas contra
`npx base44 functions list` (anota `(N automation)`) antes de tocarlas.

## Selector de tema: claro / oscuro / dispositivo (módulo 12, 2026-08-21)

El tema se elige desde **un solo control**: un círculo pequeño anclado a una
esquina de la pantalla que muestra el modo vigente y, al pulsarlo, crece de lado
en una pista de tres ranuras (Claro · Oscuro · Sistema) con un indicador que se
desliza a la elegida. Tres estados, tres posiciones físicas — que es justo lo
que un botón sol/luna de dos estados no puede expresar en cuanto "seguir al
dispositivo" entra en la lista.

Lo que se guarda es la **preferencia** (`light` | `dark` | `system`), nunca el
color resuelto: con `system` la app sigue a `prefers-color-scheme` en vivo, sin
recargar. `index.html` trae un script pre-montaje que resuelve y aplica el tema
antes de que monte React, así que el primer frame ya sale del color correcto;
ese script y el proveedor comparten clave y valores, y cada uno lleva un
comentario apuntando al otro.

`src/components/ThemeSwitcher.jsx` es **idéntico byte a byte en todas las apps
del portafolio**. La fuente canónica vive en `jospabloh/acacia-app-standard` →
`shared/theme/`: cámbialo allí y cópialo, no lo edites aquí. Lo único propio de
esta app es `src/lib/useThemeMode.js` (de dónde sale el estado) y las variables
`--theme-switcher-bottom/right` en `src/index.css` (dónde se coloca).

Se quitaron los toggles del pie de la barra lateral y de la cabecera móvil.
`ThemeProvider` pasó de `enableSystem={false}` a `enableSystem`: el modo
"Sistema" no existía antes. El default sigue siendo `light` para quien no tenga
preferencia guardada.

## `npm run test:smoke` — comprueba el sitio DESPLEGADO (2026-08-22)

`tests/smoke/smoke.spec.js` es la suite compartida del portafolio, idéntica byte
a byte en todos los repos; la fuente canónica está en
`jospabloh/acacia-app-standard` → `shared/smoke/`. Lo propio de esta app vive en
`tests/smoke/smoke.config.js` (URL, `<title>`, cómo representa el tema).

**No comprueba el build local: comprueba lo que se sirve.** Es la automatización
de la regla que cada CLAUDE.md repite — mergear no deploya nada, y hay que
verificar por contenido y no por hash. Afirma cuatro cosas, todas derivadas de
lo que el propio repo produce (nunca de copy adivinado, que se rompe al cambiar
una palabra y enseña a ignorar la suite):

1. responde 200 y el `<title>` es el de esta app — no un deploy viejo ni otro;
2. no lanza excepciones al pintar;
3. el tema llega resuelto desde el primer frame (el script pre-montaje viajó);
4. el selector de esquina está montado, cambia el tema y la preferencia
   sobrevive a un reload.

**No corre en el pipeline normal ni desde un sandbox de desarrollo**: la salida
HTTPS ahí va por un proxy con allowlist que no incluye estos dominios. Corre en
GitHub Actions (`.github/workflows/smoke.yml`): `workflow_dispatch` para
dispararla a mano justo después de un deploy, y un cron diario como red.

    npm run test:smoke                      # contra producción
    SMOKE_URL=https://… npm run test:smoke  # contra un preview

Desde el 2026-08-22 la suite añade una quinta afirmación, del **módulo 12**: el
selector no tapa nada y nada lo tapa, en móvil (390), tablet (834) y escritorio
(1440), plegado y desplegado. Un control anclado por encima de todo en una
esquina es justo lo que acaba sentado sobre una barra inferior o un botón
flotante, y entonces la app pierde una función al ancho que nadie abrió. La
comprobación distingue las dos direcciones — algo pintado encima del selector, y
el selector respondiendo por un control que hay debajo — y nombra el control
afectado. Se coloca con `--theme-switcher-bottom/right`; si otra cosa ya es dueña
de esa esquina, se mueve el selector, no el control.

## Módulo 14 — auditoría de aislamiento multi-tenant (2026-08-22)

Nuevo en `jospabloh/acacia-app-standard`. **No es releer las reglas de RLS** (eso
es el módulo 4): es recorrer, con fecha y por escrito, todo lo que puede cruzar
un inquilino con otro — cada entidad, cada función de backend (el inquilino se
re-deriva en el servidor, nunca del cuerpo de la petición, y en update/delete se
comprueba contra el registro **almacenado**), cada campo bloqueado, cada
exportación/reporte/búsqueda, cada destinatario de correo o webhook, y el cambio
de inquilino. Contra el **esquema desplegado**, no contra el archivo del repo.

Se repite cuando se añade una entidad, una función o un rol. El resultado se
anota aquí, incluyendo **lo que no se pudo verificar** desde el entorno de
trabajo — normalmente una sesión autenticada como usuario restringido de un
segundo inquilino. Decirlo vale más que insinuar una cobertura que no se logró.

Lo que motiva el módulo es que todos los fallos de aislamiento que este
portafolio llegó a desplegar eran **sintácticamente válidos**: la rama de rol sin
`$and` al inquilino en `Parish` de cateqhub, las 84 instancias de liuma donde el
motor descartaba la cláusula hermana de `user_condition`, los campos de licencia
escribibles por el propio inquilino en puntos y rumbo, y el `PermissionProfile`
que ningún RLS puede consultar porque vive en otra fila.

### Resultado — 2026-08-23, contra el esquema desplegado

Contra `list_entity_schemas` (appId `6a455cf7813a409378d2af35`) y las 11
funciones.

**No hay cruce entre inquilinos** — no puede haberlo: **no hay inquilinos.** El
estado vivo es **0 `Company`** y **1 `User`** (el dueño, `super_admin`). Esa
tabla vacía no es que RADAR sea nuevo: es el `entities push` de FlowFin del
2026-08-21 que borró el modelo de datos (ver `acacia-app-standard` →
`docs/incidents.md`). Y esa tabla vacía resultó ser el hallazgo.

#### Lo urgente: la tabla vacía reabrió la puerta del fundador

`completeOnboarding` tiene tres casos, y el segundo dice —lo decía— esto:

```js
const companies = await sr.entities.Company.list();
if (companies.length === 0) {
  await sr.entities.User.update(user.id, { app_role: 'super_admin' });
```

La sección de arriba de este mismo archivo afirmaba que ese camino está
«permanentemente muerto» en cuanto existe la primera empresa. Era cierto. **El
borrado del 21 de agosto lo resucitó**: `Company` volvió a estar vacía, así que
la condición que debía cumplirse una sola vez en la vida de la app volvió a
cumplirse.

La cadena estaba completa y viva:

1. `src/pages/Register.jsx:31` — alta libre con `base44.auth.register`;
2. la app está en visibilidad **pública** desde el 2026-08-22 (se cambió para
   que la suite de humo pudiera alcanzarla — o sea, **la puerta la abrí yo**, y
   conviene que quede escrito así y no en pasiva);
3. `Company.list()` vacía → `app_role: 'super_admin'`;
4. `super_admin` salta **todas** las comprobaciones de permiso y facturación de
   este repo.

Es decir: el siguiente desconocido que se registrara en RADAR se llevaba el rol
de plataforma. Hoy no hay datos que robar —cero empresas— pero quedaría sentado
como administrador cuando entre el primer cliente real.

**Arreglado en este mismo commit**: la rama exige ahora, además de la tabla
vacía, que el solicitante sea `PLATFORM_OWNER_EMAIL`, y **falla cerrado** si el
secreto no está puesto (un env sin configurar no puede ser una segunda entrada).
La lección, que vale para todo el portafolio: **"no existe ningún X" no es
prueba de "esta app acaba de nacer"** en cuanto un borrado accidental es
posible. Una condición de arranque necesita una segunda mitad que sólo el dueño
pueda satisfacer.

**Esto no queda hecho hasta desplegarlo.** `npm run deploy` — mergear no
despliega. Mientras tanto, `base44 visibility private` cierra el paso 2 en un
comando.

#### El otro hallazgo: `PermissionProfile` no pide rol

```json
"update": {"$or":[{"data.company_id":"{{user.data.company_id}}"},{"user_condition":{"role":"admin"}}]}
```

Sin mitad de rol, igual que en stockflow. Un `employee` o un `store_manager`
puede reescribir el perfil de su propia empresa y concederse cualquier clave — y
las cinco funciones que re-comprueban `assertPermission` leen exactamente esa
fila (`_shared/_permissions.ts:55`). El trabajo del módulo 3 del 21 de agosto
está bien hecho; su entrada la controla el comprobado. Latente mientras no haya
empresas ni empleados. `kitchops` resuelve lo mismo con
`$and[business_id, role: business_admin]`.

### Lo que está bien, y es bastante

- **`Company` sí tiene candados de campo**: `tier`, `max_employees`,
  `license_expiry` y `status`, los cuatro a `rls.write: {role: admin}`. Es de las
  pocas apps del portafolio que trae el módulo 1 resuelto a nivel de campo. La
  regla de `update` concede la fila entera a cualquier miembro, pero con esos
  cuatro bloqueados lo que queda editable es exactamente lo que
  `CompanySettings.jsx` edita (nombre, zona horaria, `whatsapp_enabled`).
- **`Company.delete` es sólo `role: admin`.** Un administrador de empresa no
  puede borrar la suya: por eso el módulo 7 encamina la baja por un
  `SupportTicket`. Correcto, y mejor que stockflow y kitchops, donde cualquier
  miembro borra el inquilino.
- **`User` lleva los cuatro candados**: `role`, `app_role`, `company_id` y
  `employee_id`. La descripción de `employee_id` explica **por qué** existe: para
  que las escrituras de autoservicio exijan
  `data.employee_id == {{user.data.employee_id}}` en vez de fiarse de un id que
  mande el cliente.
- **`AttendanceRecord.create/update` exigen `$and[company_id, employee_id]`** —
  un empleado sólo escribe su propio registro, y dentro de su empresa. Es la RLS
  de autoservicio más fuerte del portafolio: lo fácil habría sido `created_by_id`;
  esto se apoya en un espejo bloqueado a nivel de campo, que sobrevive al vínculo.
- **`createEmployee`** sólo acepta `company_id` del cuerpo si el solicitante es
  `super_admin`; para todos los demás es `user.company_id`. Y comprueba el
  permiso **contra la empresa destino y antes de que salga la invitación**, para
  que un solicitante denegado no provoque un correo real.
- **`exportCompanyData`** deriva `companyId` de `auth.me()` y filtra las ocho
  entidades por él.
- **update/delete comparan contra el registro almacenado** en
  `updateAttendanceRecord`, `resolveApprovalRequest`, `createManagedRecord` y
  `updateSupportTicket`.

### Lo que no pude verificar

Todo lo anterior contra datos reales, porque no hay ninguno. Con 0 empresas y
1 usuario no existe una segunda empresa a la que cruzar, ni un `store_manager`
al que restringir. Esta pasada es lectura de código y del esquema desplegado, y
la única afirmación que se apoya en datos vivos es la que importa: `Company`
está vacía, y por eso la puerta del fundador estaba abierta.

## Módulo 15 — el puente con Mission Control: una llave por app (2026-08-23)

`INGEST_HMAC_SECRET` es **un solo valor compartido por todo el portafolio**, así
que una firma hecha con él demuestra «alguien tiene el secreto compartido» y
nunca «esto es RADAR». Como el nombre de la app viaja en el cuerpo, cualquier
app podía firmar una carga diciendo ser otra y Mission Control la escribía con
esa atribución. Lo encontró la auditoría del módulo 14 de Mission Control.

El arreglo es dejar de usar el maestro directamente:

    appKey = HMAC-SHA256(maestro, "acacia.app.v1." + slug)

El prefijo es separación de dominio: garantiza que una llave derivada no puede
coincidir con una firma sobre un cuerpo, y el `v1` permite rotar el esquema sin
rotar el maestro.

`base44/functions/{acaciaControl,notifyTicketCreated}/_acaciaSign.ts`
es **idéntico byte a byte en todas las apps del portafolio**. La fuente
canónica vive en `jospabloh/acacia-app-standard` →
`shared/bridge/acaciaSign.ts`: cámbialo allí y cópialo, no lo edites aquí.
Dos copias idénticas: `acaciaControl` **verifica** y `notifyTicketCreated`
**firma** el ticket que sale.

**La migración tiene un orden y es el contrario del obvio.** La verificación
acepta las dos llaves mientras `ACCEPT_LEGACY_MASTER` sea `true`, así que da
igual quién despliegue primero. Pero Mission Control despliega al mergear y las
apps a mano, así que MC siempre va primero — por eso MC sigue **firmando** con
el maestro hasta que las nueve apps acepten derivada. Falta el paso que cierra
el agujero de verdad: poner `ACCEPT_LEGACY_MASTER` en `false` en todas partes y
cambiar la firma de salida de MC a `signFor`. Mientras tanto una firma con el
maestro se sigue aceptando. `ACACIA_APP_SLUG` ya estaba puesto aquí.

**Y ahora hay una prueba, que es lo que faltaba.** El helper no lo comprobaba
nada: cada PR de este módulo decía que recibía su primer type-check al
desplegar. `acaciaSign.test.ts` (canónico en el repo estándar) fija el vector
que la mitad Node de Mission Control ya fijaba —dos implementaciones de HMAC en
dos runtimes sólo siguen siendo iguales si algo lo afirma, y una divergencia se
ve en runtime como `bad signature` en cada llamada, que parece un secreto mal
puesto y no lo es— y afirma lo que este módulo promete: un cuerpo firmado por
una app que dice ser otra **no** verifica. No tiene imports externos ni toca la
red, así que corre en un sandbox donde `jsr.io` y `deno.land` están bloqueados.
El test canónico está en el repo estándar; este repo no tiene paso de deno en CI.

**La criptografía en línea que esto reemplaza ya no está.** Cada `acaciaControl`
llevaba su propio `stableStringify` / `hmacHex` / `timingSafeEqual`, copiados a
mano contra `api/_lib/ingestSign.js` de Mission Control. Dejarlos al lado del
helper no es desorden: es una segunda implementación de la misma rutina en el
mismo archivo, que es exactamente la deriva que este módulo quita.

### `deno` SÍ se puede correr aquí — este archivo decía lo contrario

Este CLAUDE.md repetía «deno no está disponible en este sandbox» y por eso
varios cambios de `base44/functions/` se dieron por no verificables y se
mandaron a que CI los mirara por primera vez. **Es falso.** El binario se baja
de la release de GitHub —el mismo sitio de donde lo saca `setup-deno` en el
runner— y GitHub sí pasa por el proxy:

    curl -sSL -o deno.zip https://github.com/denoland/deno/releases/download/v2.9.5/deno-x86_64-unknown-linux-gnu.zip
    unzip -q deno.zip && chmod +x deno && ./deno --version

Lo que de verdad está bloqueado es `deno.land` y `jsr.io`, así que un test que
importe de ahí no resuelve; uno que no importe nada corre igual que en CI. Es la
misma lección que el `000` del proxy en Mission Control: **que una vía esté
bloqueada no significa que la pregunta no tenga respuesta.**

## Scheduled audit routine — 2026-08-24

Re-run of the standing 16-point audit routine. No open PRs, no stale audit
branches, working tree already clean on `main` at the start of this pass.

**Found and fixed — `PermissionProfile` RLS had no role check.** The
2026-08-22 module-14 audit above flagged this and left it unfixed ("latente
mientras no haya empresas ni empleados") because there was no live tenant to
demonstrate it against. It's a real gap regardless of live data: `create`/
`update`/`delete` were scoped to `data.company_id` only, so any `employee`
or `store_manager` could rewrite their own company's `PermissionProfile`
row and grant themselves any key — the five Safe functions
(`_shared/_permissions.ts`) trust that row unconditionally once a
`company_id` match exists. Closed the same way `Employee.jsonc` and
`ShiftTemplate.jsonc` already close this exact shape of gap: RLS's
`user_condition` can only check Base44's platform `role`, never the custom
`app_role` field, so create/update/delete are now service-role only. No
client code calls `entities.PermissionProfile.create`/`update` today (only
`PermissionContext.jsx`'s read), so nothing breaks; a future per-role
override UI needs a service-role function that checks the caller is
`company_admin`/`super_admin` for their own `company_id`, the same shape as
`createEmployee`.

**Found and fixed — stale doc comment.** `scripts/validate-entity-rls.mjs`
claimed its rules were "shared with the Deno test
(`base44/tests/entity_rls_test.ts`) so CI enforces them too" — that file
doesn't exist and `.github/workflows/ci.yml` has no Deno step. Corrected to
say what actually runs these rules (this script alone, via `npm run lint`).

**Found and fixed — changelog/version drift.** Modules 2, 3, 11, 12, 14 and
15 above all shipped and merged to `main` between 2026-08-21 and 2026-08-23
(confirmed via `git log`, all PRs merged, no open PRs) without a version
bump or `CHANGELOG.md`/`ChangeLog.jsx` entry — `package.json` and
`src/lib/appConfig.js` were still at `0.1.3` / 2026-08-18. Bumped to
`0.1.4` / 2026-08-24 with a changelog entry covering all six.

**Everything else checked, nothing further to fix:**
- Secrets: `git grep` for common key/token patterns and a review of `.env*`
  handling found nothing committed; all secrets are read from environment
  variables, consistent with every other module's write-up above.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm run lint` (eslint + `validate:rls` 15 entities/13 tenant-scoped +
  `validate:permissions` 13 keys/5 synced copies + `validate:functions` 10
  endpoints): all pass, including after this pass's changes.
- `npm run build`: passes.
- `npm run typecheck` (informational, non-blocking per `ci.yml`): 252
  pre-existing errors, up from the 236 recorded 2026-08-03 — expected
  drift from three weeks of real feature work, not a regression introduced
  here. Still out of scope to fix in one pass (see `ci.yml`'s own header
  comment); tracked, not silently ignored.
- `src/pages/UserManual.jsx` already exists, is tenant-neutral, and is
  wired into `App.jsx` at `/manual-usuario` — module 12 of the task
  checklist ("create minimal version if missing") had nothing to do.
- No automated test suite exists for `base44/functions/*.ts` beyond the
  validator scripts above (`base44/tests/` doesn't exist) — this matches
  what modules 3, 14 and 15 already documented, not a new gap.

**Not verified — same limits as every prior module-14/15 pass.** The
`PermissionProfile` RLS fix is a `.jsonc` change only; per module 11 above,
it does not reach the deployed backend until `npm run deploy:entities` is
run by hand, and no live second tenant exists to demonstrate the fixed
behavior against (the schema still shows 0 `Company` rows as of the last
audit read). UI/UX/cross-device/performance review, live UAT, and email
deliverability were not exercised in this pass — this sandbox has no
browser session against a live deploy and no second tenant to test
role-permission boundaries with; the same honesty-over-false-coverage
principle module 14 states applies here.
