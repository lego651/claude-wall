# TICKET-014: Settings Page - Subscription Management

Section on the user settings page to manage which firms the user **follows** for the weekly digest (one aggregated email per week).

## Implemented

- **Component:** `components/SubscriptionSettings.js`
  - Fetches `GET /api/subscriptions` on mount.
  - **List of followed firms:** Firm logo, name, "Following since [date]", Unfollow button per row.
  - **Empty state:** "You're not following any firms yet. You'll get one weekly digest with all firms you follow." + link to `/propfirms` ("Browse firms").
  - **Unfollow all:** Button at bottom; confirm dialog before unfollowing all.

- **Placement:** Added to `/settings` page (between Wallet and Security sections). Settings page is auth-protected, so the section only renders for logged-in users.

## How to test

1. Sign in, go to `/settings`.
2. If you follow no firms: see empty state and "Browse firms" link to `/propfirms`.
3. Follow one or more firms from a firm detail page (`/propfirm/[id]`), then return to `/settings`: see them listed with logo, name, followed date, and Unfollow.
4. Click Unfollow on one firm: row disappears.
5. Click "Unfollow all": confirm dialog → all rows removed and empty state shown.

**Dependencies:** TICKET-012 (Subscription API).
