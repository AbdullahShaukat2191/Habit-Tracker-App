# Invoice Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invoice receipt overflowing the viewport when many sessions are selected, by paginating line items 4-per-page with a fixed receipt height, a centered page-number control, and a CSS-only sliding transition between pages.

**Architecture:** All changes live inside `src/components/timer/InvoiceModal.tsx` — no new files, no new dependencies. Two small local subcomponents (`LineItem`, `PaginationControl`) are added to that same file. Fixed receipt height across pages is achieved without any DOM measurement: every page's line-item slice is padded to exactly 4 rows with `visibility: hidden` placeholder rows built from the same `LineItem` component, so every page has identical natural content height by construction. The slide is a single CSS `transition: transform` on a flex track holding all pages side by side — changing `page` state changes the `translateX` percentage, and the browser animates it.

**Tech Stack:** React 18 (existing `useState`), inline styles (existing convention in this file — no CSS modules/Tailwind used here), `lucide-react` (already a dependency — adds `ChevronLeft`/`ChevronRight` to the existing `X` import).

**Spec:** the user's message requesting this feature (invoice pagination: fixed page size of 4, centered pagination control with a sliding 3-button window, CSS-only carousel transition, and a totals-block "Page X/Y" label with rebalanced spacing).

## Global Constraints

- Page size is fixed at 4 line items per page.
- Receipt height must not change between pages of the same invoice — achieved via placeholder padding, not by growing/shrinking any container.
- With 4 or fewer sessions, the receipt's line-item area renders exactly as it does today (same markup, no wrapper, no pagination control).
- The "Page X/Y" label in the totals block always renders, even as "Page 1/1", regardless of session count — this is different from the pagination control itself, which only renders when there is more than one page.
- Total Hours / Total / Hourly Rate remain grand totals across *all* selected sessions, computed the same way as today (unchanged) — pagination never affects these.
- Transition: CSS `transform`/`transition` only, no animation library, ~175-225ms, ease-out.
- No new dependencies. `lucide-react` is already imported in this file (`X`) — reuse it for chevrons.
- Do not change receipt width, background, fonts, separators (hairlines/double-rule), or the zigzag tear.
- Do not touch the Sessions tab, bulk action bar, session rows, currency formatter, or any store/query. Only `src/components/timer/InvoiceModal.tsx` is in scope.

---

### Task 1: Pagination mechanics — state, slicing, fixed-height carousel, pagination control (Parts 1-3)

**Files:**
- Modify: `src/components/timer/InvoiceModal.tsx`

**Interfaces:**
- Consumes: existing `InvoiceModalProps` (`sessions: TimerSession[]`, `currency: string | undefined`, `onClose: () => void`) — unchanged. Existing `formatCurrency` from `@/lib/currency`, `TimerSession` from `@shared/types`.
- Produces (for Task 2 to consume): a `PAGE_SIZE` module constant (`4`), and within the component body, `currentPage: number` and `totalPages: number` variables that Task 2's totals-block label reads. Task 2 must use these exact names.

- [ ] **Step 1: Add the `PAGE_SIZE` constant and the `ChevronLeft`/`ChevronRight` import**

At the top of the file, change:

```ts
import { X } from 'lucide-react'
```

to:

```ts
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
```

Add alongside the other module constants (after `CORNER_CHAMFER`):

```ts
const PAGE_SIZE = 4
```

- [ ] **Step 2: Add the sliding page-window helper**

Add this pure function near `buildZigzagClipPath` (module scope, above the component):

```ts
// The 3-button window always starts at `current` (1 2 3 on page 1, 2 3 4 on
// page 2, ...), except near the end where it clamps so the final window
// always shows the last three pages instead of running past `total`.
function getPageWindow(current: number, total: number): number[] {
  const size = Math.min(3, total)
  let start = current
  if (start + size - 1 > total) start = total - size + 1
  start = Math.max(1, start)
  return Array.from({ length: size }, (_, i) => start + i)
}
```

- [ ] **Step 3: Extract the line-item row into a `LineItem` subcomponent**

This is the existing per-session row JSX (currently inline inside `sessions.map(...)`), pulled out so it can be reused both for real rows and for invisible height-matching placeholder rows on a partial last page. Add above the `InvoiceModal` component:

```tsx
interface LineItemProps {
  session: TimerSession
  currency: string | undefined
  showRate: boolean
  hidden?: boolean
}

function LineItem({ session, currency, showRate, hidden }: LineItemProps) {
  const amount = (session.totalElapsed / 3600000) * session.rateSnapshot
  return (
    <div
      aria-hidden={hidden || undefined}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
        marginBottom: 10, visibility: hidden ? 'hidden' : 'visible',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
        {session.name || 'Unnamed Session'}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: MONO_FONT, fontSize: 14, fontWeight: 600 }}>
          {formatCurrency(currency, amount)}
        </div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: RECEIPT_MUTED, marginTop: 2 }}>
          {formatElapsed(session.totalElapsed)}
        </div>
        {showRate && (
          <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: RECEIPT_MUTED, marginTop: 2 }}>
            {formatCurrency(currency, session.rateSnapshot)}/hr
          </div>
        )}
      </div>
    </div>
  )
}
```

Note: `showRate` replaces the old inline `uniformRate === null` check — the caller passes that boolean in.

- [ ] **Step 4: Add the `PaginationControl` subcomponent**

Add above `InvoiceModal`, below `LineItem`:

```tsx
interface PaginationControlProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

function PaginationControl({ page, totalPages, onChange }: PaginationControlProps) {
  const pageWindow = getPageWindow(page, totalPages)
  const plainButtonStyle: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 6, border: `1px solid ${RECEIPT_HAIRLINE}`,
    backgroundColor: '#ffffff', color: RECEIPT_TEXT, fontSize: 12, fontFamily: MONO_FONT,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  }
  const activeButtonStyle: React.CSSProperties = {
    ...plainButtonStyle, backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#ffffff', fontWeight: 700,
  }
  const disabledChevronStyle: React.CSSProperties = {
    ...plainButtonStyle, color: RECEIPT_MUTED, opacity: 0.4, cursor: 'default',
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, margin: '12px 0' }}>
      <button
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        style={page === 1 ? disabledChevronStyle : plainButtonStyle}
      >
        <ChevronLeft size={14} />
      </button>
      {pageWindow.map((p) => (
        <button
          key={p}
          aria-label={`Page ${p}`}
          aria-current={p === page || undefined}
          onClick={() => onChange(p)}
          style={p === page ? activeButtonStyle : plainButtonStyle}
        >
          {p}
        </button>
      ))}
      <button
        aria-label="Next page"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        style={page === totalPages ? disabledChevronStyle : plainButtonStyle}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Add `page` state and derived pagination values in `InvoiceModal`**

Inside the component, alongside the existing `const [boxHeight, setBoxHeight] = useState(0)`, add:

```ts
const [page, setPage] = useState(1)
```

After the existing `uniformRate` derivation, add:

```ts
const isPaginated = sessions.length > PAGE_SIZE
const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE))
const currentPage = Math.min(page, totalPages)
```

(`currentPage` clamps defensively; in normal use `page` never exceeds `totalPages` since the control never lets you navigate past it.)

- [ ] **Step 6: Replace the line-items block with the conditional simple/paginated render**

Replace this existing block:

```tsx
          <div style={{ margin: '12px 0' }}>
            {sessions.map((session) => {
              const amount = (session.totalElapsed / 3600000) * session.rateSnapshot
              return (
                <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                    {session.name || 'Unnamed Session'}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: MONO_FONT, fontSize: 14, fontWeight: 600 }}>
                      {formatCurrency(currency, amount)}
                    </div>
                    <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: RECEIPT_MUTED, marginTop: 2 }}>
                      {formatElapsed(session.totalElapsed)}
                    </div>
                    {uniformRate === null && (
                      <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: RECEIPT_MUTED, marginTop: 2 }}>
                        {formatCurrency(currency, session.rateSnapshot)}/hr
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
```

with:

```tsx
          {isPaginated && (
            <PaginationControl page={currentPage} totalPages={totalPages} onChange={setPage} />
          )}

          {isPaginated ? (
            <div style={{ overflow: 'hidden', margin: '12px 0' }}>
              <div
                style={{
                  display: 'flex',
                  transform: `translateX(-${(currentPage - 1) * 100}%)`,
                  transition: 'transform 200ms ease-out',
                }}
              >
                {Array.from({ length: totalPages }, (_, pageIndex) => {
                  const start = pageIndex * PAGE_SIZE
                  const pageSessions = sessions.slice(start, start + PAGE_SIZE)
                  const placeholderCount = PAGE_SIZE - pageSessions.length
                  return (
                    <div key={pageIndex} style={{ flex: '0 0 100%', minWidth: '100%' }}>
                      {pageSessions.map((session) => (
                        <LineItem key={session.id} session={session} currency={currency} showRate={uniformRate === null} />
                      ))}
                      {Array.from({ length: placeholderCount }, (_, i) => (
                        <LineItem
                          key={`placeholder-${i}`}
                          session={pageSessions[0] ?? sessions[0]}
                          currency={currency}
                          showRate={uniformRate === null}
                          hidden
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ margin: '12px 0' }}>
              {sessions.map((session) => (
                <LineItem key={session.id} session={session} currency={currency} showRate={uniformRate === null} />
              ))}
            </div>
          )}
```

The `isPaginated` false branch is byte-for-byte the same rendered output as today's markup (same `LineItem` internals as the extracted Step 3 component, same wrapping div/margin) — this is what keeps the ≤4-session case pixel-identical to current behavior.

The `placeholderCount` is only ever nonzero on the last page (page size is fixed, only the final page can be short), and `pageSessions[0]` is always defined whenever `placeholderCount > 0` (a page only exists if it has at least one real session) — the `?? sessions[0]` is a defensive fallback for the type checker, not a reachable runtime path.

- [ ] **Step 7: Verify**

Run, in order, and confirm all four are clean:
```bash
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.electron.json
npx jest
npx next build
```
Expected: both `tsc` runs clean, `jest` still 57/57 (this task adds no new tests — there is no existing test coverage for `InvoiceModal.tsx` or any other Timer UI component; verification is via `tsc`/`next build` plus manual/code-level reasoning, consistent with how prior Timer UI tasks in this codebase were verified), `next build` succeeds.

Manually trace (visually if the real packaged app is not running at the time, otherwise via careful reading of the diff — check `tasklist //FI "IMAGENAME eq Habit Tracker.exe"` first and skip live interaction if it's running, per this codebase's established practice):
- Selecting ≤4 sessions renders identically to before (no pagination control, no extra wrapper div).
- Selecting 5 sessions: page 1 shows 4 real rows, page 2 shows 1 real row + 3 hidden placeholder rows, and the two pages' rendered heights are visually identical.
- Selecting enough sessions for 5+ pages: page-number window is `1 2 3` on page 1, slides to `2 3 4`, `3 4 5`, etc., and clamps to show the final three pages once you'd otherwise run past the last page.
- Left chevron is disabled/inert on page 1; right chevron is disabled/inert on the last page.
- Clicking a page number or chevron slides the line-item area; content never spills outside the receipt's rounded/chamfered edges.

- [ ] **Step 8: Commit**

```bash
git add src/components/timer/InvoiceModal.tsx
git commit -m "$(cat <<'EOF'
Add invoice pagination: fixed 4-item pages with sliding carousel

The invoice receipt overflowed the viewport when many sessions were
selected. Line items are now paginated at 4 per page. Every page is
padded to exactly 4 rows with hidden placeholder rows (built from the
same LineItem markup as real rows), so the receipt's height never
changes between pages -- no DOM measurement needed, just equal content
height by construction. A centered pagination control (chevrons + a
sliding 3-button page-number window) sits below the date rule; paging
slides the line-item area via a single CSS transform transition.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GKsemBTw3XayprnVtsoLoG
EOF
)"
```

---

### Task 2: Totals block — Page X/Y label and spacing rebalance (Part 4)

**Files:**
- Modify: `src/components/timer/InvoiceModal.tsx`

**Interfaces:**
- Consumes: `currentPage` and `totalPages` from Task 1 (same names, already in scope in the component body — no prop plumbing needed since this edit lives in the same function).

- [ ] **Step 1: Add the "Page X/Y" label to the Total row and rebalance spacing**

Replace this existing block:

```tsx
          <div style={{ borderTop: `3px double ${RECEIPT_TEXT}`, margin: '12px 0' }} />

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 16, fontWeight: 700, marginRight: 8 }}>Total:</span>
            <span style={{ fontFamily: MONO_FONT, fontSize: 22, fontWeight: 800 }}>{formatCurrency(currency, totalAmount)}</span>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: RECEIPT_MUTED, letterSpacing: '4px' }}>
            Thank You
          </div>
```

with:

```tsx
          <div style={{ borderTop: `3px double ${RECEIPT_TEXT}`, margin: '12px 0 16px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: RECEIPT_MUTED }}>
              Page {currentPage}/{totalPages}
            </span>
            <span>
              <span style={{ fontSize: 16, fontWeight: 700, marginRight: 8 }}>Total:</span>
              <span style={{ fontFamily: MONO_FONT, fontSize: 22, fontWeight: 800 }}>{formatCurrency(currency, totalAmount)}</span>
            </span>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: RECEIPT_MUTED, letterSpacing: '4px' }}>
            Thank You
          </div>
```

This does two things: (a) adds the always-present "Page X/Y" label — reads "Page 1/1" for a ≤4-session, non-paginated invoice, since Task 1 defines `totalPages` as `Math.max(1, ...)` unconditionally; (b) rebalances the double-rule-to-Thank-You gap from an asymmetric 12px-above / 24px-below the Total row to a symmetric 16px/16px, so the Total row sits optically centered in that space instead of hugging the rule above it.

- [ ] **Step 2: Verify**

Run the same four checks as Task 1's Step 7; all must stay clean.

Manually trace: the Total/Total Hours/Hourly Rate figures are unchanged (still computed from the full `sessions` array — Task 1 never touched those `useMemo`s); the Page X/Y label sits flush left on the Total row while the Total figure stays flush right; with a single-page invoice it reads "Page 1/1"; the whitespace above and below the Total row (rule-to-Total vs Total-to-"Thank You") is now visually equal.

- [ ] **Step 3: Commit**

```bash
git add src/components/timer/InvoiceModal.tsx
git commit -m "$(cat <<'EOF'
Add Page X/Y label to invoice totals row, rebalance spacing

The Total row now shows a muted "Page X/Y" label flush left against
the still-right-aligned Total figure (reads "Page 1/1" for a
single-page invoice). Also equalized the whitespace above and below
the Total row, between the double rule and "Thank You", which
previously sat asymmetric (12px above vs 24px below) so the row read
as sitting above center.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GKsemBTw3XayprnVtsoLoG
EOF
)"
```

---

## Final verification (after Task 2)

- [ ] Run `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest`, `npx next build` once more on the fully assembled diff.
- [ ] Full manual walkthrough of the invoice modal (skip live-app interaction if the real packaged app is running; rely on code-level reasoning instead, per established practice) across: 1 session, exactly 4, exactly 5, and a large selection (10+) to exercise multi-page window clamping.
- [ ] Confirm `git status` is clean and `git log` shows one commit per task.
