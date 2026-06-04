# SIMVA Firestore Security Specification

This document details the data security invariants, defensive validation schemas, and threat vectors secured within the active vehicle monitoring application.

## 1. Data Invariants

1. **User Ownership**: All driver records, vehicle specifications (`CarProfile`), maintenance plans, and logs MUST reside in isolated paths indexed strictly by the authentic account ID (`request.auth.uid`).
2. **Read Restrictiveness**: Broad list scraping is prohibited. Data is restricted strictly to the resource owner.
3. **Data Type & Size Bounds**: Odometer parameters, calendar intervals, and textual names must remain bounded to prevent resource depletion (Denial of Wallet).
4. **No Identity Spoofing**: Users cannot create user documents for arbitrary UIDs or claim emails that do not match their verified credentials.

## 2. The "Dirty Dozen" Threat Payloads

The following attack payloads bypass client-side validation but are strictly neutralized by the security rule engine:

1. **The Ghost Field Insertion**: Trying to write unchecked administrative attributes (e.g. `isAdmin: true` or `verifiedMode: true`) during profile creation.
2. **Foreign Device Hijack**: Attempting to post or edit a car profile under another user's `userId`.
3. **Negative Distance Calibrator**: Injecting negative odometer logs (`currentKm: -999999`) to corrupt analytics.
4. **Resource Exhaustion Payload**: Injecting 500KB of random string data under `makeModel` to inflate hosting storage fees.
5. **Future Year Insertion**: Calibrating a vehicle year of `2500` to trigger math errors.
6. **Task Forgery Injection**: Attempting to inject random unapproved maintenance intervals with missing fields.
7. **System Identifier Spoofing**: Submitting document IDs with toxic formatting, path traversal separators, or massive strings.
8. **PII Blanket Scraper**: Trying to batch-index user emails of other drivers without proper owner boundaries.
9. **Status Hijack Attack**: Attempting to bypass the standard vehicle record and flag state properties without proper validation.
10. **Immutable Timestamp Rewrite**: Overwriting original registration dates with historical temporal values.
11. **Orphaned Registration**: Creating a car log referencing a parent account that is not created yet or belongs to another driver.
12. **Anonymous Privilege Escalation**: Read or write operations requested by unauthenticated users.

## 3. Security Rules Verification Test Spec

All security assertions will be enforced via the complete `firestore.rules` compiler file, rejecting any invalid, hijacked, or poisoned payloads with `PERMISSION_DENIED` errors.
