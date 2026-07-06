import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  BadgeCheck,
  ShieldAlert,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  ShieldCheck,
  CalendarPlus,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import { BranchPicker } from "@/components/branch-picker";
import { BranchScopeProvider } from "@/hooks/use-branch-scope";

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

  return (
    <BranchScopeProvider>
      <Shell />
    </BranchScopeProvider>
  );
}

function Shell() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close the mobile drawer when the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const nav = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/app/register", label: "Register visitor", icon: UserPlus, show: me.canRegister || me.canCheckout },
    { to: "/app/visitors", label: "Visitors", icon: Users, show: true },
    { to: "/app/pre-register", label: "Pre-register", icon: CalendarPlus, show: me.canPreRegister },
    { to: "/app/badges", label: "Badges", icon: BadgeCheck, show: me.canManageBadges },
    { to: "/app/blacklist", label: "Blacklist", icon: ShieldAlert, show: me.canManageBlacklist },
    { to: "/app/reports", label: "Reports", icon: BarChart3, show: me.canViewReports },
    { to: "/app/settings", label: "Settings", icon: SettingsIcon, show: me.isAdmin || me.canManageStaff || me.canManageBranches },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const SidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate font-display text-sm font-semibold">Sentinel VMS</div>
          <div className="truncate text-[11px] text-sidebar-foreground/60">Access control</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav
          .filter((n) => n.show)
          .map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
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
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold">
            {(me.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{me.profile?.full_name ?? "—"}</div>
            <div className="truncate text-[11px] text-sidebar-foreground/60 capitalize">
              {me.roles.join(", ") || "no role"}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarContent}
          </aside>
        </>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div className="text-sm font-semibold">Sentinel VMS</div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <BranchPicker />
            <NotificationsBell />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
