import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Building2, Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import BRAND from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type FormData = z.infer<typeof schema>;

export default function InviteAcceptPage({ mode }: { mode?: "invite" | "reset" }) {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ username: string; employeeName?: string } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isReset = mode === "reset";
  const token = params.token;

  useEffect(() => {
    if (!token) return;
    const endpoint = isReset ? `/api/auth/reset-token/${token}` : `/api/auth/invite/${token}`;
    fetch(endpoint)
      .then(r => r.json())
      .then(d => {
        if (d.error) setTokenError(d.error);
        else setTokenInfo(d);
      })
      .catch(() => setTokenError("Failed to validate link"));
  }, [token, isReset]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async (data: FormData) => {
    const endpoint = isReset ? "/api/auth/reset-password" : "/api/auth/accept-invite";
    try {
      await apiRequest("POST", endpoint, { token, password: data.password });
      setDone(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to set password", variant: "destructive" });
    }
  };

  const title = isReset ? "Reset Password" : "Accept Invitation";
  const subtitle = isReset ? "Set a new password for your account" : "Welcome! Set a password to activate your account";
  const btnLabel = isReset ? "Reset Password" : "Activate Account";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{BRAND.APP_NAME}</h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
        </div>

        {done ? (
          <Card className="border border-border shadow-md">
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isReset ? "Password Reset!" : "Account Activated!"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isReset ? "Your password has been updated." : "Your account is ready. You can now sign in."}
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate("/login")} data-testid="button-go-to-login">
                Go to Sign In
              </Button>
            </CardContent>
          </Card>
        ) : tokenError ? (
          <Card className="border border-border shadow-md">
            <CardContent className="p-8 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Link Invalid</h2>
                <p className="text-sm text-muted-foreground mt-1">{tokenError}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        ) : !tokenInfo ? (
          <Card className="border border-border shadow-md">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Validating link...</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-border shadow-md">
            <CardHeader className="pb-4 pt-6 px-6">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {tokenInfo.employeeName && (
                <p className="text-sm text-muted-foreground">
                  Welcome, <span className="font-medium text-foreground">{tokenInfo.employeeName}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">Username: <span className="font-mono font-medium">{tokenInfo.username}</span></p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type={showPw ? "text" : "password"}
                              placeholder="Min 8 characters"
                              className="pl-9 pr-9"
                              data-testid="input-new-password"
                            />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw(!showPw)}>
                              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type={showConfirm ? "text" : "password"}
                              placeholder="Re-enter password"
                              className="pl-9 pr-9"
                              data-testid="input-confirm-password"
                            />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowConfirm(!showConfirm)}>
                              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={form.formState.isSubmitting}
                    data-testid="button-activate-account"
                  >
                    {form.formState.isSubmitting ? "Setting password..." : btnLabel}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {BRAND.COMPANY_NAME} &copy; {BRAND.COPYRIGHT_YEAR}
        </p>
      </div>
    </div>
  );
}
