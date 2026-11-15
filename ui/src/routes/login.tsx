import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import LockIcon from "~icons/gravity-ui/lock";
import MailIcon from "~icons/gravity-ui/envelope";
import { $api } from "@/api/client";
import { userMessage } from "@/api/errors";
import { currentUserQueryOptions } from "@/auth/queries";
import { GoogleDriveBrandIcon } from "@/components/google-workspace";
import { preferencesQueryOptions } from "@/lib/preferences";
import { useAppLocale } from "@/lib/locale";
import { getQueryClient } from "@/lib/queryClient";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect:
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
        ? search.redirect
        : "/drive/files",
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useAppLocale();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signInMutation = $api.useMutation("post", "/v1/auth/cookie/password/login");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      toast.error(t("login.signInFailed"), {
        description: t("login.emailPasswordRequired"),
      });
      return;
    }
    try {
      await signInMutation.mutateAsync({
        body: { email: trimmedEmail, password },
      });
      const qc = getQueryClient();
      const meQuery = currentUserQueryOptions();
      const prefQuery = preferencesQueryOptions();
      await qc.invalidateQueries({ queryKey: meQuery.queryKey });
      await Promise.all([qc.ensureQueryData(meQuery), qc.ensureQueryData(prefQuery)]);
      toast.success(t("login.signedIn"));
      await navigate({ to: redirect, replace: true });
    } catch (error) {
      toast.error(t("login.signInFailed"), {
        description: userMessage(error),
      });
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f0f4f9] px-4 py-10 dark:bg-[#131314]">
      <Card className="w-full max-w-[26rem] rounded-3xl border border-border/50 bg-surface p-7 shadow-xl sm:p-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-secondary shadow-xs ring-1 ring-border/40">
            <GoogleDriveBrandIcon className="size-8" />
          </div>
          <h1 className="text-2xl font-normal tracking-tight text-foreground">
            {t("login.workspaceTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{t("login.workspaceSubtitle")}</p>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <TextField isDisabled={signInMutation.isPending}>
            <Label>{t("login.emailLabel")}</Label>
            <div className="relative flex items-center">
              <MailIcon className="pointer-events-none absolute left-3 size-4 text-muted" />
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="name@workspace.local"
                autoComplete="username"
                autoFocus
                className="w-full pl-9"
              />
            </div>
          </TextField>

          <TextField isDisabled={signInMutation.isPending}>
            <Label>{t("login.passwordLabel")}</Label>
            <div className="relative flex items-center">
              <LockIcon className="pointer-events-none absolute left-3 size-4 text-muted" />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-9"
              />
            </div>
          </TextField>

          <Button
            type="submit"
            variant="primary"
            className="mt-2 h-11 w-full rounded-full font-medium"
            isPending={signInMutation.isPending}
          >
            {t("login.signIn")}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          {t("login.workspaceHint")}
        </p>
      </Card>
    </div>
  );
}
