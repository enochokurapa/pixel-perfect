// Human-readable formatters for audit-log actions and details.
// Keep the vocabulary friendly — these strings appear in PDFs, CSVs and UI.

const ACTION_LABELS: Record<string, string> = {
  "visit.register": "Visitor registered",
  "visit.pre_register": "Visit pre-registered",
  "visit.self_register": "Visitor self-registered",
  "visit.approve": "Visit approved by host",
  "visit.reject": "Visit rejected by host",
  "visit.check_in": "Visitor checked in",
  "visit.check_out": "Visitor checked out",
  "visit.badge_issued": "Badge issued to visitor",
  "visit.photo_captured": "Visitor photo captured",
  "visit.vehicle_updated": "Vehicle details updated",
  "blacklist.add": "Added to blacklist",
  "blacklist.remove": "Removed from blacklist",
  "badge.add": "Badge created",
  "badge.remove": "Badge removed",
  "staff.create": "Staff account created",
  "staff.update": "Staff account updated",
  "staff.move_branch": "Staff moved to another branch",
  "branch.create": "Branch created",
  "branch.update": "Branch updated",
  "branch.delete": "Branch deleted",
  "auth.sign_in": "User signed in",
};

export function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const KEY_LABELS: Record<string, string> = {
  visitor: "Visitor",
  visitor_name: "Visitor",
  host: "Host",
  host_name: "Host",
  badge_number: "Badge number",
  badge_returned: "Badge returned",
  assets_verified: "Assets verified",
  reason: "Reason",
  branch: "Branch",
  branch_name: "Branch",
  photo_type: "Photo type",
  id_type: "ID type",
  id_number: "ID number",
  vehicle_plate: "Vehicle plate",
  vehicle_type: "Vehicle type",
  purpose: "Purpose",
  department: "Department",
  email: "Email",
  phone: "Phone",
  company: "Company",
  role: "Role",
  full_name: "Full name",
  notes: "Notes",
};

function humanKey(k: string): string {
  return KEY_LABELS[k] ?? k.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function humanValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map((x) => humanValue(x)).join(", ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${humanKey(k)}: ${humanValue(val)}`)
      .join(", ");
  }
  return String(v);
}

/** Turns { visitor: "Jane", badge_number: "001", badge_returned: true } into
 *  "Visitor: Jane; Badge number: 001; Badge returned: Yes" */
export function formatDetails(details: unknown): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const entries = Object.entries(details as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${humanKey(k)}: ${humanValue(v)}`).join("; ");
}

/** Convenience: action + optional details, e.g. "Visitor checked out — Badge number: 001; Badge returned: Yes" */
export function formatActionWithDetails(action: string, details: unknown): string {
  const label = formatActionLabel(action);
  const d = formatDetails(details);
  return d ? `${label} — ${d}` : label;
}
