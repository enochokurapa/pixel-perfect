import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const me = useCurrentUser();
  const qc = useQueryClient();

  const notifications = useQuery({
    enabled: !!me.userId,
    queryKey: ["notifications", me.userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, message, visit_id, read, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!me.userId) return;
    const ch = supabase
      .channel("notifications-" + me.userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${me.userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", me.userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me.userId, qc]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("recipient_id", me.userId!)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", me.userId] }),
  });

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  // Overstay watch — flashes the bell + beeps until no checked-in visitor is overstaying.
  const overstays = useQuery({
    enabled: !!me.userId,
    queryKey: ["overstay-watch", me.branchId],
    queryFn: async () => {
      let q = supabase
        .from("visits")
        .select("id, check_in_at, expected_duration_minutes, branch_id")
        .eq("status", "checked_in");
      if (!me.canViewAllBranches && me.branchId) q = q.eq("branch_id", me.branchId);
      const { data, error } = await q;
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).filter((v) => {
        if (!v.check_in_at) return false;
        return new Date(v.check_in_at).getTime() + (v.expected_duration_minutes ?? 180) * 60_000 < now;
      }).length;
    },
    refetchInterval: 30_000,
  });
  const hasOverstay = (overstays.data ?? 0) > 0;

  const beepRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hasOverstay) {
      if (beepRef.current) {
        window.clearInterval(beepRef.current);
        beepRef.current = null;
      }
      return;
    }
    const play = () => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, 220);
      } catch {
        /* ignore */
      }
    };
    play();
    beepRef.current = window.setInterval(play, 3000);
    return () => {
      if (beepRef.current) window.clearInterval(beepRef.current);
      beepRef.current = null;
    };
  }, [hasOverstay]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", hasOverstay && "animate-pulse text-destructive")}
          aria-label={hasOverstay ? `${overstays.data} overstayed visitor(s)` : "Notifications"}
        >
          <Bell className={cn("h-4 w-4", hasOverstay && "animate-bounce")} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          {hasOverstay && (
            <span className="absolute inset-0 rounded-full ring-2 ring-destructive/60 animate-ping pointer-events-none" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} className="h-7 text-xs">
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">You're all caught up.</div>
          )}
          {items.map((n) => {
            const body = (
              <div className={cn("flex gap-3 border-b px-4 py-3 text-sm hover:bg-muted/40", !n.read && "bg-primary/5")}>
                <div className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", !n.read ? "bg-primary" : "bg-transparent")} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-tight">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.message}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground/70">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
            return n.visit_id ? (
              <Link key={n.id} to="/app/visits/$id" params={{ id: n.visit_id }}>
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
