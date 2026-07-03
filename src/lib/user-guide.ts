import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type GuideSection = {
  heading: string;
  steps: string[];
  tips?: string[];
};

export type GuideModule = {
  key: string;
  title: string;
  intro: string;
  sections: GuideSection[];
};

export const USER_GUIDES: GuideModule[] = [
  {
    key: "getting-started",
    title: "Getting Started",
    intro:
      "This guide walks new users through logging in, understanding their branch scope, and navigating the Sentinel Visitor Management System.",
    sections: [
      {
        heading: "Signing in",
        steps: [
          "Open the app URL provided by your administrator.",
          "Enter the email and temporary password given to you.",
          "You will be redirected to the dashboard for your assigned branch.",
        ],
        tips: [
          "If sign-in fails, ask your admin to confirm your account is Active and not Frozen.",
        ],
      },
      {
        heading: "Understanding the top bar",
        steps: [
          "Branch picker – choose which branch(es) you want to view.",
          "Notification bell – blinks red when an action is pending for you.",
          "Profile menu – sign out or change your password.",
        ],
      },
    ],
  },
  {
    key: "dashboard",
    title: "Dashboard",
    intro: "The dashboard summarises today's activity across all branches you are permitted to see.",
    sections: [
      {
        heading: "Reading the tiles",
        steps: [
          "Today's visits: number of visitors who have checked in today.",
          "Currently on premises: those checked in but not yet out.",
          "With assets: visitors who came in today carrying laptops or devices.",
          "Pre-registered pending: guests awaiting approval or arrival.",
        ],
      },
      {
        heading: "Recent visits list",
        steps: [
          "Click a row to open the visit detail page.",
          "Filter by branch using the branch picker.",
        ],
      },
    ],
  },
  {
    key: "register",
    title: "Registering a Visitor",
    intro: "Use the Register module to capture walk-in guests, contractors, or deliveries.",
    sections: [
      {
        heading: "Classification (Card 1)",
        steps: [
          "Pick visitor type (Guest, Contractor, Delivery, Supplier).",
          "Select the branch the visitor is coming to.",
          "Choose Walk-in or Drive-in.",
          "For Drive-in, capture the vehicle plate and vehicle type – both are mandatory.",
        ],
      },
      {
        heading: "Visitor details (Card 2)",
        steps: [
          "Enter the phone number first – returning visitors auto-fill.",
          "Choose the host from the dropdown, or type a host name if they are not in the system.",
          "Assign an available badge if you already have one at the desk.",
        ],
      },
      {
        heading: "Assets and ID",
        steps: [
          "Toggle 'Bringing assets' to Yes to capture brand + serial for each item.",
          "Optionally upload a photo of the visitor's ID for audit.",
        ],
      },
    ],
  },
  {
    key: "pre-register",
    title: "Pre-Registration",
    intro: "Hosts can pre-register expected guests so front-desk verification is faster.",
    sections: [
      {
        heading: "Creating a pre-registration",
        steps: [
          "Open Pre-register from the sidebar.",
          "Fill in visitor name, phone, expected date/time, and purpose.",
          "Select yourself (or another host) and submit.",
        ],
      },
      {
        heading: "What happens next",
        steps: [
          "The visitor appears in the Pre-registered pending tile.",
          "On arrival, the front desk searches by phone and completes check-in.",
        ],
      },
    ],
  },
  {
    key: "kiosk",
    title: "Kiosk / QR Self-Registration",
    intro: "Guests can self-register by scanning the branch QR code.",
    sections: [
      {
        heading: "Setting up the QR",
        steps: [
          "Open Settings and locate the Kiosk QR card.",
          "Ensure your project is published so the URL works for guests.",
          "Print the QR and display it at reception.",
        ],
      },
      {
        heading: "Guest flow",
        steps: [
          "Guest scans QR and opens the branch kiosk page.",
          "Chooses Walk-in or Drive-in and enters vehicle if applicable.",
          "Submits and sees a live progress screen (Submitted → Approved → Checked-in).",
        ],
      },
    ],
  },
  {
    key: "approvals",
    title: "Approving Visits",
    intro: "Hosts approve or reject pending visits from the visit detail page.",
    sections: [
      {
        heading: "Approve",
        steps: [
          "Open the visit from your notification bell.",
          "Review purpose, assets, and identity.",
          "Click Approve. The front desk is notified to issue a badge.",
        ],
      },
      {
        heading: "Reject",
        steps: [
          "Click Reject, type a reason, and confirm.",
          "The visit status becomes Rejected and the visitor cannot be checked in.",
        ],
      },
    ],
  },
  {
    key: "badge-issue",
    title: "Issuing a Badge (Front Desk)",
    intro: "Once a host approves, the front desk finalises check-in by verifying assets and issuing a badge.",
    sections: [
      {
        heading: "Verify and issue",
        steps: [
          "Open the approved visit from the notification.",
          "Click Verify & Issue Badge.",
          "Select an available badge from your branch's inventory.",
          "Confirm assets have been physically verified (tick the checkbox).",
          "Submit – the visitor status becomes Checked-in with a timestamp.",
        ],
      },
    ],
  },
  {
    key: "checkout",
    title: "Checking Out",
    intro: "Complete the visit when the guest leaves.",
    sections: [
      {
        heading: "Standard checkout",
        steps: [
          "Open the checked-in visit.",
          "Click Check out.",
          "Confirm badge returned and assets verified.",
          "Optionally add notes and confirm. Exit time is captured automatically.",
        ],
      },
    ],
  },
  {
    key: "blacklist",
    title: "Blacklist Management",
    intro: "Prevent unwanted visitors from being registered.",
    sections: [
      {
        heading: "Adding to blacklist",
        steps: [
          "From a visit detail page, click Manage blacklist – details prefill.",
          "Or open Blacklist directly and search by phone.",
          "Provide a reason and save. Future registrations are blocked with that reason.",
        ],
      },
    ],
  },
  {
    key: "reports",
    title: "Reports",
    intro: "Comprehensive reports across visits, trends, operations, approvals, and timelines.",
    sections: [
      {
        heading: "Filtering",
        steps: [
          "Use the date range and branch filters at the top.",
          "Switch tabs (Overview, Trends, Operations, Approvals, Timeline).",
        ],
      },
      {
        heading: "Exporting",
        steps: [
          "Every table has CSV, Excel, and PDF export buttons.",
          "Downloads use the currently filtered rows.",
        ],
      },
    ],
  },
  {
    key: "badges-inventory",
    title: "Badge Inventory",
    intro: "Manage physical badges per branch.",
    sections: [
      {
        heading: "Adding badges",
        steps: [
          "Open Badges and select your branch.",
          "Add badge numbers one by one or bulk import a range.",
          "Available badges appear in the Register and Issue Badge dropdowns.",
        ],
      },
    ],
  },
  {
    key: "settings",
    title: "Settings & Administration",
    intro: "Admins manage branches, staff, roles, and system-wide configuration.",
    sections: [
      {
        heading: "Branches",
        steps: [
          "Create branches from the Branches card.",
          "New branches start empty – add badges, staff and roles for that branch.",
        ],
      },
      {
        heading: "Staff & roles",
        steps: [
          "Create a staff user with a temporary password.",
          "Assign primary branch and roles (Register Guest, Manage Badges, etc.).",
          "Use 'Branches' to grant multi-branch access.",
          "Use 'Move to…' to transfer a staff member's primary branch.",
          "Freeze/unfreeze staff via the Active switch.",
        ],
      },
    ],
  },
  {
    key: "photo-capture",
    title: "Visitor Photo Capture",
    intro:
      "Operators with the 'Capture visitor photo' permission can attach a face photo and/or an ID photo to any visitor registration. Both steps are optional and will not slow down registration.",
    sections: [
      {
        heading: "Capturing the face photo",
        steps: [
          "Complete the visitor details on the registration form.",
          "In the 'Visitor photo capture' card, click 'Capture' under 'Visitor face photo'.",
          "Choose the front or back camera from the dropdown when the dialog opens.",
          "Use Capture → Retake if needed → Confirm to attach the photo. Cancel discards it.",
          "Click 'Skip' by leaving the slot empty and submitting registration.",
        ],
      },
      {
        heading: "Capturing an ID photo",
        steps: [
          "Click 'Capture' under 'Visitor ID photo'.",
          "Select the ID type: National ID, Passport, Driving Permit, Company ID, or Other.",
          "Choose front or back camera, capture, retake if necessary, then confirm.",
          "The ID type is stored on the visit record alongside the image.",
        ],
      },
      {
        heading: "Storage & privacy",
        steps: [
          "Images are compressed on-device and uploaded to the private 'visitor-photos' bucket.",
          "Each file is scoped to its branch and visit and is only visible to authorised staff.",
          "Capture date/time is stored automatically on the visit record.",
        ],
      },
    ],
  },
  {
    key: "photo-audit-reports",
    title: "Photo & Audit Reports",
    intro:
      "The Reports module now includes photo galleries and a full activity audit log. Access is role-based (View photo reports / View audit log).",
    sections: [
      {
        heading: "Visitor photo report",
        steps: [
          "Open Reports → Visitor photos.",
          "Filter by branch and date range using the existing controls.",
          "Each card shows the face photo, name, phone, company, purpose, branch and date/time.",
          "Export the current selection to Excel or PDF.",
        ],
      },
      {
        heading: "Visitor ID report",
        steps: [
          "Open Reports → Visitor IDs.",
          "Cards display the ID image, visitor details, ID type and visit details.",
          "Export the list to Excel or PDF.",
        ],
      },
      {
        heading: "Audit log",
        steps: [
          "Open Reports → Audit log to see every action performed in the system.",
          "Filter by branch (already scoped to your access), date range and action type.",
          "Each entry shows who performed the action, their department, the entity affected and the branch.",
          "Export the audit log to Excel or PDF for compliance.",
        ],
      },
      {
        heading: "Permissions",
        steps: [
          "Admins grant 'Capture visitor photo', 'View photo reports' and 'View audit log' from Settings → Staff.",
          "Users without a permission will not see the corresponding button or tab.",
        ],
      },
    ],
  },
];

export function downloadModuleGuidePdf(mod: GuideModule) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Sentinel VMS — User Guide", 14, 12);
  doc.setFontSize(12);
  doc.text(mod.title, 14, 22);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  const introLines = doc.splitTextToSize(mod.intro, pageWidth - 28);
  doc.text(introLines, 14, 38);

  let y = 38 + introLines.length * 6 + 4;
  mod.sections.forEach((s) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    autoTable(doc, {
      startY: y,
      head: [[s.heading]],
      body: [
        ...s.steps.map((step, i) => [`${i + 1}. ${step}`]),
        ...(s.tips ?? []).map((t) => [`💡 Tip: ${t}`]),
      ],
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error – lastAutoTable is added by plugin
    y = (doc.lastAutoTable?.finalY ?? y + 20) + 8;
  });

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.getHeight() - 8);
  doc.save(`sentinel-vms-guide-${mod.key}.pdf`);
}

export function downloadFullGuidePdf() {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 52, 96);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("Sentinel VMS", 14, 14);
  doc.setFontSize(13);
  doc.text("Complete User Guide", 14, 24);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.text("Table of contents", 14, 44);
  USER_GUIDES.forEach((m, i) => {
    doc.text(`${i + 1}. ${m.title}`, 20, 52 + i * 6);
  });

  USER_GUIDES.forEach((mod) => {
    doc.addPage();
    doc.setFillColor(15, 52, 96);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text(mod.title, 14, 14);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    const introLines = doc.splitTextToSize(mod.intro, pageWidth - 28);
    doc.text(introLines, 14, 32);
    let y = 32 + introLines.length * 6 + 4;

    mod.sections.forEach((s) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      autoTable(doc, {
        startY: y,
        head: [[s.heading]],
        body: [
          ...s.steps.map((step, i) => [`${i + 1}. ${step}`]),
          ...(s.tips ?? []).map((t) => [`💡 Tip: ${t}`]),
        ],
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      // @ts-expect-error – lastAutoTable is added by plugin
      y = (doc.lastAutoTable?.finalY ?? y + 20) + 8;
    });
  });

  doc.save(`sentinel-vms-user-guide.pdf`);
}
