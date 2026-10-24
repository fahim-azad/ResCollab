# Institutional Research & Collaboration Analytics: Data Model & Metrics Design

This document details the architectural design and database models for **RES-018: Task T-018.1** (Design analytics data model and metrics).

---

## 1. Objective & Scope

Universities, department heads, and academic leaders require unified visibility into research outputs, active workspaces, cross-institutional collaborations, and grant/funding performance.

### Acceptance Criteria Supported:
- **Role-Based Access**: Analytics views adapt to user role (University Admin, Department Head, PI/Researcher, Student).
- **Researcher Metrics**: Publication counts, active projects, citation aggregates, and collaborator networks.
- **Team & Workspace Progress**: Task completion rates, milestone velocities, and active team contributions.
- **Institutional & Departmental Overview**: Total researchers, faculty publications, cross-institutional partnership indices, and ongoing grant projects.
- **Accurate Aggregation**: Derived directly from stored records (`Publications`, `Workspaces`, `WorkspaceTasks`, `OpenProjects`, `UserConnections`, `FundingOpportunities`).

---

## 2. Database Models

To support efficient queries and historical trending without degrading operational transaction performance, we introduce the following Entity Framework Core models in `ResCollab.Api.Models`:

### Model 1: `InstitutionalMetric`
Stores snapshot metrics and historical trend entries for universities, departments, and research clusters.
- `Id` (int, Primary Key)
- `InstitutionId` (int?, Foreign Key to `University`)
- `DepartmentId` (int?, Foreign Key to `Department`)
- `Category` (string) - `"Publications"`, `"Collaborations"`, `"Projects"`, `"Funding"`, `"Milestones"`
- `MetricType` (string) - E.g., `"TotalPublications"`, `"ActiveProjects"`, `"CrossInstitutionalCount"`, `"TaskVelocity"`
- `MetricValue` (double) - Numerical quantitative value
- `Period` (string) - `"AllTime"`, `"Annual"`, `"Quarterly"`, `"Monthly"`
- `PeriodYear` (int)
- `PeriodMonth` (int?)
- `MetadataJson` (string?) - JSON structure for sub-breakdowns (e.g., breakdown by research topic or department)
- `RecordedAt` (DateTime)

### Model 2: `ResearchAnalyticsSnapshot`
Cached roll-up for fast dashboard delivery:
- `Id` (int, Primary Key)
- `ScopeType` (string) - `"Institution"`, `"Department"`, `"Team"`, `"Researcher"`
- `ScopeId` (int) - Target University Id, Department Id, Workspace Id, or User Id
- `TotalPublications` (int)
- `TotalProjects` (int)
- `ActiveCollaborations` (int)
- `CompletedTasks` (int)
- `TotalTasks` (int)
- `ProgressPercentage` (double)
- `ExternalPartnerships` (int)
- `LastCalculated` (DateTime)

### Model 3: `CollaborationNetworkMetric`
Tracks inter-departmental and cross-institutional collaboration edges:
- `Id` (int, Primary Key)
- `SourceInstitution` (string)
- `TargetInstitution` (string)
- `SourceDepartment` (string?)
- `TargetDepartment` (string?)
- `JointPublicationsCount` (int)
- `JointProjectsCount` (int)
- `ActiveCoAuthors` (int)
- `LastCalculated` (DateTime)

---

## 3. Metrics Calculation Logic (For Task T-018.2)

1. **Researcher Level**:
   - `Publications`: Count from `DbSet<Publication>` where `AuthorId == UserId` or co-authors match.
   - `Projects`: Count from `DbSet<WorkspaceMember>` where `UserId == currentUserId`.
   - `Collaborators`: Count from `DbSet<UserConnection>` where `Status == "Accepted"`.

2. **Team / Workspace Level**:
   - `CompletedTasks`: `WorkspaceTasks.Count(t => t.WorkspaceId == id && t.Status == "Completed")`
   - `TaskCompletionRate`: `(CompletedTasks / TotalTasks) * 100`
   - `MilestoneProgress`: Computed from milestone items in workspace notes and tasks.

3. **Institutional Level**:
   - Aggregated across all researchers whose profile `Institution` matches the University name or `UniversityId`.
   - Filtered by Department when scoped to department views.

---

## 4. API Endpoints Contract (For Task T-018.2)

- `GET /api/analytics/institutional/{institutionId}`: High-level metrics for university dashboards.
- `GET /api/analytics/department/{departmentId}`: Departmental breakdown and research output.
- `GET /api/analytics/researcher/{userId}`: Individual researcher statistics.
- `GET /api/analytics/team/{workspaceId}`: Workspace task completion and progress metrics.
- `POST /api/analytics/recalculate`: Triggers on-demand calculation of cached snapshots (restricted to Admins/Moderators).

---

## 5. Security & Permission Rules

- **Public / Unauthenticated**: Restricted to public summary statistics if enabled.
- **Student / Researcher**: Can view own metrics and public department statistics. Cannot access private institutional financial/funding figures or private workspaces.
- **University Admin / Department Head**: Full access to institutional metrics, researcher rankings, and cross-departmental collaboration charts.
