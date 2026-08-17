# Firebase security model

Identity comes only from Firebase Authentication. Application access requires a non-null user, an exact (case-insensitive in rules) `kangoeroeschool.com` email domain, and `email_verified == true`. Frontend checks provide UX; `firestore.rules` and `storage.rules` enforce access independently.

`users/{uid}` can be created/read/updated only by that UID. Client updates are limited to profile and preference fields, preventing self-assigned roles, permissions, status, or organization changes. Activity logs and asset-code reservations are immutable. Deletes are denied; repository removals become archives. Unknown paths are denied by default.

Current operational collection writes are available to verified organization users while existing UI permissions remain in place. This is intentionally compatible with future custom-claim RBAC; privileged server workflows should later narrow collection actions using trusted claims.

The rules include document field-count limits. Storage is restricted to `aims/{uid}/...`, owner writes, verified school accounts, and files below 10 MiB. File-type-specific validation should be added when upload flows graduate from partial UI functionality.
