import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranchScope } from "@/hooks/use-branch-scope";

const ALL = "__all__";

export function BranchPicker() {
  const { availableBranches, activeBranchId, setActiveBranchId, canChooseAll } =
    useBranchScope();

  if (availableBranches.length === 0) return null;
  if (availableBranches.length === 1 && !canChooseAll) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        <span className="font-medium">{availableBranches[0].name}</span>
      </div>
    );
  }

  return (
    <Select
      value={activeBranchId ?? ALL}
      onValueChange={(v) => setActiveBranchId(v === ALL ? null : v)}
    >
      <SelectTrigger className="h-9 w-[200px]">
        <Building2 className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {canChooseAll && <SelectItem value={ALL}>All branches</SelectItem>}
        {availableBranches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
