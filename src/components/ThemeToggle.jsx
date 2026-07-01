import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

// Light/dark switch. `showLabel` renders the full sidebar row variant with a
// pill toggle; the compact variant is an icon button for tight headers.
export default function ThemeToggle({ showLabel = false }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (showLabel) {
    return (
      <button
        onClick={toggle}
        aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <span className="flex items-center gap-3">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? "Modo claro" : "Modo oscuro"}
        </span>
        <span className={`relative w-10 h-5 rounded-full transition-colors ${isDark ? "bg-primary" : "bg-muted-foreground/30"}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isDark ? "translate-x-5" : "translate-x-0.5"}`} />
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors touch-target"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
