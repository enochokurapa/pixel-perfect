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
  // School module
  | "school_admin"
  | "teacher"
  | "gate_officer"
  | "guardian"
  | "manage_students"
  | "check_in_student"
  | "approve_pickup"
  | "view_student_reports";

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
    key: "school",
    label: "School (active when branch is a school)",
    description: "Student movement, pickup control, and guardian portal.",
    roles: [
      { id: "school_admin", label: "School admin", description: "Full school management: students, guardians, attendance, pickups." },
      { id: "teacher", label: "Teacher", description: "Class teacher: can view students and check them in." },
      { id: "gate_officer", label: "Gate officer", description: "Operate the pickup gate: create pickup requests and release approved children." },
      { id: "guardian", label: "Guardian (portal)", description: "Parent/guardian: portal-only access to approve pickups and view their child's attendance." },
      { id: "manage_students", label: "Manage students", description: "Add, edit and assign guardians to students." },
      { id: "check_in_student", label: "Check students in/out", description: "Record student arrival and release approved students." },
      { id: "approve_pickup", label: "Override pickup approval", description: "Staff override to approve a pickup when guardian cannot respond." },
      { id: "view_student_reports", label: "View student reports", description: "Access attendance and pickup reports." },
    ],
  },
];

export const ALL_ROLES: Role[] = ROLE_GROUPS.flatMap((g) => g.roles.map((r) => r.id));

export const ROLE_LABELS: Record<Role, string> = Object.fromEntries(
  ROLE_GROUPS.flatMap((g) => g.roles.map((r) => [r.id, r.label])),
) as Record<Role, string>;
