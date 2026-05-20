import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/workflow";

const roleChipClasses: Record<Role, string> = {
  "Account Manager": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Fiber Planning Team": "bg-sky-50 text-sky-700 ring-sky-200",
  "Solutions Architect": "bg-blue-50 text-blue-700 ring-blue-200",
  "Solutions Engineer": "bg-amber-50 text-amber-700 ring-amber-200",
  "BC Analyst / Finance": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CFO: "bg-orange-50 text-orange-700 ring-orange-200",
  "Sales Operations": "bg-violet-50 text-violet-700 ring-violet-200",
  SDU: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Site Acquisition Manager": "bg-sky-50 text-sky-700 ring-sky-200",
  "Project Manager": "bg-blue-50 text-blue-700 ring-blue-200",
  Contractor: "bg-amber-50 text-amber-700 ring-amber-200",
};

export function RoleChip({ role, className }: { role: Role; className?: string }) {
  return (
    <Badge
      className={cn(
        "rounded-full border-transparent px-2.5 py-1 text-xs font-semibold ring-1",
        roleChipClasses[role],
        className,
      )}
    >
      {role}
    </Badge>
  );
}
