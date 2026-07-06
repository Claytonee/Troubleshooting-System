# OE Branding Guide

## Overview

All standalone pages (pages outside the main app shell) use Opportunity Education branding instead of generic "QF" text placeholders.

## Branding Elements

### 1. OE Sunburst Icon (Header)

The gold sunburst icon appears at the top of every standalone page card.

```html
<div class="oe-icon" style="margin:0 auto 10px">
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 30 30" fill="#ffae00">
    <path d="M24.33,10c-.54-1.27.49-3,1.84-4.71A14.81,14.81,0,0,1,29.76,12C27.32,11.83,24.94,11.43,24.33,10ZM13.21,5.57c1.47-.63,1.93-2.75,2.1-5h-.68A14.79,14.79,0,0,0,7.28,2.91C9.27,4.65,11.5,6.3,13.21,5.57ZM24.59,3.84A14.81,14.81,0,0,0,17.27.7c.23,2.15.8,4.14,2.42,4.79S23,5.16,24.59,3.84ZM24.41,16.5c-.78,2,1.69,4.33,3.74,6.39a14.79,14.79,0,0,0,2-8.12c0-.2,0-.39,0-.58C27.59,14.4,25.07,14.86,24.41,16.5Zm-15.65.19c-.55-2-8-1.77-8.32-1.68,0,.36,0,.72,0,1.08A14.79,14.79,0,0,0,3.59,24.6C5.35,22.59,9.31,18.7,8.76,16.69Zm-.08-6.48c.71-1.76-1.16-4.08-3-6.1a14.87,14.87,0,0,0-4.91,8.2C3.8,12.17,7.83,12.34,8.68,10.21Zm11.2,10.94c-2.19.94-1.68,7.26-1.59,8.85a14.83,14.83,0,0,0,8.32-4.93C24.4,23,21.78,20.33,19.88,21.14Zm-6.48.08c-2.8-1-7.6,4.91-7.94,5.36a14.81,14.81,0,0,0,9.76,3.72C15.25,29.12,16.2,22.21,13.4,21.22Z"/>
  </svg>
</div>
```

**CSS:**
```css
.oe-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 2. Animated Ring (Waiting/Pending States Only)

Only pages that represent a waiting/pending state get the spinning ring around the OE icon.

```html
<div class="reg-pending-anim">
  <div class="reg-pending-circle">
    <div class="reg-pending-ring"></div>
    <!-- OE icon SVG here -->
  </div>
</div>
```

**CSS:**
```css
.reg-pending-circle {
  width: 72px;
  height: 72px;
  margin: 0 auto;
  background: rgba(245,166,35,0.06);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.reg-pending-ring {
  position: absolute;
  inset: -4px;
  border: 2px solid var(--amber);
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 2s linear infinite;
}
```

**Rule:** Animated ring = something is actively being processed/waited on. No ring = static informational page.

| Page | Animated Ring? |
|------|---------------|
| Login | No |
| Register form | No |
| Pending approval (waiting) | Yes |
| Approved (success) | No |
| Rejected | No |
| Appeal form | No |

### 3. OE Footer Logo (Horizontal)

The full "Opportunity Education" horizontal logo appears at the bottom of every standalone page card.

```html
<div class="oe-footer-logo">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 31" width="160" height="17">
    <!-- Icon portion (gold) -->
    <path d="M24.33,10c-.54-1.27..." fill="#ffae00"/>
    <!-- Text portion (white for dark bg) -->
    <path d="M37.84,14.59..." fill="#fff"/>
    <!-- ... remaining letter paths ... -->
  </svg>
</div>
```

**CSS:**
```css
.oe-footer-logo {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
  opacity: 0.7;
}
```

## Page Structure Template (Standalone)

Every standalone page follows this structure:

```html
<div class="login-container" id="page-id">
  <div class="login-box"> <!-- or .reg-card -->

    <!-- 1. OE Icon (top center) -->
    <div class="oe-icon" style="margin:0 auto 16px">
      <!-- sunburst SVG -->
    </div>

    <!-- 2. Title + subtitle -->
    <div class="login-title">Page Title</div>
    <div class="login-sub">Subtitle text</div>

    <!-- 3. Content (form, status card, etc.) -->
    ...

    <!-- 4. Footer logo (always last) -->
    <div class="oe-footer-logo">
      <!-- horizontal logo SVG -->
    </div>

  </div>
</div>
```

## School Dropdown Positioning

The school selection dropdown uses smart positioning with a preference for appearing to the **right side** of the form card:

1. **Side (preferred):** If there is 290px+ space to the right of the card, dropdown appears beside the form (`drop-side` class)
2. **Below (fallback):** If not enough right space but enough below, dropdown appears below the field (default)
3. **Above (last resort):** If neither side nor below has space, dropdown opens upward (`drop-up` class)

```javascript
// Positioning logic
const card = document.querySelector('.reg-card');
const cardRect = card.getBoundingClientRect();
const spaceRight = window.innerWidth - cardRect.right;

if (spaceRight > 290) {
  dd.classList.add('drop-side');  // Preferred: right side
} else {
  // Fall back to below or up
}
```

**CSS for side positioning:**
```css
.reg-dropdown.drop-side {
  top: -60px;
  left: calc(100% + 12px);
  right: auto;
  width: 280px;
  bottom: auto;
}
```

## Color Reference

| Element | Color | Hex |
|---------|-------|-----|
| OE Icon fill | Gold | `#ffae00` |
| Logo text (dark bg) | White | `#ffffff` |
| Pending ring | Amber | `var(--amber)` / `#f5a623` |
| Icon background (pending) | Amber 6% | `rgba(245,166,35,0.06)` |

## Files

| File | What |
|------|------|
| `frontend/index.html` | Login page with OE branding |
| `frontend/js/pages/register.js` | Register form + all status pages with OE branding |
| `frontend/css/components.css` | `.oe-icon`, `.oe-footer-logo`, `.reg-pending-*` styles |
