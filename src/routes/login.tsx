import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: `Sign in — ${BRAND.name}` }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  const resendVerification = async (target: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: target,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    if (error) toast.error(error.message);
    else toast.success("Verification email resent. Check your inbox.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setPendingVerification(email);
          toast.success("Account created — check your email to verify.");
        } else {
          navigate({ to: "/app" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/confirm|verif/i.test(error.message)) {
            setPendingVerification(email);
          }
          throw error;
        }
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="block font-display text-lg font-semibold">{BRAND.name}</span>
            <span className="block text-[11px] text-sidebar-foreground/60">by OwlTech Solutions</span>
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Welcome visitors faster.<br />Know who is on site.<br />Keep every visit accountable.
          </h1>
          <p className="max-w-md text-sm text-sidebar-foreground/70">
            Visitor Flow manages registration, pre-registration, check-in, badges, access controls, blacklists,
            multi-branch activity and real-time visitor reporting from one secure workspace.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Secure visitor management and access control.</p>
      </aside>

      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <div className="mb-6 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-base font-semibold">{BRAND.name}</div>
                <div className="text-[11px] text-muted-foreground">{BRAND.shortDescription}</div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold">
              {mode === "signin" ? "Sign in to Visitor Flow" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Enter your credentials to access the visitor management dashboard."
                : "New users start with Host access; an admin can elevate roles."}
            </p>
          </div>

          {pendingVerification && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">Verify your email to continue</p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
                We sent a verification link to <span className="font-medium">{pendingVerification}</span>. Click the link, then sign in.
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-amber-900 underline dark:text-amber-200"
                onClick={() => resendVerification(pendingVerification)}
              >
                Resend verification email
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don't have an account?" : "Already have one?"}{" "}
            <button className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Back to Visitor Flow</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
