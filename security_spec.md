# LIFE OS — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Single-Tenant Ownership**: Every document lives under `/users/{userId}` or a direct subcollection `/users/{userId}/{subcollection}/{docId}`. No user may read, list, create, update, or delete another user's documents.
2. **Verified Identity**: All authenticated read/write operations require `request.auth != null && request.auth.uid == userId && request.auth.token.email_verified == true`.
3. **Integer Minor Units**: Financial amounts (`amountPiasters`, `paidAmountPiasters`, `limitPiasters`, `targetPiasters`, `currentPiasters`, `purchasePricePiasters`, `currentValuationPiasters`, `feesPiasters`) must be non-negative bounded numbers (`>= 0` and `<= 1000000000000`).
4. **Immutable Ownership & Timestamps**: `userId` and `createdAt` cannot change after creation; `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **Bounded Strings & Arrays**: Every string field has an explicit `.size()` upper bound matching `firebase-blueprint.json`; `milestones` array on `goals` is strictly bounded to `<= 20` items.
6. **Zero Shadow Fields**: Create operations validate `hasAll` and `hasOnly`; update operations validate `affectedKeys().hasOnly(...)` combined with `isValid[Entity]()`.
7. **Path ID Hardening**: All single-document operations validate `isValidId(docId)` (`^[a-zA-Z0-9_\-]+$`, `<= 128` chars).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-User Read**: User B attempts `get /users/userA/expense_records/exp1`.
2. **Cross-User List**: User B attempts `list /users/userA/income_records`.
3. **Unverified Email Write**: User A with `email_verified: false` attempts to create `/users/userA/expense_records/exp1`.
4. **Identity Spoofing**: User A creates `/users/userA/expense_records/exp1` with `userId: "userB"`.
5. **Shadow Field Injection**: User A adds `isAdmin: true` to `/users/userA` or `isVerified: true` to an expense record.
6. **Negative Amount Poisoning**: User A submits `amountPiasters: -50000` on an expense record.
7. **Resource Exhaustion / 1MB String**: User A submits a 50,000-character `description` string on a task.
8. **ID Poisoning**: User A writes to `/users/userA/tasks/invalid$id!with*badchars`.
9. **Immutable Field Tampering**: User A updates `createdAt` or `userId` on an existing expense record.
10. **Forged Client Timestamp**: User A creates a document with a backdated `createdAt` instead of `serverTimestamp()` (`request.time`).
11. **Unbounded Array Injection**: User A writes a `goals` document with 25 items in `milestones` (limit 20).
12. **PII Leak Attempt**: Unauthenticated or non-owner user attempts to read `/users/userA` containing `email`.
