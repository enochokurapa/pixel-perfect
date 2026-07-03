// Central definition of all permission roles, grouped for the Settings UI.
// Each item is an independent checkbox in the role editor.

export type Role =
  | "admin"
  | "manage_staff"
  | "manage_branches"
  | "manage_blacklist"
  | "view_all_branches"
  | "view_reports"
  | "host"
  | "approve_own_visits"
  | "reject_own_visits"
  | "extend_own_visits"
  | "register_guest"
  | "register_contractor"
  | "register_delivery"
  | "checkout_visitor"
  | "manage_badges"
  | "pre_register_guest"
  | "pre_register_contractor"
  | "pre_register_delivery"
  | "capture_visitor_photo"
  | "view_photo_reports"
  | "view_audit_log";

export type RoleGroup = {
  key: string;
  label: string;
  description: string;
  roles: { id: Role; label: string; description: string }[];
};

export const ROLE_GROUPS: RoleGroup[] = [
  {
    key: "admin",
    label: "Admin",
    description: "Organization-wide management and oversight.",
    roles: [
      { id: "admin", label: "Super admin", description: "Full control. Implicitly grants every other permission and can create more admins." },
      { id: "manage_staff", label: "Manage staff", description: "Create, edit, freeze and delete staff accounts." },
      { id: "manage_branches", label: "Manage branches", description: "Add, edit and remove office branches." },
      { id: "manage_blacklist", label: "Manage blacklist", description: "Add or remove visitors from the blacklist." },
      { id: "view_all_branches", label: "View all branches", description: "See visitors and reports across every branch." },
      { id: "view_reports", label: "View & export reports", description: "Access the Reports module and Excel/PDF exports." },
    ],
  },
  {
    key: "host",
    label: "Host",
    description: "Receiving and managing one's own visitors.",
    roles: [
      { id: "host", label: "Be a host", description: "Can be selected as a host on visits and receive arrival notifications." },
      { id: "approve_own_visits", label: "Approve own visits", description: "Approve pre-registered visits where they are the host." },
      { id: "reject_own_visits", label: "Reject own visits", description: "Reject pre-registered visits with a reason." },
      { id: "extend_own_visits", label: "Extend stay", description: "Extend expected visit duration for their visitors." },
    ],
  },
  {
    key: "register_guest",
    label: "Register guest (walk-in)",
    description: "Front desk / gate registration at arrival.",
    roles: [
      { id: "register_guest", label: "Register guests", description: "Register walk-in guests at the reception or gate." },
      { id: "register_contractor", label: "Register contractors", description: "Register walk-in contractors." },
      { id: "register_delivery", label: "Register deliveries", description: "Register walk-in deliveries." },
      { id: "checkout_visitor", label: "Check visitors in/out", description: "Confirm check-in and check-out at the gate." },
      { id: "manage_badges", label: "Manage badges", description: "Issue, return and manage badge inventory." },
    ],
  },
  {
    key: "pre_register_guest",
    label: "Pre-register guest",
    description: "Scheduling visitors in advance.",
    roles: [
      { id: "pre_register_guest", label: "Pre-register guests", description: "Schedule a guest visit and send a confirmation email." },
      { id: "pre_register_contractor", label: "Pre-register contractors", description: "Schedule a contractor visit in advance." },
      { id: "pre_register_delivery", label: "Pre-register deliveries", description: "Schedule a delivery in advance." },
    ],
  },
  {
    key: "photo_audit",
    label: "Photo capture & auditing",
    description: "Camera capture during registration and system-wide audit visibility.",
    roles: [
      { id: "capture_visitor_photo", label: "Capture visitor photo & ID", description: "Use the camera to take a visitor face photo and/or an ID photo during registration." },
      { id: "view_photo_reports", label: "View photo reports", description: "See Visitor Photo and Visitor ID reports and export them." },
      { id: "view_audit_log", label: "View audit log", description: "See the full system activity/audit log across users, branches, and departments." },
    ],
  },
];

export const ALL_ROLES: Role[] = ROLE_GROUPS.flatMap((g) => g.roles.map((r) => r.id));

export const ROLE_LABELS: Record<Role, string> = Object.fromEntries(
  ROLE_GROUPS.flatMap((g) => g.roles.map((r) => [r.id, r.label])),
) as Record<Role, string>;
