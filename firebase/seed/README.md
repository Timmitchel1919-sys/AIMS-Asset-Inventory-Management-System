# Legal policy seed

This project does not currently include the Firebase Admin SDK. After KCS management approves the documents and the Firebase project is configured, install the administrative tooling and authenticate with Application Default Credentials:

```powershell
npm install --save-dev firebase-admin tsx
npx tsx firebase/seed/seedLegalDocuments.ts
```

The script uses merge-safe writes, does not embed credentials, preserves a different published version, and is not run automatically.
