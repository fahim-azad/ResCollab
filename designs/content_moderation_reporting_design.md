# Content & User Moderation / Reporting System: Data Model & Workflow

This document details the architectural design and database specifications for **RES-030: Task T-030.1** (Design reporting data model and moderation workflow).

---

## 1. Executive Summary & Acceptance Criteria

To maintain academic integrity, safety, and constructive scholarly discourse, ResCollab provides a reporting system enabling users to report inappropriate users or research content, backed by a privileged moderation queue for authorized moderators and administrators.

### Acceptance Criteria Supported:
- **Universal Target Reporting**: Users can flag problematic entities across supported types: `User`, `CommunityPost`, `CommunityComment`, `OpenProject`, `ResearchIdea`, `Publication`.
- **Comprehensive Audit Data**: Each report captures the target entity, reported individual, violation category, detailed explanation, reporter attribution, and exact submission timestamp.
- **Moderator Queue**: Authorized moderators can view pending submissions with status filters (`Pending`, `UnderReview`, `Resolved`, `Dismissed`).
- **Review Decisions & Actions**: Moderators can record decisions (`ContentRemoved`, `WarningIssued`, `AccountSuspended`, `Dismissed`) with written rationale.
- **Strict Role Boundaries**: Non-moderators attempting to view the moderation queue or submit moderation actions receive `403 Forbidden`.
- **Validation Guardrails**: Prevents self-reporting, duplicate active reports against the same entity, and empty reasons.

---

## 2. Supported Target Types & Violation Categories

| Target Type | Description | Common Violation Categories |
| :--- | :--- | :--- |
| **`User`** | Researcher profile or account | `Harassment`, `Impersonation`, `AcademicFraud`, `Spam` |
| **`CommunityPost`** | Discussion thread or announcement | `Plagiarism`, `OffensiveContent`, `Misinformation`, `Spam` |
| **`CommunityComment`** | Discussion comment or reply | `AbusiveLanguage`, `Harassment`, `Trolling`, `Spam` |
| **`OpenProject`** | Project recruitment listing | `DeceptiveListing`, `IPInfringement`, `Exploitation` |
| **`Publication`** | Paper listing or upload | `Plagiarism`, `CopyrightViolation`, `PredatorySource` |

---

## 3. Entity Framework Core Data Models

The following models will be defined in `ResCollab.Api.Models`:

### Model 1: `ReportSubmission`
Primary reporting entity recording user flags and moderator resolutions.
- `Id` (int, Primary Key)
- `ReporterId` (int, Foreign Key to `User`)
- `TargetType` (string, max 50) - `"User"`, `"CommunityPost"`, `"CommunityComment"`, `"OpenProject"`, `"Publication"`
- `TargetId` (int) - ID of the reported entity
- `ReportedUserId` (int?, Foreign Key to `User`) - Author or owner of the flagged content
- `Reason` (string, max 100) - `"Plagiarism"`, `"Harassment"`, `"Spam"`, `"Misinformation"`, `"CopyrightViolation"`, `"Other"`
- `Description` (string, max 2000) - Detailed context submitted by reporter
- `EvidenceUrl` (string?, max 1000) - Optional screenshot, link, or document reference
- `Status` (string, max 50) - `"Pending"`, `"UnderReview"`, `"Resolved"`, `"Dismissed"`
- `ModeratorId` (int?, Foreign Key to `User`) - Assigned reviewer
- `ResolutionNote` (string?, max 2000) - Moderator findings and rationale
- `ActionTaken` (string?, max 100) - `"None"`, `"ContentRemoved"`, `"WarningIssued"`, `"AccountSuspended"`
- `SubmittedAt` (DateTime)
- `ResolvedAt` (DateTime?)

### Model 2: `ModerationAuditLog`
Immutable audit log tracking every status transition and action executed by platform moderators.
- `Id` (int, Primary Key)
- `ReportId` (int, Foreign Key to `ReportSubmission`)
- `ModeratorId` (int, Foreign Key to `User`)
- `PreviousStatus` (string, max 50)
- `NewStatus` (string, max 50)
- `ActionDetails` (string, max 1000)
- `Timestamp` (DateTime)

---

## 4. Moderation Workflow State Machine

```
[User Submits Report] ──► [Backend Validation: Not Self, Has Reason, Authenticated]
                                        │
                                        ▼
                                [Status: "Pending"]
                                        │
                                        ▼
                   [Moderator Opens Moderation Queue (Role Check: 403)]
                                        │
                                        ▼
                             [Status: "UnderReview"]
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        [Decision: Valid Violation]              [Decision: No Violation / Invalid]
        - Status: "Resolved"                     - Status: "Dismissed"
        - Action: ContentRemoved / Warning       - Action: "None"
        - Resolution Note: Justification         - Resolution Note: Justification
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                            [Log to ModerationAuditLog]
                                        │
                                        ▼
                    [Notify Reporter & Log Admin Event]
```

---

## 5. API Endpoints Contract (For Task T-030.2)

- `POST /api/reports`: Submit a new report (Authenticated users).
- `GET /api/reports`: List reports with filtering by status and target type (`Moderator` / `Admin` only).
- `GET /api/reports/{id}`: Detailed view of report, target metadata, and history (`Moderator` / `Admin` only).
- `PUT /api/reports/{id}/status`: Update status (`UnderReview`, `Resolved`, `Dismissed`) with moderator notes and actions (`Moderator` / `Admin` only).
- `GET /api/reports/stats`: Counts of pending, resolved, and high-priority reports.
