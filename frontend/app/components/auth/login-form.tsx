import { useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, LoaderCircle, LogIn, Shield, Users, UserRound, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";

/**
 * Email + password login form backed by POST /api/auth/login.
 * Includes 1-Click Demo Logins for instant evaluation of Admin, Head, and Employee roles.
 */
export function LoginForm() {
  const login = useLogin();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailInvalid = submitted && email.trim() === "";
  const passwordInvalid = submitted && password === "";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!email.trim() || !password) return;
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate("/dashboard"),
      },
    );
  }

  function handleQuickLogin(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setSubmitted(false);
    login.mutate(
      { email: demoEmail, password: demoPass },
      {
        onSuccess: () => navigate("/dashboard"),
      },
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailInvalid}
            aria-describedby={emailInvalid ? "login-email-error" : undefined}
          />
          {emailInvalid && (
            <p id="login-email-error" className="text-xs text-destructive">
              Email is required.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <p className="text-xs text-muted-foreground">Provided by your administrator</p>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={passwordInvalid}
              aria-describedby={passwordInvalid ? "login-password-error" : undefined}
              className="pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {passwordInvalid && (
            <p id="login-password-error" className="text-xs text-destructive">
              Password is required.
            </p>
          )}
        </div>

        {login.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{getErrorMessage(login.error)}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full font-medium" disabled={login.isPending}>
          {login.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <LogIn />
          )}
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* 1-Click Quick Demo Sign-In */}
      <div className="relative border-t pt-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          <Sparkles className="size-3.5 text-primary" />
          <span>1-Click Demo Accounts</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={login.isPending}
            onClick={() => handleQuickLogin("zainmurtazaadmin@gmail.com", "zainmurtazaadmin")}
            className="flex flex-col items-center justify-center h-auto py-2.5 px-2 text-center text-xs hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <Shield className="size-4 text-emerald-600 mb-1" />
            <span className="font-semibold text-foreground">Admin</span>
            <span className="text-[10px] text-muted-foreground truncate w-full">Zain M.</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={login.isPending}
            onClick={() => handleQuickLogin("sarah.chen@company.com", "zainmurtazaadmin")}
            className="flex flex-col items-center justify-center h-auto py-2.5 px-2 text-center text-xs hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <Users className="size-4 text-blue-600 mb-1" />
            <span className="font-semibold text-foreground">Dept Head</span>
            <span className="text-[10px] text-muted-foreground truncate w-full">Sarah C.</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={login.isPending}
            onClick={() => handleQuickLogin("hamza@gmail.com", "zainmurtazaadmin")}
            className="flex flex-col items-center justify-center h-auto py-2.5 px-2 text-center text-xs hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <UserRound className="size-4 text-purple-600 mb-1" />
            <span className="font-semibold text-foreground">Employee</span>
            <span className="text-[10px] text-muted-foreground truncate w-full">Hamza T.</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
