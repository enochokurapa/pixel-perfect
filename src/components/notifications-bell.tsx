import { useEffect } from "react";
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
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
