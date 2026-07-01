import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const ARTICLES = [
  { title: "Cómo registrar mi entrada y salida", content: "Entra a Mi Portal y presiona el botón grande 'Registrar Entrada'. Al terminar tu jornada presiona 'Registrar Salida'." },
  { title: "Cómo solicitar días de vacaciones o permiso (PTO)", content: "Desde Mi Portal presiona 'Solicitar días/permiso (PTO)', elige el tipo, fechas y motivo." },
  { title: "Cómo solicitar una extensión de horario", content: "Después de registrar tu entrada, presiona 'Solicitar extensión 30 min' e indica el motivo." },
  { title: "Cómo consultar el estado de mis solicitudes", content: "Visita la página 'Mis Solicitudes' para ver el estado de tus PTOs, extensiones y cambios de horario." },
  { title: "Cómo agregar empleados (administradores)", content: "Desde el Dashboard entra a 'Empleados' y presiona 'Nuevo empleado' para capturar sus datos y horario." },
  { title: "Cómo aprobar solicitudes (gerentes/administradores)", content: "Entra a 'Aprobaciones' y revisa las pestañas de PTO, cambios de horario y extensiones para aprobar o rechazar." },
  { title: "Cómo actualizar los datos de mi empresa", content: "Los administradores pueden entrar a 'Configuración de Empresa' para editar el nombre, zona horaria y WhatsApp." },
  { title: "Cómo cargar documentos a mi expediente", content: "En 'Perfil de Empleado' puedes subir documentos como identificación o contrato desde la sección de documentos." },
];

export default function UserManual() {
  const [query, setQuery] = useState("");

  const filtered = ARTICLES.filter(
    (a) => a.title.toLowerCase().includes(query.toLowerCase()) || a.content.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Manual de Usuario" subtitle="Encuentra respuestas rápidas sobre el uso de RADAR" />
      <div className="max-w-2xl mx-auto px-6">
        <div className="relative mb-6">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input className="pl-9" placeholder="Buscar en el manual..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.title} className="bg-white rounded-2xl border border-slate-100 p-5">
              <p className="font-medium text-slate-900 mb-1">{a.title}</p>
              <p className="text-sm text-slate-500">{a.content}</p>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No se encontraron resultados</p>}
        </div>
      </div>
    </div>
  );
}