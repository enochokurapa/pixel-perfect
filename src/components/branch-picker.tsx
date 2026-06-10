import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const { availableBranches, activeBranchId, activeBranchIds, setActiveBranchId, setActiveBranchIds, canChooseAll } =
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

  if (canChooseAll) {
    const selected = activeBranchIds ?? [];
    const label = activeBranchIds === null
      ? "All branches"
      : selected.length === 1
      ? availableBranches.find((b) => b.id === selected[0])?.name ?? "1 branch"
      : `${selected.length} branches`;
    const toggle = (id: string, on: boolean) => {
      const base = activeBranchIds === null ? availableBranches.map((b) => b.id) : selected;
      const next = on ? [...new Set([...base, id])] : base.filter((x) => x !== id);
      setActiveBranchIds(next.length === availableBranches.length || next.length === 0 ? null : next);
    };
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 w-[200px] justify-start gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-3">
          <Button variant="ghost" size="sm" className="h-8 w-full justify-start" onClick={() => setActiveBranchIds(null)}>
            All branches
          </Button>
          <div className="space-y-1">
            {availableBranches.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
                <Checkbox checked={activeBranchIds === null || selected.includes(b.id)} onCheckedChange={(c) => toggle(b.id, c === true)} />
                <span className="truncate">{b.name}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
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
