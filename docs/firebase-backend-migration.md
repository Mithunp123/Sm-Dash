# Firebase Backend Migration Plan

This document captures the approach to migrate the existing SQLite + Express backend to Firebase
services (Firestore, Cloud Storage, Firebase Authentication, Cloud Functions).

## Target Architecture

1. **Firebase Authentication**  
   - Replace custom JWT-based auth (with SQLite users table) by Firebase Auth email/password +
     custom claims for roles.  
   - Admin provisioning uses the Admin SDK (`firebase-admin`) in Cloud Functions to assign role
     claims, enforce password resets, etc.

2. **Firestore (Document Database)**  
   - Stores all entities currently in SQLite:
     - `users`, `profiles`, `student_profiles`, `office_bearer_profiles`
     - meetings, attendance, attendance_records, events, event_od, event_members, event_attendance
     - projects, project_members, bills, bill_items
     - permissions, permission_requests, profile_field_settings, role_profile_field_settings
     - time_allotments, time_requests
     - alumni, volunteers, volunteer_submissions
     - resources, resource_folders
     - teams, team_members, team_assignments, team_assignment_tracking, team_requests
     - feedback_questions, feedback_responses, admin_messages

3. **Cloud Storage**  
   - Replace the `public/uploads` tree with `gs://<project>-app-uploads/*`.
   - Signed URLs (or Firebase Storage security rules) gate access per role.

4. **Cloud Functions for Firebase** (Node.js 22)  
   - Wrap the Express app under `functions/index.js`:

     ```js
     import * as functions from 'firebase-functions/v2/https';
     import app from './src/app.js';

     export const api = functions.onRequest({ region: 'asia-south1', cors: true }, app);
     ```

   - Break out standalone scheduled/event-driven functions for:
     - Periodic maintenance (cleanup temp uploads, expire permissions, etc.)
     - Data migrations / nightly summaries (if needed)

## High-Level Tasks

1. **Create Firebase project & enable services**
   - Hosting, Firestore (native mode), Cloud Storage, Functions, Authentication (email+password + Google).

2. **Add Firebase configuration files**
   - `firebase.json`, `.firebaserc` (already added placeholders).
   - `functions/package.json` for backend runtime.

3. **Refactor backend into `functions/src`**
   - Move `/backend` Express server into `functions/src`.
   - Convert `import sqlite3` + custom DB helpers into Firestore Data Access Layer.
   - Replace `.env` secrets with Firebase environment config (`firebase functions:config:set`), using
     `process.env` for local emulator support.

4. **Data Model Mapping**
   - Users:
     - Firestore collection `users` mirrors metadata not stored in Firebase Auth (role, permissions, etc.).
     - Use Firebase Auth UID as document ID.
     - Profiles stored under subcollection `profiles` or a shared `profiles` collection referencing UID.
   - Meetings/Projects/Events:
     - Collections: `meetings`, `projects`, `events`.
     - Attendance stored as subcollections for better querying (`meetings/{id}/attendance/{uid}`).
   - Permissions:
     - Collection `permissions` keyed by UID; supports role-level fallbacks.
   - Resources / uploads:
     - Metadata doc referencing Storage path; signed download URLs delivered via backend.

5. **Storage Migration**
   - Write Node script (`scripts/migrate-uploads-to-storage.js`) that walks `backend/public/uploads`,
     uploads each file to Cloud Storage, stores metadata (download tokens) in Firestore.

6. **Database Migration Pipeline**
   - Build a script `scripts/migrate-sqlite-to-firestore.js`:
     - Read from SQLite using current models.
     - Batch write to Firestore with concurrency controls (500 writes / batch).
   - Run once before cutover; keep script for disaster recovery.

7. **Local Development / Emulator Suite**
   - Configure `firebase.json` emulators (Firestore, Auth, Storage, Functions, Hosting).
   - Provide `firebase emulators:start --inspect-functions` workflow for devs.

8. **CI/CD**
   - Add GitHub Actions (or other) to run tests + `npm run build` + `firebase deploy --only hosting,functions`.

## Open Questions / Inputs Needed

1. Firebase Project ID / region preference.
2. Role/permission scheme confirmation (any future additions?).
3. File retention policy & size expectations (impacts Storage tiering).
4. External integrations (SMTP via Nodemailer, Google OAuth) – replace with Firebase Extensions or continue via environment secrets.

## Next Steps

1. Get Firebase project ID and set it in `.firebaserc`.
2. Scaffold `functions` directory with:
   - `package.json` (firebase-admin, firebase-functions, express, multer, etc.)
   - `src/app.js` (existing Express app but using Firestore).
   - `src/config/firebase.js` (admin initialization).
3. Implement Firestore data access layer module-by-module, starting with:
   - Auth (users, permissions).
   - Meetings + attendance (critical paths).
4. Once rewritten, run local emulators, update frontend API base URL to `/api`.
5. Deploy via `firebase deploy --only functions,hosting`.

This document should be updated as design decisions are finalized during implementation.

