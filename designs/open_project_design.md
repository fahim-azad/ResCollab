# Open Project Marketplace: Schema & Workflow

This document covers **Task 15** of Sprint 2: Designing the database models and the recruitment workflow for the Open Project Marketplace.

## 1. Concept: Ideas vs. Projects

*   **Ideas:** Created by *Students* looking to form peer groups to start something from scratch.
*   **Open Projects:** Created by *Faculty or Supervisors* who already have an established research project, lab, or grant, and are actively recruiting students to join their team.

## 2. Database Schema (For Task 17)

To support this, we will introduce a new model into EF Core:

### Model: `OpenProject`
This represents a formal project recruiting students.
*   `Id` (int, PK)
*   `SupervisorId` (int, FK to `User`) - Note: Only users with Role = "Supervisor" or "Faculty" should be able to create this.
*   `Title` (string)
*   `Description` (string)
*   `Department` (string) - E.g., "Computer Science"
*   `RequiredSkills` (string) - E.g., "C++, Data Analysis"
*   `MaxStudents` (int) - Number of open spots in the lab/project.
*   `IsFunded` (bool) - Indicates if the student will receive a stipend/funding.
*   `Status` (string) - "Recruiting" or "Closed"
*   `CreatedAt` (DateTime)

*(Note: We can reuse the concept of an Application table, e.g., `ProjectApplication`, similar to `IdeaApplication`, to track student submissions).*

## 3. Recruitment Workflow

1.  **Creation (POST /api/project):** A Faculty member logs in and posts an Open Project, checking the `IsFunded` box because they have a grant.
2.  **Discovery (GET /api/project):** A Student navigates to the "Projects" tab in the UI. They can filter to see only "Funded" projects.
3.  **Application:** The Student reads the project details and clicks "Apply for Position", submitting a short cover letter.
4.  **Review & Hiring:** The Faculty member reviews the applications, accepts the student, and the student's status changes to "Hired/Accepted".
