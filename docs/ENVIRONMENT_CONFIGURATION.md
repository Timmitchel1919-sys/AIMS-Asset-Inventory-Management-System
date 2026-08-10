# Environment Configuration

| Environment | Provider/use | Protection |
|---|---|---|
| Local | mock by default | no credentials |
| Emulator | Firebase adapters to local emulators | isolated fixture project |
| Development | non-production project | developer access and test data |
| Test | automated integration project/emulators | CI identity, resettable data |
| Staging | production-like release candidate | restricted access and migration rehearsal |
| Production | approved production services | least privilege, monitoring, backups and deployment approval |

Client-visible Vite variables may select environment, public Firebase client configuration, emulator endpoints and non-sensitive feature flags. Server credentials, AI keys, service-account material and secrets never enter `VITE_*` or bundles. Provider switching stays in composition; logging is redacted by environment. Production deployments require tested artifacts, approvals and rollback.
