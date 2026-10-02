import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const TIER_COLOR = { starter: "bg-muted text-muted-foreground", pro: "bg-success/10 text-success", enterprise: "bg-accent text-accent-foreground" };

export default function SuperAdminCompanies() {
  const [companies, setCompanies] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(null);
  const [form, setForm] = useState({ name: "", is_mexican: true, tier: "starter", max_employees: 15 });
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => setCompanies(await base44.entities.Company.list("-created_date"));
  useEffect(() => { load(); }, []);

  const createCompany = async () => {
    setSaving(true);
    try {
      // Not a direct base44.entities.Company.create(...): Company.jsonc's
      // `create` RLS checks Base44's PLATFORM `role` (admin-only), which a
      // RADAR super_admin who isn't also a platform collaborator on this app
      // does not have — RLS structurally can't see the custom `app_role`
      // field this page is actually gated by (same constraint documented for
      // PermissionProfile elsewhere in this codebase). createCompany is a
      // service-role function that re-checks `app_role === 'super_admin'` in
      // code instead, the same shape createEmployee already uses for Employee.
      await base44.functions.invoke("createCompany", form);
      setShowCreate(false);
      setForm({ name: "", is_mexican: true, tier: "starter", max_employees: 15 });
      load();
    } catch (error) {
      toast({ title: "No se pudo crear la empresa", description: error?.response?.data?.message || error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const inviteAdmin = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("createEmployee", {
        email: inviteForm.email,
        full_name: inviteForm.full_name,
        role: "company_admin",
        company_id: showInvite.id,
      });
      setShowInvite(null);
      setInviteForm({ email: "", full_name: "" });
    } catch (error) {
      toast({ title: "No se pudo enviar la invitación", description: error?.response?.data?.message || error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Empresas</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />Nueva empresa
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        {companies.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.is_mexican ? "México (LFT)" : "Internacional"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={TIER_COLOR[c.tier]}>{c.tier}</Badge>
              <Button variant="outline" size="sm" onClick={() => setShowInvite(c)}>Invitar admin</Button>
            </div>
          </div>
        ))}
        {companies.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Aún no hay empresas</p>}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva empresa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.is_mexican} onCheckedChange={(v) => setForm({ ...form, is_mexican: !!v })} />
              <Label>Empresa mexicana (aplica LFT)</Label>
            </div>
            <div>
              <Label>Tier</Label>
              <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter (hasta 15 empleados)</SelectItem>
                  <SelectItem value="pro">Pro (hasta 50 empleados)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (ilimitado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" disabled={saving || !form.name} onClick={createCompany}>
              {saving ? "Creando..." : "Crear empresa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showInvite} onOpenChange={(v) => !v && setShowInvite(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invitar admin a {showInvite?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre completo</Label><Input value={inviteForm.full_name} onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} /></div>
            <Button className="w-full bg-primary hover:bg-primary/90" disabled={saving || !inviteForm.email} onClick={inviteAdmin}>
              {saving ? "Enviando..." : "Enviar invitación"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}