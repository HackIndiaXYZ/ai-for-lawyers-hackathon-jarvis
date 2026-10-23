# SRS — CasePilot AI

**Project:** PS-01 Legal Tech · **Version:** 1.0 · **Status:** MVP baseline

## Purpose
CasePilot AI helps legal teams organize cases, documents, hearings, tasks, and AI-assisted document summaries. AI output is advisory and must be reviewed by a legal professional.

## Functional requirements
- FR-001: Secure sign-in/out and role-based access.
- FR-002: Dashboard shows cases, hearings, tasks, and AI items awaiting review.
- FR-003: Authorized users can create, edit, search, filter, close, and archive cases.
- FR-004: Case records support parties, court/jurisdiction, case type, status, assignments, notes, and dates.
- FR-005: Upload supported documents with validation, metadata, and processing status.
- FR-006: AI summarizes documents and extracts candidate facts/dates with source references where possible.
- FR-007: AI output is labeled and reviewed by a human; extracted dates are not authoritative until verified.
- FR-008: Manage hearings, deadlines, tasks, assignments, and reminders.
- FR-009: Search results respect user permissions.
- FR-010: Significant actions are captured in audit history.
- FR-011: Provide controlled metadata import/export and documented integration APIs.

## Non-functional requirements
Encrypt production traffic and sensitive storage; enforce server-side authorization; protect secrets; minimize confidential data in logs; define retention, backups, recovery, and incident response; build a responsive accessible UI; evaluate AI quality and source accuracy before release.

## Suggested stack
React/Vite frontend, FastAPI backend, PostgreSQL, private encrypted document storage, configurable AI/OCR providers, and approved REST integrations.

## MVP acceptance criteria
Users can authenticate; create and search cases; upload supported files; request clearly labeled summaries; manage tasks and hearing dates; see in-app reminders; and access only authorized records. Significant changes are auditable and core workflows are tested.

## Out of scope
Autonomous legal advice, automatic court filing, guaranteed AI correctness, unverified limitation-period calculations, and integrations not yet built and tested.

## Open questions
Confirm jurisdiction, integration targets, file types/languages, approved AI provider, roles, notification channels, retention/data residency, expected scale, and production availability targets.
