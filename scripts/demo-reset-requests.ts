/**
 * Demo data reset — request + approval cards.
 *
 * Wipes every request table and re-seeds the FULL CROSS-PRODUCT of category × stage for every
 * request type, so both the request surfaces (My Requests) and the approval surfaces (My
 * Approvals, CEO Inbox) have a populated card at every step of every workflow.
 *
 * Touches request tables only — employees, users, leave, attendance and holidays are left alone.
 *
 * Run: npx tsx scripts/demo-reset-requests.ts
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import { pool } from "../server/db";
import { storage } from "../server/storage";

const TABLES = [
  "request_comments", "requests",
  "admin_ticket_comments", "admin_tickets",
  "office_purchases", "procurement_requests", "trip_requests", "reimbursements",
  "logistics_requests", "vehicle_bookings",
];

const day = 86400000;
const ago = (n: number) => new Date(Date.now() - n * day);
const ahead = (n: number) => new Date(Date.now() + n * day);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const at = (d: Date, h: number) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; };
// 1x1 transparent PNG — keeps the "document attached" flag true without bloating the row.
const FILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

type Person = { userId: string; empId: string; name: string; code: string; dept: string; role: string };

async function loadPeople(): Promise<Record<string, Person>> {
  const { rows } = await pool.query(`select u.id user_id, u.role, e.id emp_id, e.employee_code code,
      e.first_name, e.last_name, coalesce(d.name, '') dept
    from users u join employees e on e.id = u.employee_id left join departments d on d.id = e.department_id`);
  const by: Record<string, Person> = {};
  for (const r of rows) {
    by[r.code] = { userId: r.user_id, empId: r.emp_id, code: r.code, role: r.role,
      name: `${r.first_name} ${r.last_name}`.trim(), dept: r.dept };
  }
  return by;
}

async function main() {
  const P = await loadPeople();
  const need = (code: string) => {
    const p = P[code];
    if (!p) throw new Error(`No user for employee code ${code} — check the seed data.`);
    return p;
  };

  // Cast
  const hr = need("EMO002");        // Priya Nair — HR Admin (triage / pricing / booking)
  const ceo = need("EMO015");       // Rajesh Khanna — CEO (final approval)
  const fin = need("EMO014");       // Neha Verma — Finance
  const ops = need("EMO013");       // Super Admin (stands in for Logistics)
  const hod = need("EMO003");       // Rahul Gupta — reporting manager
  // Requesters, cycled so cards aren't all from one person.
  const REQ = [need("EMO004"), need("EMO009"), need("EMO008"), need("EMO019"), need("EMO012")];
  let rr = 0;
  const nextRequester = () => REQ[rr++ % REQ.length];

  console.log("Wiping request tables…");
  for (const t of TABLES) {
    const r = await pool.query(`delete from ${t}`);
    console.log(`  ${t}: ${r.rowCount} removed`);
  }

  const ctx = (p: Person) => ({ employeeName: p.name, employeeCode: p.code, department: p.dept });
  const query = (body: string, d: number) => ({
    id: randomUUID(), authorId: ceo.userId, authorName: ceo.name, authorRole: ceo.role,
    body, at: ago(d).toISOString(), kind: "query",
  });
  const resub = (body: string, d: number) => ({
    id: randomUUID(), authorId: hr.userId, authorName: hr.name, authorRole: hr.role,
    body, at: ago(d).toISOString(), kind: "resubmitted",
  });

  /** Per-stage decision trail, shared by office purchases / procurement / travel. */
  const trail = (stage: string, opts: { hrPrices?: boolean } = {}) => {
    const t: any = {};
    const reviewed = { reviewedById: hr.userId, reviewedAt: ago(3) };
    switch (stage) {
      case "pending_hr": return { ...t, createdAt: ago(1), updatedAt: ago(1) };
      case "priced": return { ...t, ...reviewed, createdAt: ago(4), updatedAt: ago(2) };
      case "pending_approval":
        return { ...t, ...(opts.hrPrices ? reviewed : {}), createdAt: ago(5), updatedAt: ago(2) };
      case "under_review":
        return { ...t, ...(opts.hrPrices ? reviewed : {}), createdAt: ago(8), updatedAt: ago(3) };
      case "approved":
        return { ...t, ...(opts.hrPrices ? reviewed : {}), approvedById: ceo.userId, decidedAt: ago(4),
          decisionNote: "Approved.", createdAt: ago(9), updatedAt: ago(4) };
      case "ordered":
        return { ...t, ...reviewed, approvedById: ceo.userId, decidedAt: ago(10), decisionNote: "Approved.",
          orderPlacedById: hr.userId, orderPlacedAt: ago(8), createdAt: ago(14), updatedAt: ago(8) };
      case "delivered":
        return { ...t, ...reviewed, approvedById: ceo.userId, decidedAt: ago(24), decisionNote: "Approved.",
          orderPlacedById: hr.userId, orderPlacedAt: ago(22), deliveredById: hr.userId, deliveredAt: ago(17),
          createdAt: ago(28), updatedAt: ago(17) };
      case "booked":
        return { ...t, ...reviewed, approvedById: ceo.userId, decidedAt: ago(8), decisionNote: "Approved.",
          bookedById: hr.userId, bookedAt: ago(7), createdAt: ago(12), updatedAt: ago(7) };
      case "rejected":
        return { ...t, ...(opts.hrPrices ? reviewed : {}), approvedById: ceo.userId, decidedAt: ago(14),
          decisionNote: "Not this quarter — revisit after the new budget opens.",
          createdAt: ago(19), updatedAt: ago(14) };
      case "cancelled": return { ...t, createdAt: ago(15), updatedAt: ago(13) };
      default: return t;
    }
  };

  // ══════════════════════════════════════════════════ Office purchases — 2 types × 9 stages + resubmit
  console.log("\nOffice purchases (online + vendor × every stage)…");
  const OP_STAGES = ["pending_hr", "priced", "pending_approval", "under_review", "approved", "ordered", "delivered", "rejected", "cancelled"];
  const OP_GOODS: Record<string, { items: any[]; why: string }[]> = {
    online: [
      { items: [{ description: "Mechanical keyboard — Keychron K2", quantity: 1, unitPrice: 9800, finalLink: "https://www.amazon.in/dp/B07C9J4TVK", suggestedLinks: [] }], why: "Current keyboard is failing." },
      { items: [{ description: "USB-C dock, 7-port", quantity: 2, unitPrice: 6400, finalLink: "https://www.amazon.in/dp/B08KHK9QW1", suggestedLinks: [] }], why: "Dual-monitor setup for the new bench." },
      { items: [{ description: "Noise-cancelling headset", quantity: 3, unitPrice: 12500, finalLink: "https://www.amazon.in/dp/B0863TXGM3", suggestedLinks: [] }], why: "Support calls in the open-plan area." },
      { items: [{ description: "Wacom Intuos Pro (medium)", quantity: 1, unitPrice: 32000, finalLink: "https://www.amazon.in/dp/B07QRTZ2GQ", suggestedLinks: [] }, { description: "Colour-calibration probe", quantity: 1, unitPrice: 18500, finalLink: "", suggestedLinks: [] }], why: "Calibrated pen display for print proofing." },
      { items: [{ description: "Lapel mic kit", quantity: 2, unitPrice: 7200, finalLink: "https://www.amazon.in/dp/B07Q3D7ZTX", suggestedLinks: [] }], why: "Field demo recordings for the sales deck." },
      { items: [{ description: "Anti-static mats", quantity: 4, unitPrice: 3400, finalLink: "", suggestedLinks: [] }, { description: "ESD wrist straps", quantity: 6, unitPrice: 450, finalLink: "", suggestedLinks: [] }], why: "ESD safety for the assembly bench." },
      { items: [{ description: "Standing desk, electric", quantity: 1, unitPrice: 28000, finalLink: "https://www.amazon.in/dp/B08KHK9QW1", suggestedLinks: [] }], why: "Ergonomic request from the team." },
      { items: [{ description: "Second 4K reference monitor", quantity: 1, unitPrice: 89000, finalLink: "", suggestedLinks: [] }], why: "Side-by-side proofing." },
      { items: [{ description: "Portable projector for the sales kit", quantity: 1, unitPrice: 41000, finalLink: "", suggestedLinks: [] }], why: "Client-site presentations." },
    ],
    vendor: [
      { items: [{ description: "Torque wrench set, calibrated", quantity: 1, unitPrice: 46000, suggestedLinks: [] }], why: "Assembly line needs a calibrated set." },
      { items: [{ description: "Workbench, ESD-safe, 6ft", quantity: 2, unitPrice: 38000, suggestedLinks: [] }], why: "Second build station." },
      { items: [{ description: "Industrial shelving, 8 bays", quantity: 1, unitPrice: 62000, suggestedLinks: [] }], why: "Stores overflow in Plant 1." },
      { items: [{ description: "Fume extraction arm", quantity: 2, unitPrice: 54000, suggestedLinks: [] }], why: "Soldering stations need local extraction." },
      { items: [{ description: "Pallet trolley, 2T", quantity: 1, unitPrice: 27500, suggestedLinks: [] }], why: "Moving cell crates by hand is unsafe." },
      { items: [{ description: "Tool cabinet, 7-drawer", quantity: 3, unitPrice: 31000, suggestedLinks: [] }], why: "Per-bench tool control." },
      { items: [{ description: "Safety cage for the test chamber", quantity: 1, unitPrice: 88000, suggestedLinks: [] }], why: "Abuse testing enclosure." },
      { items: [{ description: "Bespoke demo plinth, machined", quantity: 2, unitPrice: 78000, suggestedLinks: [] }], why: "Expo stand centrepiece." },
      { items: [{ description: "Office partition panels", quantity: 6, unitPrice: 14500, suggestedLinks: [] }], why: "Splitting the shared room." },
    ],
  };
  const PRIORITY = ["high", "medium", "low"];
  let opN = 0;
  for (const purchaseType of ["online", "vendor"] as const) {
    for (let i = 0; i < OP_STAGES.length; i++) {
      const status = OP_STAGES[i];
      const g = OP_GOODS[purchaseType][i];
      const who = nextRequester();
      const unpriced = status === "pending_hr" || status === "cancelled";
      const items = unpriced
        ? g.items.map(({ unitPrice, finalLink, ...rest }: any) => rest)
        : g.items;
      const created = await storage.createOfficePurchase({
        requesterId: who.userId, ...ctx(who), items,
        totalAmount: String(items.reduce((s: number, it: any) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0)),
        justification: g.why, purchaseType, priority: PRIORITY[i % 3], status,
        ...(purchaseType === "vendor" ? { vendorName: "Precision Tools & Supplies" } : {}),
        ...(purchaseType === "vendor" && ["approved", "ordered", "delivered"].includes(status)
          ? { paymentStatus: status === "approved" ? "pending" : "paid",
              ...(status !== "approved" ? { paidById: fin.userId, paidAt: ago(9), paymentRef: "NEFT/2026/44182" } : {}),
              proformaInvoice: { fileName: "proforma.png", fileType: "image/png", fileData: FILE } }
          : {}),
        ...(status === "ordered" ? { orderInfo: "Amazon Business · order 404-3391182-7745", expectedDeliveryDate: ymd(ahead(2)) } : {}),
        ...(status === "delivered" ? { orderInfo: "Vendor courier · AWB 7719004412", invoice: { fileName: "invoice.png", fileType: "image/png", fileData: FILE } } : {}),
        ...(status === "under_review" ? { comments: [query("Can we start with one unit and review after a month?", 3)] } : {}),
        ...trail(status, { hrPrices: true }),
      });
      console.log(`  ${created.reference}  ${purchaseType.padEnd(6)} ${status}`);
      opN++;
    }
  }
  // The resend loop: HR answered the CEO's query, so it's back in the CEO's queue with a marker.
  {
    const who = nextRequester();
    const created = await storage.createOfficePurchase({
      requesterId: who.userId, ...ctx(who), purchaseType: "online", priority: "medium",
      items: [{ description: "Standing desk, electric", quantity: 1, unitPrice: 28000, finalLink: "https://www.amazon.in/dp/B08KHK9QW1", suggestedLinks: [] }],
      totalAmount: "28000", justification: "Trimmed to a single unit as discussed.", status: "pending_approval",
      comments: [query("Three units at once — can we start with one?", 4), resub("Reduced to one desk and resent for approval.", 1)],
      ...trail("pending_approval", { hrPrices: true }), updatedAt: ago(1),
    });
    console.log(`  ${created.reference}  online resubmitted → CEO`);
    opN++;
  }

  // ══════════════════════════════════════════════════ Procurement — 3 categories × 5 stages
  console.log("\nProcurement (amazon + vendor + other × every stage)…");
  const PRQ_STAGES = ["pending_approval", "under_review", "approved", "rejected", "cancelled"];
  const PRQ_GOODS: Record<string, any[][]> = {
    amazon: [
      [{ description: "Oscilloscope, 200MHz 4-channel", quantity: 1, unitPrice: 148000, link: "https://www.amazon.in/dp/B07XYZ1234" }],
      [{ description: "Thermal imaging camera", quantity: 1, unitPrice: 96000, link: "https://www.amazon.in/dp/B08THERM01" }],
      [{ description: "Server-grade NAS, 8-bay", quantity: 1, unitPrice: 210000, link: "https://www.amazon.in/dp/B08NAS8BAY" }],
      [{ description: "Conference room LED wall", quantity: 1, unitPrice: 920000, link: "https://www.amazon.in/dp/B08LEDWALL" }],
      [{ description: "Demo fleet tablet mounts", quantity: 12, unitPrice: 2600, link: "https://www.amazon.in/dp/B08MOUNT12" }],
    ],
    vendor: [
      [{ description: "Battery cell test chamber, 40L", quantity: 1, unitPrice: 385000, link: "https://vendor.example/chamber-40l" }],
      [{ description: "CNC bench mill", quantity: 1, unitPrice: 640000, link: "https://vendor.example/bench-mill" }],
      [{ description: "Laser marking station", quantity: 1, unitPrice: 470000, link: "https://vendor.example/laser-mark" }],
      [{ description: "Climate chamber, walk-in", quantity: 1, unitPrice: 2450000, link: "https://vendor.example/walk-in" }],
      [{ description: "Hydraulic press, 30T", quantity: 1, unitPrice: 520000, link: "https://vendor.example/press-30t" }],
    ],
    other: [
      [{ description: "Annual CAD licence renewal (10 seats)", quantity: 10, unitPrice: 46000, link: "https://vendor.example/cad-seats" }],
      [{ description: "Compliance lab retainer, 12 months", quantity: 1, unitPrice: 360000, link: "https://vendor.example/lab-retainer" }],
      [{ description: "ISO 9001 certification audit", quantity: 1, unitPrice: 275000, link: "https://vendor.example/iso-audit" }],
      [{ description: "Office fit-out — phase 2", quantity: 1, unitPrice: 1850000, link: "https://vendor.example/fitout-2" }],
      [{ description: "Fleet telematics subscription", quantity: 25, unitPrice: 8400, link: "https://vendor.example/telematics" }],
    ],
  };
  const PRQ_WHY = ["Thermal cycling is outsourced at ₹60k/month today.", "In-house prototyping to cut the 3-week machining turnaround.",
    "Signal work on the CAN bus rig.", "Better all-hands experience.", "Superseded by the new dash unit."];
  let prqN = 0;
  for (const category of ["amazon", "vendor", "other"] as const) {
    for (let i = 0; i < PRQ_STAGES.length; i++) {
      const status = PRQ_STAGES[i];
      const items = PRQ_GOODS[category][i];
      const who = nextRequester();
      const created = await storage.createProcurementRequest({
        requesterId: who.userId, ...ctx(who), category, items,
        totalAmount: String(items.reduce((s: number, it: any) => s + it.unitPrice * it.quantity, 0)),
        justification: PRQ_WHY[i], status,
        ...(status === "under_review" ? { comments: [query("Have we compared this against a job-work contract for a year?", 4)] } : {}),
        ...trail(status),
      });
      console.log(`  ${created.reference}  ${category.padEnd(7)} ${status}`);
      prqN++;
    }
  }

  // ══════════════════════════════════════════════════ Travel — 3 categories × 7 stages
  console.log("\nTravel (flight + stay + transport × every stage)…");
  const TRV_STAGES = ["pending_hr", "pending_approval", "under_review", "approved", "booked", "rejected", "cancelled"];
  const ROUTES = [["Bengaluru", "Pune"], ["Bengaluru", "Delhi"], ["Bengaluru", "Chennai"],
                  ["Bengaluru", "Mumbai"], ["Bengaluru", "Hyderabad"], ["Bengaluru", "Kochi"], ["Bengaluru", "Hosur"]];
  const PURPOSE = ["Customer pitch", "Supplier audit", "On-site commissioning", "Statutory filing visit",
                   "Design conference", "Partner review", "Site inspection"];
  const trvDetails = (category: string, i: number, s: Date, e: Date) => {
    const [from, to] = ROUTES[i];
    if (category === "flight") return { tripType: "round-trip", fromCity: from, toCity: to, departDate: ymd(s), returnDate: ymd(e) };
    if (category === "stay") return { city: to, checkIn: ymd(s), checkOut: ymd(e) };
    return { from, to, dateTime: `${ymd(s)}T08:30` };
  };
  const trvHr = (category: string) => {
    if (category === "flight") return { airline: "IndiGo", flightNo: "6E-2043", departTime: "07:20", arrivalTime: "10:05", class: "Economy" };
    if (category === "stay") return { hotel: "Taj Club House", bookingRef: "TJ-449021", ratePerNight: 9500, nights: 4 };
    return { operator: "KSRTC Airavat", pnr: "KA-77120", timing: "08:30 dep · 11:45 arr" };
  };
  const TRV_AMT: Record<string, number> = { flight: 42800, stay: 38000, transport: 6400 };
  let trvN = 0;
  for (const category of ["flight", "stay", "transport"] as const) {
    for (let i = 0; i < TRV_STAGES.length; i++) {
      const status = TRV_STAGES[i];
      const who = nextRequester();
      const past = ["rejected", "cancelled"].includes(status);
      const s = past ? ago(6 + i) : ahead(3 + i);
      const e = past ? ago(2 + i) : ahead(5 + i);
      const priced = !["pending_hr", "cancelled"].includes(status);
      const created = await storage.createTripRequest({
        requesterId: who.userId, ...ctx(who), category, status,
        purpose: `${PURPOSE[i]} — ${ROUTES[i][1]}`,
        details: trvDetails(category, i, s, e),
        startDate: ymd(s), endDate: ymd(category === "transport" ? s : e),
        attendees: [{ userId: who.userId, name: who.name }],
        ...(priced ? { amount: String(TRV_AMT[category]), hrDetails: trvHr(category) } : {}),
        ...(status === "booked" ? { document: { fileName: "eticket.png", fileType: "image/png", fileData: FILE } } : {}),
        ...(status === "under_review" ? { comments: [query("This is above policy — is there a cheaper option closer to the site?", 2)] } : {}),
        ...trail(status, { hrPrices: true }),
      });
      console.log(`  ${created.reference}  ${category.padEnd(9)} ${status}`);
      trvN++;
    }
  }

  // ══════════════════════════════════════════════════ Reimbursements — 6 stages × single + mixed
  console.log("\nReimbursements (each nature + mixed × every stage)…");
  const RMB_STAGES = ["submitted", "finance_approved", "approved", "changes_requested", "rejected", "cancelled"];
  const NATURE = ["Local Conveyance", "Professional Services", "Lodging", "Office Supplies", "Software & Subscriptions", "Meals & Entertainment"];
  const RMB_DESC = ["Airport cab, both ways", "Calibration service — torque tools", "Supplier audit travel — hotel",
                    "Printing and binding", "Design asset subscription", "Client dinner"];
  const RMB_PURPOSE = ["Customer meetings in Pune", "Annual calibration for the assembly bench", "Cell vendor audit, Delhi",
                       "Statutory audit documentation", "Stock illustration library", "Customer entertainment"];
  const line = (no: string, d: Date, description: string, nature: string, amount: number) => ({
    invoiceNo: no, invoiceDate: ymd(d), description, nature, amount,
    fileName: `${no}.png`, fileType: "image/png", fileData: FILE,
  });
  const rmbTrail = (status: string) => {
    const f = { financeApprovedById: fin.userId, financeNote: "Invoice and GST verified.", financeDecisionAt: ago(3) };
    switch (status) {
      case "submitted": return { createdAt: ago(2), updatedAt: ago(2) };
      case "finance_approved": return { ...f, createdAt: ago(13), updatedAt: ago(3) };
      case "approved": return { ...f, financeDecisionAt: ago(20), approvedById: ceo.userId,
        decisionNote: "Approved for payout.", createdAt: ago(26), updatedAt: ago(18) };
      case "changes_requested": return { financeApprovedById: fin.userId, financeDecisionAt: ago(2),
        decisionNote: "The invoice is illegible — please re-upload a clear copy.", createdAt: ago(10), updatedAt: ago(2) };
      case "rejected": return { financeApprovedById: fin.userId, financeDecisionAt: ago(25),
        financeNote: "Not reimbursable under policy.", decisionNote: "Not reimbursable under policy.",
        createdAt: ago(32), updatedAt: ago(25) };
      default: return { createdAt: ago(21), updatedAt: ago(19) };
    }
  };
  let rmbN = 0;
  for (const mixed of [false, true]) {
    for (let i = 0; i < RMB_STAGES.length; i++) {
      const status = RMB_STAGES[i];
      const who = nextRequester();
      const lines = mixed
        ? [line(`INV-9${i}101`, ago(8 + i), RMB_DESC[i], NATURE[i], 4820 + i * 900),
           line(`INV-9${i}102`, ago(7 + i), RMB_DESC[(i + 1) % 6], NATURE[(i + 1) % 6], 1340 + i * 400),
           line(`INV-9${i}103`, ago(6 + i), RMB_DESC[(i + 2) % 6], NATURE[(i + 2) % 6], 2610 + i * 250)]
        : [line(`INV-8${i}200`, ago(9 + i), RMB_DESC[i], NATURE[i], 6400 + i * 1800)];
      const created = await storage.createReimbursement({
        requesterId: who.userId, ...ctx(who), hodName: hod.name, lines, status,
        totalAmount: (Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100).toFixed(2),
        category: mixed ? "Mixed" : NATURE[i],
        businessPurpose: RMB_PURPOSE[i], description: RMB_PURPOSE[i],
        periodFrom: lines[0].invoiceDate, periodTo: lines[lines.length - 1].invoiceDate,
        ...rmbTrail(status),
      });
      console.log(`  ${created.reference}  ${(mixed ? "mixed" : "single").padEnd(6)} ${status}`);
      rmbN++;
    }
  }

  // ══════════════════════════════════════════════════ Tickets — 3 categories × 4 stages
  console.log("\nTickets (it + facilities + admin × every stage)…");
  const TK_STAGES = ["open", "in_progress", "resolved", "closed"];
  const TK: Record<string, { s: string; d: string }[]> = {
    it: [{ s: "Laptop won't wake from sleep", d: "Needs a hard reboot two or three times a day." },
         { s: "VPN drops every few minutes", d: "Disconnects during remote bench sessions." },
         { s: "Shared drive permissions missing", d: "Can't open the design archive folder." },
         { s: "Email signature not applying", d: "Outlook keeps reverting to the old template." }],
    facilities: [{ s: "AC in the Finance bay is not cooling", d: "Warm by mid-afternoon; vents blowing but not cold." },
         { s: "Ceiling light flickering, bay 3", d: "Started after the weekend power cut." },
         { s: "Water dispenser leaking", d: "Puddle forming near the pantry entrance." },
         { s: "Broken chair at desk 14", d: "Gas lift has failed; seat won't hold height." }],
    admin: [{ s: "Access card not working at the side gate", d: "Main entrance reads fine; side gate does not." },
         { s: "Visitor parking pass for Thursday", d: "Two customer vehicles expected." },
         { s: "Courier pickup not collected", d: "Package has been at reception since Monday." },
         { s: "Name plate for the new desk", d: "Moved to the second floor last week." }],
  };
  const TK_PRIORITY = ["high", "medium", "medium", "low"];
  let tkN = 0;
  for (const category of ["it", "facilities", "admin"] as const) {
    for (let i = 0; i < TK_STAGES.length; i++) {
      const status = TK_STAGES[i];
      const who = nextRequester();
      const t = TK[category][i];
      await storage.createAdminTicket({
        requesterId: who.userId, category, subject: t.s, description: t.d,
        priority: TK_PRIORITY[i], status,
        ...(status !== "open" ? { assignedTo: hr.userId } : {}),
        ...(["resolved", "closed"].includes(status) ? { resolvedAt: ago(status === "closed" ? 12 : 3) } : {}),
        createdAt: ago([1, 4, 9, 18][i]), updatedAt: ago([1, 2, 3, 11][i]),
      });
      console.log(`  ${category.padEnd(11)} ${status.padEnd(12)} ${t.s.slice(0, 40)}`);
      tkN++;
    }
  }

  // ══════════════════════════════════════════════════ Team-routed requests — 4 teams × 4 stages
  console.log("\nTeam-routed requests (per team × every stage)…");
  const RQ_STAGES = ["submitted", "in_review", "fulfilled", "rejected"];
  const TEAMS = ["Hardware", "Electrical", "Mechanical", "Design"];
  const RQ_TITLE: Record<string, string[]> = {
    Hardware: ["Spare connector set for the test harness", "Replacement probe tips", "Breakout board, 40-pin", "Custom cable loom, 12-way"],
    Electrical: ["Bench power supply, 30V 5A", "Insulated screwdriver set", "Current clamp, 100A", "Isolation transformer"],
    Mechanical: ["Machined bracket, 4-off", "Bearing puller kit", "Sheet metal offcuts for jigs", "Custom demo stand, machined"],
    Design: ["Export the brand kit to the shared drive", "Print proofs for the expo banner", "Icon set for the new dash", "3D render of the pack assembly"],
  };
  let rqN = 0;
  for (const team of TEAMS) {
    for (let i = 0; i < RQ_STAGES.length; i++) {
      const status = RQ_STAGES[i];
      const who = nextRequester();
      const created = await storage.createRequest({
        requesterId: who.userId, type: i === 3 ? "purchase" : (team === "Design" ? "support" : "purchase"),
        routeToTeam: team, title: RQ_TITLE[team][i],
        description: `Raised by ${who.name} for the ${team.toLowerCase()} team.`,
        quantity: [5, 1, 2, 1][i], estimatedCost: String([4200, 14500, 8600, 78000][i]),
        neededByDate: ymd(ahead(7 + i)), priority: ["normal", "normal", "high", "low"][i], status,
        ...(status !== "submitted" ? { assignedToId: status === "in_review" ? hr.userId : ops.userId } : {}),
        ...(status === "fulfilled" ? { resolutionNote: "Sourced from existing lab stock — issued." } : {}),
        ...(status === "rejected" ? { resolutionNote: "Queue is full this quarter — use the standard part." } : {}),
        createdAt: ago([1, 5, 16, 20][i]), updatedAt: ago([1, 2, 6, 12][i]),
      });
      console.log(`  ${created.reference}  ${team.padEnd(11)} ${status}`);
      rqN++;
    }
  }

  // ══════════════════════════════════════════════════ Logistics — 2 types × 4 stages
  console.log("\nLogistics requests (inboard + outboard × every stage)…");
  const LG_STAGES = ["pending", "in_progress", "completed", "cancelled"];
  const LG: Record<string, { from: string; to: string; cat: string; d: string; q: number; kg: string }[]> = {
    outboard: [
      { from: "Bengaluru — Plant 1", to: "Pune — Customer site", cat: "Battery packs", d: "Four demo packs for the customer trial.", q: 4, kg: "62.500" },
      { from: "Bengaluru — Plant 1", to: "Coimbatore — Service partner", cat: "Spares", d: "Warranty replacement modules.", q: 8, kg: "44.000" },
      { from: "Bengaluru — HQ", to: "Mysuru — Regional office", cat: "Documents", d: "Statutory filing box.", q: 1, kg: "6.200" },
      { from: "Bengaluru — HQ", to: "Hyderabad — Expo hall", cat: "Marketing collateral", d: "Expo stand kit — event postponed.", q: 2, kg: "24.000" },
    ],
    inboard: [
      { from: "Chennai — Cell vendor", to: "Bengaluru — Plant 1", cat: "Cells", d: "Cell tranche for the validation build.", q: 12, kg: "180.000" },
      { from: "Pune — Supplier", to: "Bengaluru — Plant 1", cat: "Enclosures", d: "Pressed enclosures, first article.", q: 20, kg: "95.000" },
      { from: "Delhi — Lab", to: "Bengaluru — Plant 1", cat: "Test reports", d: "Signed compliance reports returned.", q: 1, kg: "2.000" },
      { from: "Kochi — Vendor", to: "Bengaluru — HQ", cat: "Samples", d: "Material samples — order cancelled.", q: 3, kg: "11.500" },
    ],
  };
  let lgN = 0;
  for (const requestType of ["outboard", "inboard"] as const) {
    for (let i = 0; i < LG_STAGES.length; i++) {
      const status = LG_STAGES[i];
      const who = nextRequester();
      const x = LG[requestType][i];
      const past = ["completed", "cancelled"].includes(status);
      const created = await storage.createLogisticsRequest({
        requesterId: who.userId, requestType,
        fromLocationText: x.from, toLocationText: x.to,
        pickupDate: ymd(past ? ago(9 - i) : ahead(2 - i)), deliveryDate: ymd(past ? ago(7 - i) : ahead(4 - i)),
        pocName: ["Rohit Desai", "Latha Raman", "Suresh Kumar", "Meera Rao"][i],
        pocPhone: ["+91 98450 11223", "+91 98410 55667", "+91 99000 77441", "+91 90000 32100"][i],
        quantity: x.q, weightKg: x.kg, goodsCategory: x.cat, description: x.d,
        priority: i === 0 ? "urgent" : "regular", status,
        ...(status !== "pending" ? { processedById: ops.userId } : {}),
        ...(status === "completed" ? { completedById: ops.userId, completedAt: ago(7),
          proof: { fileName: "pod.png", fileType: "image/png", fileData: FILE } } : {}),
        ...(status === "cancelled" ? { cancelledById: who.userId, decisionNote: "Event moved to next quarter." } : {}),
        createdAt: ago([1, 4, 12, 10][i]), updatedAt: ago([1, 1, 7, 6][i]),
      });
      console.log(`  ${created.reference}  ${requestType.padEnd(9)} ${status}`);
      lgN++;
    }
  }

  // ══════════════════════════════════════════════════ Vehicles — 2 types × 4 stages
  console.log("\nVehicle bookings (company_car + rental × every stage)…");
  const veh = (await pool.query(`select id, name from company_vehicles where status = 'active' order by name`)).rows;
  let vbN = 0;
  if (!veh.length) {
    console.log("  (no active company vehicle configured — skipped)");
  } else {
    const VB_STAGES = ["pending_hr_approval", "confirmed", "rejected", "cancelled"];
    const TRIPS = [["HQ, Bengaluru", "Hosur plant", "inter_city"], ["HQ, Bengaluru", "MG Road", "intra_city"],
                   ["HQ, Bengaluru", "Nandi Hills", "inter_city"], ["HQ, Bengaluru", "Whitefield", "intra_city"]];
    const VB_PURPOSE = ["Customer site visit", "Bank and statutory filings", "Offsite shoot — equipment run", "Vendor meeting"];
    for (const bookingType of ["company_car", "rental"] as const) {
      for (let i = 0; i < VB_STAGES.length; i++) {
        const status = VB_STAGES[i];
        // A company car is never "pending HR" (it confirms instantly); a rental is never auto-confirmed.
        if (bookingType === "company_car" && status === "pending_hr_approval") continue;
        const who = nextRequester();
        const [pick, drop, tripType] = TRIPS[i];
        const future = ["pending_hr_approval", "confirmed"].includes(status);
        const d = future ? ahead(1 + i) : ago(2 + i);
        const start = at(d, 9), end = at(d, tripType === "inter_city" ? 18 : 13);
        await storage.createVehicleBooking({
          vehicleId: veh[i % veh.length].id, requesterId: who.userId, bookingType, status,
          purpose: `${VB_PURPOSE[i]} — ${drop}`, startTime: start, endTime: end, tripType,
          ...(bookingType === "company_car" ? { blockStart: start, blockEnd: end } : { groupId: randomUUID() }),
          pickupLocation: pick, dropLocation: drop, passengers: [6, 2, 3, 1][i],
          attendees: [{ userId: who.userId, name: who.name }],
          ...(status === "rejected" ? { approvedById: hr.userId, decisionNote: "Company car was free that day — use it instead." } : {}),
          createdAt: ago([1, 2, 8, 5][i]),
        });
        console.log(`  ${bookingType.padEnd(12)} ${status}`);
        vbN++;
      }
    }
  }

  // ══════════════════════════════════════════════════ Super Admin's OWN requests
  // The demo is driven from the super_admin account, so it needs to be the requester on a full
  // sweep of stages too — otherwise My Requests is empty for the person presenting.
  console.log("\nSuper Admin's own requests (one per stage, every type)…");
  const me = need("EMO013");
  const mine = { requesterId: me.userId, ...ctx(me) };
  let meN = 0;

  for (let i = 0; i < OP_STAGES.length; i++) {
    const status = OP_STAGES[i];
    const g = OP_GOODS.online[i];
    const unpriced = status === "pending_hr" || status === "cancelled";
    const items = unpriced ? g.items.map(({ unitPrice, finalLink, ...r }: any) => r) : g.items;
    const created = await storage.createOfficePurchase({
      ...mine, items, purchaseType: "online", priority: PRIORITY[i % 3], status,
      totalAmount: String(items.reduce((s: number, it: any) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0)),
      justification: g.why,
      ...(status === "ordered" ? { orderInfo: "Amazon Business · order 404-8871220-3391", expectedDeliveryDate: ymd(ahead(3)) } : {}),
      ...(status === "delivered" ? { invoice: { fileName: "invoice.png", fileType: "image/png", fileData: FILE } } : {}),
      ...(status === "under_review" ? { comments: [query("Is this the best price we can get?", 2)] } : {}),
      ...trail(status, { hrPrices: true }),
    });
    console.log(`  ${created.reference}  purchase    ${status}`);
    meN++;
  }
  for (let i = 0; i < PRQ_STAGES.length; i++) {
    const status = PRQ_STAGES[i];
    const items = PRQ_GOODS.vendor[i];
    const created = await storage.createProcurementRequest({
      ...mine, category: "vendor", items, status, justification: PRQ_WHY[i],
      totalAmount: String(items.reduce((s: number, it: any) => s + it.unitPrice * it.quantity, 0)),
      ...(status === "under_review" ? { comments: [query("Can we phase this across two quarters?", 3)] } : {}),
      ...trail(status),
    });
    console.log(`  ${created.reference}  procurement ${status}`);
    meN++;
  }
  for (let i = 0; i < TRV_STAGES.length; i++) {
    const status = TRV_STAGES[i];
    const category = (["flight", "stay", "transport"] as const)[i % 3];
    const past = ["rejected", "cancelled"].includes(status);
    const s = past ? ago(6 + i) : ahead(3 + i);
    const e = past ? ago(2 + i) : ahead(5 + i);
    const priced = !["pending_hr", "cancelled"].includes(status);
    const created = await storage.createTripRequest({
      ...mine, category, status, purpose: `${PURPOSE[i]} — ${ROUTES[i][1]}`,
      details: trvDetails(category, i, s, e),
      startDate: ymd(s), endDate: ymd(category === "transport" ? s : e),
      attendees: [{ userId: me.userId, name: me.name }],
      ...(priced ? { amount: String(TRV_AMT[category]), hrDetails: trvHr(category) } : {}),
      ...(status === "booked" ? { document: { fileName: "eticket.png", fileType: "image/png", fileData: FILE } } : {}),
      ...(status === "under_review" ? { comments: [query("Can this be a day trip instead?", 2)] } : {}),
      ...trail(status, { hrPrices: true }),
    });
    console.log(`  ${created.reference}  travel/${category.padEnd(9)} ${status}`);
    meN++;
  }
  for (let i = 0; i < RMB_STAGES.length; i++) {
    const status = RMB_STAGES[i];
    const lines = [line(`INV-7${i}300`, ago(9 + i), RMB_DESC[i], NATURE[i], 5200 + i * 1500)];
    const created = await storage.createReimbursement({
      ...mine, hodName: hod.name, lines, status, category: NATURE[i],
      totalAmount: lines[0].amount.toFixed(2),
      businessPurpose: RMB_PURPOSE[i], description: RMB_PURPOSE[i],
      periodFrom: lines[0].invoiceDate, periodTo: lines[0].invoiceDate,
      ...rmbTrail(status),
    });
    console.log(`  ${created.reference}  reimb       ${status}`);
    meN++;
  }
  for (let i = 0; i < TK_STAGES.length; i++) {
    const status = TK_STAGES[i];
    const t = TK.it[i];
    await storage.createAdminTicket({
      requesterId: me.userId, category: "it", subject: t.s, description: t.d,
      priority: TK_PRIORITY[i], status,
      ...(status !== "open" ? { assignedTo: hr.userId } : {}),
      ...(["resolved", "closed"].includes(status) ? { resolvedAt: ago(status === "closed" ? 12 : 3) } : {}),
      createdAt: ago([1, 4, 9, 18][i]), updatedAt: ago([1, 2, 3, 11][i]),
    });
    console.log(`  ticket      ${status}`);
    meN++;
  }
  for (let i = 0; i < RQ_STAGES.length; i++) {
    const status = RQ_STAGES[i];
    const created = await storage.createRequest({
      requesterId: me.userId, type: "purchase", routeToTeam: TEAMS[i], title: RQ_TITLE[TEAMS[i]][i],
      description: `Raised by ${me.name} for the ${TEAMS[i].toLowerCase()} team.`,
      quantity: [5, 1, 2, 1][i], estimatedCost: String([4200, 14500, 8600, 78000][i]),
      neededByDate: ymd(ahead(7 + i)), priority: ["normal", "normal", "high", "low"][i], status,
      ...(status !== "submitted" ? { assignedToId: hr.userId } : {}),
      ...(status === "fulfilled" ? { resolutionNote: "Issued from lab stock." } : {}),
      ...(status === "rejected" ? { resolutionNote: "Queue is full this quarter." } : {}),
      createdAt: ago([1, 5, 16, 20][i]), updatedAt: ago([1, 2, 6, 12][i]),
    });
    console.log(`  ${created.reference}  team req    ${status}`);
    meN++;
  }
  for (let i = 0; i < LG_STAGES.length; i++) {
    const status = LG_STAGES[i];
    const x = LG.outboard[i];
    const past = ["completed", "cancelled"].includes(status);
    const created = await storage.createLogisticsRequest({
      requesterId: me.userId, requestType: "outboard",
      fromLocationText: x.from, toLocationText: x.to,
      pickupDate: ymd(past ? ago(9 - i) : ahead(2 - i)), deliveryDate: ymd(past ? ago(7 - i) : ahead(4 - i)),
      pocName: "Rohit Desai", pocPhone: "+91 98450 11223",
      quantity: x.q, weightKg: x.kg, goodsCategory: x.cat, description: x.d,
      priority: i === 0 ? "urgent" : "regular", status,
      ...(status !== "pending" ? { processedById: ops.userId } : {}),
      ...(status === "completed" ? { completedById: ops.userId, completedAt: ago(7),
        proof: { fileName: "pod.png", fileType: "image/png", fileData: FILE } } : {}),
      ...(status === "cancelled" ? { cancelledById: me.userId, decisionNote: "No longer required." } : {}),
      createdAt: ago([1, 4, 12, 10][i]), updatedAt: ago([1, 1, 7, 6][i]),
    });
    console.log(`  ${created.reference}  logistics   ${status}`);
    meN++;
  }
  if (veh.length) {
    // Company-car slots are conflict-checked in storage, so keep these well clear of the
    // cross-product bookings above (and of each other) and don't let one clash kill the run.
    for (const [i, status] of ["pending_hr_approval", "confirmed", "cancelled"].entries()) {
      const d = status === "cancelled" ? ago(30) : ahead(20 + i * 3);
      const start = at(d, 9), end = at(d, 13);
      try {
        await storage.createVehicleBooking({
          vehicleId: veh[veh.length - 1].id, requesterId: me.userId,
          bookingType: status === "pending_hr_approval" ? "rental" : "company_car", status,
          purpose: ["Board meeting — offsite", "Investor visit pickup", "Site review — cancelled"][i],
          startTime: start, endTime: end, tripType: "intra_city",
          ...(status !== "pending_hr_approval" ? { blockStart: start, blockEnd: end } : { groupId: randomUUID() }),
          pickupLocation: "HQ, Bengaluru", dropLocation: ["Taj West End", "Airport", "Plant 1"][i],
          passengers: [4, 2, 1][i], attendees: [{ userId: me.userId, name: me.name }],
          createdAt: ago([1, 2, 4][i]),
        });
        console.log(`  vehicle     ${status}`);
        meN++;
      } catch (e: any) { console.log(`  vehicle     ${status} — skipped (${e.message})`); }
    }
  }

  // ══════════════════════════════════════════════════ Summary
  console.log(`\nSeeded: ${opN} office purchases · ${prqN} procurement · ${trvN} travel · ${rmbN} reimbursements · ${tkN} tickets · ${rqN} team requests · ${lgN} logistics · ${vbN} vehicle bookings`);
  console.log(`        + ${meN} owned by Super Admin (${me.name}) across every type and stage`);
  console.log("\n--- final counts by stage ---");
  for (const t of ["office_purchases", "procurement_requests", "trip_requests", "reimbursements",
                   "admin_tickets", "requests", "logistics_requests", "vehicle_bookings"]) {
    const r = await pool.query(`select status, count(*)::int n from ${t} group by status order by status`);
    console.log(`${t.padEnd(22)} ${r.rows.reduce((s: number, a: any) => s + a.n, 0)} :: ` +
      r.rows.map((a: any) => `${a.status}=${a.n}`).join(" "));
  }
  console.log("\n--- approval queues (what the approvers will see) ---");
  const q = async (label: string, sql: string) =>
    console.log(`  ${label.padEnd(34)} ${(await pool.query(sql)).rows[0].n}`);
  await q("CEO Inbox · office purchases", `select count(*)::int n from office_purchases where status='pending_approval'`);
  await q("CEO Inbox · procurement", `select count(*)::int n from procurement_requests where status='pending_approval'`);
  await q("CEO Inbox · travel", `select count(*)::int n from trip_requests where status='pending_approval'`);
  await q("CEO Inbox · reimbursements", `select count(*)::int n from reimbursements where status='finance_approved'`);
  await q("Finance · reimbursements to review", `select count(*)::int n from reimbursements where status='submitted'`);
  await q("Finance · vendor payments pending", `select count(*)::int n from office_purchases where payment_status='pending'`);
  await q("HR · purchases to price", `select count(*)::int n from office_purchases where status='pending_hr'`);
  await q("HR · travel to price", `select count(*)::int n from trip_requests where status='pending_hr'`);
  await q("HR · travel to book", `select count(*)::int n from trip_requests where status='approved'`);
  await q("HR · rentals to approve", `select count(*)::int n from vehicle_bookings where status='pending_hr_approval'`);
  await pool.end();
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
