# Login ICT Support Contacts

The login page exposes a compact ICT Support link that opens an accessible responsive dialog. Policy order: submit through the Ticket System first, wait for assignment, contact KCS ICT Support for follow-up, and contact a named staff member only after assignment or escalation.

No ticket submission route currently exists. The action uses `/support#ticket-system` as a presentation placeholder and explicitly states that no ticket is stored. No backend, Firebase connection, or notification is created.

Support hours are Monday–Friday, 07:30 A.M.–14:00 P.M. (07:30–14:00 Dutch). General contact: `ictsupport@kangoeroeschool.com`; internal line `430870 / 431977 ext. 225`.

The typed source of truth is `src/config/ictSupport.ts`. It contains the six approved contacts. Jason Sanoesi’s role is Junior IT Technician. The dialog warns users never to share passwords, verification codes, or recovery information.

Desktop uses a centered glass dialog; mobile uses a stacked bottom sheet. Focus is contained, Escape closes, focus returns to the trigger, email addresses wrap, and all interactive targets are keyboard accessible.
