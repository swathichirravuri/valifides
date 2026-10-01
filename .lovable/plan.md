
# MindVault: Working Decision Governance Prototype

## Overview
Add interactive state management across pages using React Context, a new "Decision Gateway" simulator page, and live cross-page audit log updates -- all while keeping the existing UI and styling intact.

## Architecture

A shared `GovernanceContext` (React Context + Provider) will hold global state for:
- Audit log entries (starting with existing seed data)
- Consent statuses per platform
- A helper to push new audit entries

This lets the Consent page, Decision Gateway, and Audit page all read/write from the same state.

## Implementation Steps

### Step 1: Create Shared Governance Context
**New file: `src/context/GovernanceContext.tsx`**

- Store an array of audit log entries (seeded with the existing 6 entries from AuditPage)
- Store a map of consent statuses by platform ID
- Expose `addAuditEntry(entry)` and `updateConsent(platformId, status)` functions
- Wrap the app in this provider in `App.tsx`

### Step 2: Add "Decision Gateway" Nav Item
**Edit: `src/components/AppSidebar.tsx`**

- Add a 5th nav item: "Decision Gateway" pointing to `/gateway` with a `Zap` icon

### Step 3: Create Decision Gateway Simulator Page
**New file: `src/pages/GatewayPage.tsx`**

Interactive form with:
- **Decision Type** dropdown: Loan Approval, Dynamic Pricing, Hiring Screening
- **Consent Status** dropdown: Granted, Conditional, Revoked
- **Risk Level** dropdown: Low, Medium, High, Critical
- **"Run Decision" button** that applies governance rules:
  - Consent = Revoked --> **Blocked**
  - Consent = Granted/Conditional + Risk = Low/Medium --> **Approved**
  - Risk = High/Critical --> **Pending Review**
  - Special rule: Decision Type in (Eligibility/Pricing) AND Risk = Critical --> **Pending Review -- Human Oversight Required**
- On execution, display a result card showing:
  - Auto-generated Decision ID (e.g., `DEC-XXX`)
  - Timestamp
  - Outcome badge (color-coded)
  - "Audit Entry Created" confirmation message
- Each run pushes a new entry into the shared audit log via context

### Step 4: Make Consent Controls Interactive
**Edit: `src/pages/ConsentPage.tsx`**

- Read/write consent status from GovernanceContext instead of local `revoked` state
- On "Confirm Revocation": update context consent to "Revoked", push audit entry "Consent Revoked"
- Show a success banner: "Consent successfully revoked"
- Add a "Restore Consent" button (visible when revoked) that sets status back to "Granted" and logs a "Consent Restored" audit entry
- Disable tier/purpose/retention controls when revoked (already partially done)

### Step 5: Live Audit Log Updates
**Edit: `src/pages/AuditPage.tsx`**

- Read audit entries from GovernanceContext instead of static array
- New entries from Gateway or Consent actions appear at the top automatically
- Export JSON/CSV buttons export the live context data
- All existing UI (regulator toggle, evidence locker, readiness score) stays unchanged

### Step 6: Add Route
**Edit: `src/App.tsx`**

- Import `GatewayPage`
- Add route: `<Route path="/gateway" element={<GatewayPage />} />`
- Wrap routes with `GovernanceProvider`

## Technical Details

- **No new dependencies** -- uses only React Context and existing UI components
- **State resets on refresh** -- this is a prototype, not persisted
- Decision IDs use a simple counter: `DEC-007`, `DEC-008`, etc.
- Timestamps use `date-fns` `format()` (already installed)
- Governance rule engine is a simple if/else chain in the Gateway page
