import Link from "next/link";
import {
  FolderKanban,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkflowLink = {
  href: string;
  label: string;
  active?: boolean;
};

type PrimaryKey = "dashboard" | "projects";

const primaryNav: { key: PrimaryKey; href: string; label: string }[] = [
  { key: "dashboard", href: "/roles", label: "Dashboard" },
  { key: "projects", href: "/projects", label: "Projects" },
];

export function AdminShell({
  children,
  code,
  title,
  subtitle,
  badgeLabel,
  primaryActive,
  workflowLinks,
  workflowTitle = "Workflow Views",
  showWorkflowLinks = true,
  dashboardHref = "/roles",
  projectsHref = "/projects",
}: {
  children: React.ReactNode;
  code: string;
  title: string;
  subtitle?: string;
  badgeLabel: string;
  primaryActive: PrimaryKey;
  workflowLinks: WorkflowLink[];
  workflowTitle?: string;
  showWorkflowLinks?: boolean;
  dashboardHref?: string;
  projectsHref?: string;
}) {
  const isAdmin = badgeLabel === "Admin";
  const showSidebar = true;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-border)] bg-white/90 backdrop-blur">
        <div
          className={cn(
            "grid min-h-16 max-lg:grid-cols-1",
            showSidebar ? "grid-cols-[224px_1fr]" : "grid-cols-1",
          )}
        >
          {showSidebar ? (
            <div className="hidden border-r border-[color:var(--color-border)] lg:block" />
          ) : null}
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-border)] text-xs font-semibold text-[color:var(--color-primary)]">
                {code}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[color:var(--color-primary)]">
                  {title}
                </p>
                {subtitle ? (
                  <p className="truncate text-xs text-[color:var(--color-muted)]">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-primary)]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {badgeLabel}
              </span>
              <Button size="sm" variant="secondary">
                LogOut
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      <div
        className={cn(
          "grid min-h-[calc(100vh-65px)]",
          showSidebar ? "lg:grid-cols-[224px_1fr]" : "grid-cols-1",
        )}
      >
        {showSidebar ? (
          <aside className="border-r border-[color:var(--color-border)] bg-white px-3 py-4">
            <nav className="space-y-4" aria-label={isAdmin ? "Admin navigation" : "Role navigation"}>
              <div className="rounded-lg border border-[color:var(--color-border)] bg-white p-3">
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                  {isAdmin ? "Admin Navigation" : "Navigation"}
                </p>
                <div className="space-y-1">
                  {primaryNav.map((item) => (
                    <Link
                      key={item.key}
                      href={item.key === "dashboard" ? dashboardHref : projectsHref}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-[color:var(--color-muted-strong)] hover:bg-[color:var(--color-surface-soft)] hover:text-[color:var(--color-primary)]",
                        primaryActive === item.key &&
                          "bg-[color:var(--color-surface-soft)] text-[color:var(--color-primary)]",
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
              {showWorkflowLinks && workflowLinks.length > 0 ? (
                <div className="rounded-lg border border-[color:var(--color-border)] bg-white p-3">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                    {workflowTitle}
                  </p>
                  <div className="space-y-1">
                    {workflowLinks.map((link) => (
                      <Link
                        key={`${link.href}-${link.label}`}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-[color:var(--color-muted-strong)] hover:bg-[color:var(--color-surface-soft)] hover:text-[color:var(--color-primary)]",
                          link.active &&
                            "bg-[color:var(--color-surface-soft)] text-[color:var(--color-primary)]",
                        )}
                      >
                        <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </nav>
          </aside>
        ) : null}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

export function ShellHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--color-border)] bg-white px-6 py-5 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {action}
      </div>
    </div>
  );
}
