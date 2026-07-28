// updateSupportTicket — company_admin-only status change for SupportTicket.
//
// Why this exists: SupportTicket.jsonc's `update` RLS was company-wide with
// no role check — SupportCenter.jsx only *shows* the status dropdown to
// company_admin (`isAdmin` check), but a store_manager or employee calling
// entities.SupportTicket.update(id, {status}) directly would have succeeded.
// This moves the same check server-side and writes via asServiceRole.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const STATUSES = new Set(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.app_role !== 'company_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { ticketId, status } = await req.json();
    if (!ticketId) return Response.json({ error: 'ticketId is required' }, { status: 400 });
    if (!STATUSES.has(status)) return Response.json({ error: 'invalid status' }, { status: 400 });

    const sr = base44.asServiceRole;
    const tickets = await sr.entities.SupportTicket.filter({ id: ticketId });
    const ticket = tickets[0];
    if (!ticket) return Response.json({ error: 'not_found' }, { status: 404 });
    if (ticket.company_id !== user.company_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates = { status };
    if (status === 'resolved' && !ticket.resolved_at) updates.resolved_at = new Date().toISOString();
    if (status === 'closed' && !ticket.closed_at) updates.closed_at = new Date().toISOString();

    const updated = await sr.entities.SupportTicket.update(ticketId, updates);
    return Response.json({ success: true, ticket: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
