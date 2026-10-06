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
        <div key={d.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <Checkbox checked={!!schedule[d.key]?.works} onCheckedChange={(v) => update(d.key, "works", !!v)} />
          <span className="w-20 text-muted-foreground">{d.label}</span>
          {/* Both times stay together: on a phone the pair wraps under the day
              instead of pushing the dialog wider than the screen. */}
          <div className="flex min-w-[16rem] flex-1 items-center gap-2">
          <input
            type="time"
            value={schedule[d.key]?.start || "09:00"}
            onChange={(e) => update(d.key, "start", e.target.value)}
            disabled={!schedule[d.key]?.works}
            className="min-w-0 flex-1 border border-border rounded-lg px-2 py-1 text-sm disabled:opacity-40"
          />
          <span className="text-muted-foreground">a</span>
          <input
            type="time"
            value={schedule[d.key]?.end || "18:00"}
            onChange={(e) => update(d.key, "end", e.target.value)}
            disabled={!schedule[d.key]?.works}
            className="min-w-0 flex-1 border border-border rounded-lg px-2 py-1 text-sm disabled:opacity-40"
          />
          </div>
        </div>
      ))}
    </div>
  );
}