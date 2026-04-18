import { Activity, Home, Radio, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "overview", icon: Home, exact: true },
  { href: "/admin/players", label: "players", icon: Users },
  { href: "/admin/rooms", label: "rooms", icon: Activity },
  { href: "/admin/sessions", label: "live sessions", icon: Radio },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <aside className="flex w-56 flex-col border-r border-border p-4">
        <div className="mb-6 px-2 text-sm font-medium text-muted-foreground">admin</div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const active = item.exact
              ? location === item.href
              : location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            ← back to game
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
