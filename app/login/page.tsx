import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { AUTH_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const session = await verifySessionCookie(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  const next = query.next?.startsWith("/") && !query.next.startsWith("//")
    ? query.next
    : "/roles";

  if (session) {
    redirect(next.startsWith("/login") ? "/roles" : next);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgb(1_29_89_/_0.12),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_48%,#eef2ff_100%)] px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white shadow-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between gap-10 bg-[color:var(--color-primary)] p-8 text-white md:p-10">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="mt-10 max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/65">
                LTK Workflow
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                Sign in with your corporate directory account.
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/75">
                Access business case queues, project approvals, and lifecycle tasks
                with LDAP-backed authentication.
              </p>
            </div>
          </div>
          <p className="text-xs text-white/55">
            Your credentials are verified directly against LDAP and are not stored by this app.
          </p>
        </section>

        <section className="flex items-center justify-center p-6 md:p-10">
          <Card className="w-full max-w-md border-0 shadow-none">
            <CardHeader className="px-0">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl">LDAP Login</CardTitle>
              <CardDescription>
                Use your network username and password to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {query.error === "invalid" ? (
                <div className="mb-4 rounded-md border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-surface)] px-4 py-3 text-sm text-[color:var(--color-danger-text)]">
                  Invalid username or password. Please check your LDAP credentials.
                </div>
              ) : null}

              <form action={loginAction} className="space-y-4">
                <input type="hidden" name="next" value={next} />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--color-muted-strong)]" htmlFor="username">
                    Username
                  </label>
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    placeholder="e.g. angela.nakurro"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--color-muted-strong)]" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <FormSubmitButton className="w-full" pendingLabel="Signing in…">
                  Sign in
                </FormSubmitButton>
              </form>
              <Button asChild variant="ghost" className="mt-3 w-full">
                <Link href="/">Back to workflow overview</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
