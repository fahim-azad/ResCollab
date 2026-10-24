# Personalized Research Dashboard: Layout Architecture & Data Aggregation Workflow

This document details the architectural design and database specifications for **RES-029: Task T-029.1** (Design dashboard layout and data aggregation workflow).

---

## 1. Executive Summary & Acceptance Criteria

Researchers, faculty, and students require a single unified command center that aggregates their recommendations, workspace tasks, upcoming academic deadlines, saved resources, notifications, and scholarly discussions.

### Acceptance Criteria Supported:
- **Personalized Context**: Aggregates data strictly scoped to the logged-in user's role, affiliations, and permissions.
- **Unified Discovery & Workspaces**: Direct access to AI recommendations (`RES-019`), active workspaces (`RES-009/RES-010`), and community posts (`RES-020`).
- **Urgent Deadlines Tracker**: Aggregates imminent task deadlines and upcoming Conference/CFP deadlines (`RES-028`).
- **Real-Time Accuracy**: Live aggregation from database tables reflecting underlying record updates.
- **Role-Based Dynamic Views**: Adaptive layouts for Students, Faculty/Supervisors, and University Admins.
- **Graceful Empty States**: Every card/widget features guided call-to-actions when records are empty or when services encounter partial failures.

---

## 2. Dashboard Layout Wireframe & Component Hierarchy

The dashboard is structured into a modular, responsive grid:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. RESEARCHER HERO / PROFILE SNAPSHOT                                                  │
│ [Avatar] Dr. John Doe • Associate Professor of AI • Oxford University                  │
│ Profile Strength: 85% [=======-]  •  [Edit Profile]  •  [Quick Search]                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬────────────────┐
│ Active Projects │  Pending Tasks  │ Upcoming CFPs   │  Saved Papers   │ Unread Alerts  │
│       4         │       7         │       3         │       12        │       2        │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴────────────────┘

┌───────────────────────────────────────────────┬────────────────────────────────────────┐
│ 2. ACTIVE WORKSPACES & TASK VELOCITY          │ 3. IMMINENT DEADLINES (NEXT 30 DAYS)   │
│ • HealthAI Workspace (78% Complete)           │ ⚠️ IEEE CVPR 2027 Paper Submission (5d) │
│   Next: Train Transformer Baseline (Due Oct 30)│ 📅 Lab Milestone Review (Nov 2)        │
│ • Federated Edge Computing (42% Complete)     │ ⚠️ Nature Medicine CFP Cutoff (Nov 12) │
│ [View All Workspaces →]                       │ [Browse Academic Events →]             │
├───────────────────────────────────────────────┼────────────────────────────────────────┤
│ 4. AI-POWERED RECOMMENDATIONS STREAM          │ 5. RECENT COMMUNITY DISCUSSIONS        │
│ • Recommended Supervisor: Prof. Elena Rostova │ • "Benchmarking LLMs on Medical Code"  │
│   (94% Match • NLP, Knowledge Graphs)         │   By Dr. Alistair • 14 comments        │
│ • Recommended Teammate: Sarah Chen (PyTorch)  │ • "Call for Co-Authors: IEEE BigData"  │
│ • Open Project: Multi-Modal Pathology         │   By Marcus Vance • 6 reactions        │
│ [Explore AI Recommendations Hub →]            │ [Join Research Community →]            │
├───────────────────────────────────────────────┴────────────────────────────────────────┤
│ 6. SAVED RESOURCES, BOOKMARKS & AUDIT ACTIVITY LOG                                     │
│ • Recent Paper: "Attention Is All You Need" (Bookmarked 2d ago)                        │
│ • Activity: Accepted connection request from Dr. Alan Walker (Yesterday)               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Aggregation Workflow

When the client loads `GET /api/dashboard/summary`, the backend executes asynchronous parallel queries:

```
                                [Client Request: GET /api/dashboard/summary]
                                                     │
                                                     ▼
                                        [Extract UserId from JWT]
                                                     │
           ┌─────────────────────┬───────────────────┼────────────────────┬────────────────────┐
           ▼                     ▼                   ▼                    ▼                    ▼
     [User Profile]       [Workspaces &]       [Recommendations]    [Notifications &]    [Bookmarked Events &]
     - Name, Role         - Active Projects    - Top Supervisors    - Unread count       - Imminent CFPs (<30d)
     - University         - Assigned Tasks     - Complementary      - Top 5 recent       - Saved Papers
     - Profile Strength   - Completion %         Teammates          - System Alerts      - Deadlines timeline
           │                     │                   │                    │                    │
           └─────────────────────┴───────────────────┼────────────────────┴────────────────────┘
                                                     ▼
                                    [Merge into DashboardSummaryDto]
                                                     │
                                                     ▼
                                [Return Aggregated JSON Payload (200 OK)]
```

---

## 4. Entity Framework Core Data Models

To support personalized widget preferences and timeline audit logs, we define the following models in `ResCollab.Api.Models`:

### Model 1: `DashboardWidgetPreference`
Stores user-specific widget layout preferences, collapsed states, and ordering.
- `Id` (int, Primary Key)
- `UserId` (int, Foreign Key to `User`)
- `WidgetKey` (string, max 100) - `"Workspaces"`, `"Deadlines"`, `"Recommendations"`, `"Community"`, `"Bookmarks"`
- `IsVisible` (bool, default true)
- `DisplayOrder` (int, default 0)
- `UpdatedAt` (DateTime)

### Model 2: `PersonalizedActivityLog`
Captures chronological user actions and milestone events for display in the dashboard activity feed.
- `Id` (int, Primary Key)
- `UserId` (int, Foreign Key to `User`)
- `ActivityType` (string, max 100) - `"ProjectJoined"`, `"TaskCompleted"`, `"PaperBookmarked"`, `"PostCreated"`, `"ConnectionAccepted"`
- `Title` (string, max 300)
- `Description` (string?, max 1000)
- `TargetUrl` (string?, max 500)
- `CreatedAt` (DateTime)
