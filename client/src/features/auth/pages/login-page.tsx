import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import BRAND from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Building2 } from "lucide-react";

// Demo accounts — one per role. Selecting one fills the username; the tester
// enters the shared demo password (set via SEED_PASSWORD when the DB was seeded).
// No passwords are stored here — they must never ship in the client bundle.
const DEMO_ACCOUNTS = [
  { role: "Super Admin", name: "Super Admin", username: "superadmin" },
  { role: "HR", name: "Priya Nair", username: "priya.nair" },
  { role: "Finance", name: "Neha Verma", username: "finance@emoenergy.in" },
  { role: "CEO", name: "Rajesh Khanna", username: "ceo@emoenergy.in" },
  { role: "Manager", name: "Manoj Rao", username: "manager@emoenergy.in" },
  { role: "Logistics", name: "Leela Nair", username: "logistics@emoenergy.in" },
  { role: "Employee", name: "Sneha Patel", username: "sneha.patel" },
];

export default function LoginPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function pickProfile(username: string) {
    // Fill the username only; the tester types the shared demo password.
    setProfile(username);
    setEmail(username);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Real credential login — works in production (unlike the dev-login bypass).
      await apiRequest("POST", "/api/auth/login", { username: email, password });
      await qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Sign in failed. Check your username and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{BRAND.APP_NAME}</h1>
              <p className="text-sm text-muted-foreground">{BRAND.COMPANY_NAME}</p>
            </div>
          </div>

          {/* Demo-account quick login (internal testing). */}
          <div className="space-y-2 rounded-[16px] border border-dashed border-border p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Demo accounts</Label>
            <Select value={profile} onValueChange={pickProfile}>
              <SelectTrigger data-testid="select-dev-profile"><SelectValue placeholder="Select a role…" /></SelectTrigger>
              <SelectContent>
                {DEMO_ACCOUNTS.map((p) => (
                  <SelectItem key={p.username} value={p.username}>{p.role} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Fills the username — enter the demo password, then Sign In.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email / Username</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setProfile(""); }}
                placeholder="you@emoenergy.in"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                data-testid="input-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-11"
              size="lg"
              disabled={loading}
              data-testid="button-sign-in"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            Internal testing sign-in. Pick a demo account above, or enter your
            username and password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
