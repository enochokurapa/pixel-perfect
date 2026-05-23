import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard, Users, UserPlus, BadgeCheck, ShieldAlert, BarChart3,
  Settings as SettingsIcon, LogOut, ShieldCheck, CalendarPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session === null) navigate({ to: "/login" });
  }, [session, navigate]);

  if (session === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <div className="animate-pulse text-sm">Loading…</div>
      </div>
    );
  }
  if (session === null) return null;

  return <Shell />;
}

function Shell() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/app/register", label: "Register visitor", icon: UserPlus, show: me.canRegister },
    { to: "/app/visitors", label: "Visitors", icon: Users, show: true },
    { to: "/app/pre-register", label: "Pre-register", icon: CalendarPlus, show: true },
    { to: "/app/badges", label: "Badges", icon: BadgeCheck, show: me.isAdmin || me.isReceptionist },
    { to: "/app/blacklist", label: "Blacklist", icon: ShieldAlert, show: true },
    { to: "/app/reports", label: "Reports", icon: BarChart3, show: true },
    { to: "/app/settings", label: "Settings", icon: SettingsIcon, show: me.isAdmin },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-background">
      <aside className="flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold">Sentinel VMS</div>
            <div className="text-[11px] text-sidebar-foreground/60">Access control</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {nav.filter((n) => n.show).map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold">
              {(me.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{me.profile?.full_name ?? "—"}</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60 capitalize">
                {me.roles.join(", ") || "no role"}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="overflow-auto">
        <div className="sticky top-0 z-10 flex justify-end border-b border-border/60 bg-background/80 px-6 py-2 backdrop-blur">
          <NotificationsBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
