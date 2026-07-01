# Approval Waiting Pattern — Design Specification

A reusable UI pattern for any page where a user submits a request and must wait for admin approval before proceeding.

---

## When to Use

- School admin registration pending platform admin approval
- Teacher registration pending school admin approval
- Error escalation pending review
- Access requests, role upgrades, or any gated workflow

---

## Visual Structure

```
┌─────────────────────────────────────────┐
│                                         │
│         ╭───────────────────╮           │
│         │   ◎ (animated)    │           │
│         ╰───────────────────╯           │
│                                         │
│         Title (e.g. "Request Submitted")│
│         Subtitle with org name (bold)   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Status        [Pending Review]  │    │
│  │ Request ID    #123              │    │
│  │ Email         user@example.com  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Hint: "This page will automatically    │
│  update when your request is reviewed." │
│                                         │
└─────────────────────────────────────────┘
```

---

## Components

### 1. Animated Icon (Top)

A pulsing ring around a contextual icon (clock for pending, checkmark for approved, alert for rejected).

```html
<div class="reg-pending-anim">
  <div class="reg-pending-circle">
    <div class="reg-pending-ring"></div>
    <!-- SVG icon inside -->
    <svg>...</svg>
  </div>
</div>
```

**CSS:**
- `.reg-pending-circle`: 72px circle, subtle colored background, centered
- `.reg-pending-ring`: Absolute border spinning via `animation: spin 2s linear infinite`

### 2. Title + Subtitle

```html
<h1 class="reg-title">Registration Submitted</h1>
<p class="reg-sub">
  Your registration is pending approval from<br>
  <strong>Organization Name</strong>
</p>
```

- Title: 18px, font-weight 600
- Subtitle: 12px, var(--text3), line-height 1.5
- Organization name in `<strong>` for emphasis

### 3. Status Card

A dark card with key-value rows showing request metadata.

```html
<div class="reg-status-card">
  <div class="reg-status-row">
    <span>Status</span>
    <span class="reg-badge pending">Pending Review</span>
  </div>
  <div class="reg-status-row">
    <span>Request ID</span>
    <span>#123</span>
  </div>
  <div class="reg-status-row">
    <span>Email</span>
    <span>user@example.com</span>
  </div>
</div>
```

**CSS:**
- `.reg-status-card`: var(--bg1) background, 1px border, rounded 10px, padding 14px 16px
- `.reg-status-row`: flex, space-between, padding 6px 0, font-size 12px
- `.reg-badge.pending`: amber pill (rgba(245,166,35,0.1) background, var(--amber) text)

### 4. Hint Text

```html
<p class="reg-hint">
  This page will automatically update when your request is reviewed.
  You can close this page and check back later.
</p>
```

- 11px, var(--text3), margin-top 16px
- Reassures user they don't need to keep watching

---

## Auto-Polling Behavior

```javascript
function startPolling() {
  pollInterval = setInterval(async () => {
    const res = await fetch(`/api/endpoint/status/${requestId}`);
    const data = await res.json();

    if (data.status === 'approved') {
      step = 'approved';
      clearInterval(pollInterval);
      reRender();
    } else if (data.status === 'rejected') {
      step = 'rejected';
      clearInterval(pollInterval);
      reRender();
    }
  }, 10000); // every 10 seconds
}
```

**Rules:**
- Poll every 10 seconds
- Stop polling immediately on status change
- Re-render the page in-place (no full reload)
- Clear interval on page exit/navigation

---

## State Transitions

### Pending → Approved

```html
<div class="reg-success-anim">
  <svg stroke="var(--green)"><!-- checkmark --></svg>
</div>
<h1 class="reg-title" style="color:var(--green)">Registration Approved!</h1>
<p class="reg-sub">Welcome! Your account has been approved.</p>
<button class="reg-btn">Go to Login</button>
```

- Green checkmark with `scaleIn` animation (scale 0.5→1, opacity 0→1)
- Action button to proceed

### Pending → Rejected

```html
<div class="reg-reject-anim">
  <svg stroke="var(--red)"><!-- alert icon --></svg>
</div>
<h1 class="reg-title" style="color:var(--red)">Registration Not Approved</h1>
<p class="reg-sub">Rejection reason displayed here.</p>
<button class="reg-btn reg-btn-outline">Submit Appeal</button>
```

- Red alert icon
- Display rejection reason
- Offer appeal option (form appears on click)
- Appeal re-triggers polling (back to pending state)

---

## Layout

- Container: `.reg-card-status` — centered, max-width 420px, text-align center
- Outer wrapper: `.reg-page` — full viewport flex centering
- Animation: `fadeUp .4s ease` on initial render

---

## Color Coding

| State    | Color        | Badge Background           |
|----------|-------------|----------------------------|
| Pending  | var(--amber) | rgba(245,166,35,0.1)      |
| Approved | var(--green) | rgba(45,217,138,0.15)     |
| Rejected | var(--red)   | rgba(255,82,99,0.15)      |

---

## Checklist for New Approval Pages

- [ ] Animated icon at top (contextual to the action)
- [ ] Clear title stating what was submitted
- [ ] Subtitle naming the approving authority in bold
- [ ] Status card with 2-4 key-value rows
- [ ] Hint text reassuring about auto-update
- [ ] Auto-poll every 10s
- [ ] Approved state with green animation + action button
- [ ] Rejected state with reason + appeal/retry option
- [ ] Interval cleanup on navigation away
- [ ] Standalone page (no app shell if user isn't authenticated)
