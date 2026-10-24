# Academic Events, Conferences & Calls for Papers: Data Model & Discovery Workflow

This document details the architectural design and database specifications for **RES-028: Task T-028.1** (Design event data model and discovery workflow).

---

## 1. Executive Summary & Acceptance Criteria

ResCollab users require a centralized, searchable discovery portal for academic events, including conferences, workshops, seminars, competitions, and Calls for Papers (CFP) across disciplines.

### Acceptance Criteria Supported:
- **Event Browsing**: Users can browse upcoming and active academic opportunities.
- **Rich Event Metadata**: Captures title, organizer, event type, dates, submission/registration deadlines, venue, field of study, and external links.
- **Search & Multi-Facet Filtering**: Filter events by event type, research discipline, virtual/in-person status, and deadline timeframes.
- **Complete Details View**: Modal/page view with full conference agenda, CFP guidelines, organizer contacts, and external registration anchors.
- **External Link Integrity**: Sanitized outbound URLs opening securely with target `_blank` and `rel="noopener noreferrer"`.
- **Incomplete / Malformed Record Gracefulness**: Graceful fallback values ("Date TBD", "Virtual / Unspecified") for incomplete records.
- **Event Bookmarking / Deadlines Tracking**: Enables researchers to save events and view impending deadlines on their personal schedules.

---

## 2. Entity Framework Core Data Models

The following relational models will be defined in `ResCollab.Api.Models`:

### Model 1: `AcademicEvent`
- `Id` (int, Primary Key)
- `Title` (string, max 300) - Title of the conference, workshop, seminar, or competition
- `Organizer` (string, max 300) - Organizing institution or society (e.g. IEEE, ACM, Springer, Stanford University)
- `EventType` (string, max 100) - `"Conference"`, `"Seminar"`, `"Workshop"`, `"CallForPapers"`, `"Competition"`, `"Symposium"`
- `Description` (string, max 4000) - Event overview and submission scope
- `FieldOfStudy` (string, max 200) - Domain/Field (e.g. `"Computer Science"`, `"Biomedical Engineering"`, `"Economics"`)
- `Location` (string?, max 300) - Physical venue or city/country (e.g. `"Vienna, Austria"`)
- `IsVirtual` (bool, default false) - Whether the event has online attendance
- `StartDate` (DateTime?) - Event start date
- `EndDate` (DateTime?) - Event conclusion date
- `SubmissionDeadline` (DateTime?) - Call for Papers / Submission deadline
- `RegistrationDeadline` (DateTime?) - Early-bird or general registration cutoff
- `WebsiteUrl` (string?, max 1000) - Official conference/event portal
- `RegistrationUrl` (string?, max 1000) - External registration / ticket link
- `Source` (string?, max 200) - Data ingestion origin (e.g. `"Manual Submission"`, `"WikiCFP"`, `"EasyChair"`)
- `Status` (string, max 50) - `"Upcoming"`, `"Ongoing"`, `"Completed"`, `"Cancelled"`
- `PostedById` (int?, Foreign Key to `User`) - Submitter (optional for auto-ingested events)
- `CreatedAt`, `UpdatedAt` (DateTime)

### Model 2: `EventBookmark`
- `Id` (int, Primary Key)
- `EventId` (int, Foreign Key to `AcademicEvent`)
- `UserId` (int, Foreign Key to `User`)
- `Notes` (string?, max 500) - Personal notes regarding paper submission or attendance
- `CreatedAt` (DateTime)
- Unique Constraint: `(EventId, UserId)` to prevent duplicate bookmarks.

---

## 3. Discovery & Filtering Workflow

```
[User / Researcher]
       │
       ▼
[Discovery Search & Filter Bar]
  ├── Keyword: "Computer Vision", "Health Informatics"
  ├── Event Type: [x] Conference  [x] Workshop  [ ] Seminar
  ├── Discipline: Artificial Intelligence
  ├── Mode: [x] Virtual / Hybrid Only
  └── Deadline Window: Next 30 / 60 / 90 Days
       │
       ▼
[Event Discovery Engine (GET /api/events)]
  ├── Dynamic LINQ Query & Full-Text Predicates
  ├── Deadline Urgency Calculation (Days Remaining: Expired / < 7 days / < 30 days)
  └── Paginated Event Cards
       │
       ▼
[Event Details Modal / Outbound Action]
  ├── View Complete Scope & Topic Tracks
  ├── Save to "My Calendar / Bookmarks"
  └── Navigate to Official Portal (Secure Outbound Link)
```

---

## 4. API Endpoints Contract (For Task T-028.2)

- `GET /api/events`: Search and filter events with pagination (`search`, `eventType`, `fieldOfStudy`, `isVirtual`, `hasOpenCfp`, `page`, `pageSize`).
- `GET /api/events/{id}`: Detailed event record and bookmark status for logged-in user.
- `POST /api/events`: Submit a new research event (Authenticated users).
- `PUT /api/events/{id}`: Edit event details (Submitter or Admin).
- `DELETE /api/events/{id}`: Remove or cancel event.
- `POST /api/events/{id}/bookmark`: Toggle event bookmark for user dashboard.
- `GET /api/events/upcoming-deadlines`: Urgent deadlines in next 30 days.
