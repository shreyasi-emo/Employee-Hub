# Company Workspace

The office-operations hub and everything that hangs off it. Start at
[`pages/company-workspace-page.tsx`](pages/company-workspace-page.tsx) — that is the
screen the sidebar's **Company Workspace** entry opens, and every other screen in this
folder is reached from it.

One rule for this folder: **a page file is named after its route.** If you know the URL,
you know the filename.

## Screens

| Route | File | What it is |
| --- | --- | --- |
| `/company-workspace` | `pages/company-workspace-page.tsx` | The hub — overview cards, service catalog, nav cards, recent activity |
| `/my-approvals` | `pages/my-approvals-page.tsx` | What is awaiting *your* decision |
| `/workspace/approvals` | `pages/my-approvals-page.tsx` | Same screen in CEO Inbox mode (super-admin acting as CEO) |
| `/my-requests` | `pages/my-requests-page.tsx` | Everything you raised, by type, plus drafts |
| `/team-requests` | `pages/team-requests-page.tsx` | What your reports raised |
| `/requests` | `pages/requests-page.tsx` | Service-request queue for handler roles |
| `/reimbursements` | `reimbursements/pages/reimbursements-page.tsx` | Reimbursement list |
| `/my-approvals/reimbursement/:id` | `reimbursements/pages/reimbursement-review-page.tsx` | Full-page claim review |

## The tree, as you navigate it

```
Company Workspace                    /company-workspace
├── Service Catalog  ─ raise one of four things
│   ├── Purchase Request  ──────────  office-purchases/  +  procurement/
│   ├── Travel Request  ────────────  travel/
│   ├── Support Ticket  ────────────  tickets/
│   └── Reimbursement  ─────────────  reimbursements/
├── My Requests                      /my-requests
├── Team Requests                    /team-requests      (managers)
└── My Approvals                     /my-approvals       (approvers)
    └── CEO Inbox                    /workspace/approvals (super_admin)
```

## Folders

| Folder | Holds |
| --- | --- |
| `pages/` | One file per screen, named for its route |
| `api/` | Shared React Query hooks — `workspace.api.ts` feeds both the hub and My Approvals |
| `components/` | Cross-screen UI: approval cards, activity detail modal, CEO review modal, request cards |
| `shared/` | The `SERVICES` catalog list, role predicates, formatting, drafts |
| `office-purchases/` `procurement/` `travel/` `tickets/` `reimbursements/` | One per request type — its own form, detail view, approval surface and helpers |

## Conventions worth knowing

- **Query keys are literal URLs.** `["/api/office-purchases"]`, not `["officePurchases"]` —
  `lib/queryClient.ts` joins the key to build the request. Cache identity depends on it.
- **The catalog list is data, not markup.** Add or reword a service card in
  [`shared/approval-format.ts`](shared/approval-format.ts) (`SERVICES`), not in the page.
- **Ticket categories live in one place.** [`tickets/lib/ticket-categories.ts`](tickets/lib/ticket-categories.ts).
  They used to be hard-coded per form and drifted; don't reintroduce a local copy.
- **Approval permissions are predicates, not inline role checks.** See
  [`shared/permissions.ts`](shared/permissions.ts).
