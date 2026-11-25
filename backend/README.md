# Smart Associate backend

## Initial administrator

The first active administrator must be provisioned before starting a new database. Set these environment variables in the backend deployment environment:

- `SMART_ASSOCIATE_BOOTSTRAP_ADMIN_ID` — initial administrator User ID.
- `SMART_ASSOCIATE_BOOTSTRAP_ADMIN_PASSWORD` — initial password (at least 10 characters).
- `SMART_ASSOCIATE_BOOTSTRAP_ADMIN_NAME` — optional display name.

The bootstrap account is created only when the database has no active administrator. Passwords are stored as Argon2 hashes. Do not commit credentials or place production secrets in source control.

On startup, existing employee rows without a User ID receive a stable `SA-` ID based on their database record. Admins can then edit those IDs and manage active status or reset passwords from the Staff Management dashboard.

Demo accounts are disabled by default. For local-only demonstrations, set `SMART_ASSOCIATE_ENABLE_DEMO_ACCOUNTS=true`; demo accounts use the password `123456` and must never be enabled in production.

## Staff activity and audit exports

Staff authenticate with User ID and password, record their own attendance and dated work notes, and update assigned task status. Admins can download a CSV report for a date range from **Dashboard → Staff Management**. The report combines attendance duration, work notes, and task-completion history.

Run the backend tests from this directory with:

```powershell
python -m pytest
```
