import React from "react";
import { WEEKDAYS } from "@/lib/schedule";
import { Checkbox } from "@/components/ui/checkbox";

export default function ScheduleEditor({ schedule, onChange }) {
  const update = (day, field, value) => {
    onChange({ ...schedule, [day]: { ...schedule[day], [field]: value } });
  };

  return (
    <div className="space-y-2">
      {WEEKDAYS.map((d) => (
        <div key={d.key} className="flex items-center gap-3 text-sm">
          <Checkbox checked={!!schedule[d.key]?.works} onCheckedChange={(v) => update(d.key, "works", !!v)} />
          <span className="w-20 text-muted-foreground">{d.label}</span>
          <input
            type="time"
            value={schedule[d.key]?.start || "09:00"}
            onChange={(e) => update(d.key, "start", e.target.value)}
            disabled={!schedule[d.key]?.works}
            className="border border-border rounded-lg px-2 py-1 text-sm disabled:opacity-40"
          />
          <span className="text-muted-foreground">a</span>
          <input
            type="time"
            value={schedule[d.key]?.end || "18:00"}
            onChange={(e) => update(d.key, "end", e.target.value)}
            disabled={!schedule[d.key]?.works}
            className="border border-border rounded-lg px-2 py-1 text-sm disabled:opacity-40"
          />
        </div>
      ))}
    </div>
  );
}