import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// completeOnboarding — server-side counterpart of src/pages/Onboarding.jsx.
//
// Why this exists: onboarding used to set `app_role`/`company_id` on the caller
// directly from the client via `base44.auth.updateMe(...)`. Because User had no
// field-level write RLS on `role`/`app_role`/`company_id`, any self-registered
// user could instead call `updateMe({ role: 'admin' })` (or set `company_id` to
// any tenant's id) from the browser and become a platform-wide admin, or hop
// into another company's data — every business entity in this app trusts
// `{{user.data.company_id}}` / `user_condition: { role: 'admin' }` verbatim.
//
// This function is now the ONLY sanctioned way those fields get set after
// signup. It re-derives the same two cases Onboarding.jsx used to handle
// client-side, validates them itself, and writes with the service role
// (base44.asServiceRole), so it keeps working once User.role/app_role/
// company_id are locked to admin-only writes via field-level RLS.
//
//   1) Existing Employee record matching the caller's email -> the caller is
//      linked to that employee and promoted to that employee's `role`/
//      `company_id` (this is the invitation-equivalent: an admin must have
//      created the Employee row beforehand, so the grant is bounded by
//      whatever role/company that admin already assigned).
//   2) No Employee match AND no Company exists yet in the whole app -> this is
//      the very first user ever, i.e. the founder creating the first company.
//      They're promoted to `super_admin` (mirrors the original client check
//      `companies.length === 0`).
//   3) Neither case applies -> 404, same "not_found" outcome the client used
//      to show (contact your admin for access).
//
// DEPLOY ORDER: deploy this function FIRST, then the User/AppSession schema
// with the field-level RLS lock. If the lock lands before this function is
// live, onboarding will silently no-op (Base44 drops disallowed field writes
// from the old client-side updateMe calls) and new users will get stuck.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Idempotent: a user who already completed onboarding just gets their
    // current assignment echoed back instead of re-running the flow.
    if (user.app_role) {
      return Response.json({
        success: true,
        already_onboarded: true,
        app_role: user.app_role,
        company_id: user.company_id ?? null,
      });
    }

    const sr = base44.asServiceRole;
    const email = (user.email || '').trim();
    if (!email) return Response.json({ error: 'No email on account' }, { status: 400 });

    // Case 1: an admin already created an Employee row for this email — link
    // it to this account and inherit exactly the role/company that row grants.
    // Never trust a role/company_id passed in from the client for this case.
    const matches = await sr.entities.Employee.filter({ email });
    if (matches.length > 0) {
      const emp = matches[0];
      await sr.entities.Employee.update(emp.id, { user_id: user.id });
      await sr.entities.User.update(user.id, {
        app_role: emp.role,
        company_id: emp.company_id,
      });
      return Response.json({ success: true, app_role: emp.role, company_id: emp.company_id });
    }

    // Case 2: nobody has ever created a Company in this app yet -> this is the
    // founder flow (first user ever, about to create the first company on the
    // next screen). Re-check with the service role (never trust a client claim
    // of "no companies exist").
    const companies = await sr.entities.Company.list();
    if (companies.length === 0) {
      await sr.entities.User.update(user.id, { app_role: 'super_admin' });
      return Response.json({ success: true, app_role: 'super_admin', founder: true });
    }

    // Case 3: no Employee row for this email, and other companies already
    // exist — this account isn't provisioned yet. Same as the client's old
    // "not_found" state: the user needs an admin to create their Employee row.
    return Response.json({ error: 'not_found' }, { status: 404 });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return Response.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
});
