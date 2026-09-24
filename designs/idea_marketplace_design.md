# Research Idea Marketplace: Data Model & Workflow

This document covers **Task 11** of Sprint 2: Designing the database models and the user workflow for the Research Idea Marketplace.

## 1. Concept

The Idea Marketplace allows students (and other researchers) to post a raw concept for a research paper or project before a formal team is built. Other users can browse these ideas and apply to join them. Once enough people are accepted, the idea transitions into a full "Project Workspace".

## 2. Database Models (For Task 12)

To support this, we need to add two new Entity Framework core models to our database:

### Model 1: `ResearchIdea`
This represents the actual idea posted on the marketplace.
*   `Id` (int, PK)
*   `CreatorId` (int, FK to `User`)
*   `Title` (string)
*   `Description` (string)
*   `ResearchArea` (string) - E.g., "Medical Imaging"
*   `RequiredSkills` (string) - Comma-separated, e.g., "Python, CNNs"
*   `ExpectedOutcome` (string) - E.g., "Conference Paper", "Dataset"
*   `RequiredTeamSize` (int) - How many teammates they need
*   `Status` (string) - "Open", "Recruiting", or "Closed"
*   `CreatedAt` (DateTime)

### Model 2: `IdeaApplication`
This tracks who has applied to join an idea.
*   `Id` (int, PK)
*   `IdeaId` (int, FK to `ResearchIdea`)
*   `ApplicantId` (int, FK to `User`)
*   `Message` (string) - "I'd love to help with the data processing part!"
*   `Status` (string) - "Pending", "Accepted", "Rejected"
*   `AppliedAt` (DateTime)

## 3. The Application Workflow (For Task 14)

The flow from "Idea" to "Team" operates as follows:

1.  **Creation (POST /api/ideas):** Student A has an idea for detecting cancer in X-Rays. They create a `ResearchIdea` needing 2 people.
2.  **Discovery (GET /api/ideas):** Student B is browsing the marketplace and sees the idea.
3.  **Application (POST /api/ideas/{id}/apply):** Student B clicks "Apply" and sends a short message. An `IdeaApplication` is created with Status = "Pending".
4.  **Review (GET /api/ideas/{id}/applications):** Student A checks their dashboard and sees Student B's application.
5.  **Decision (PUT /api/ideas/applications/{id}/status):** Student A accepts Student B. 
6.  **Team Formation (Future Sprint):** Once accepted, Student B is officially linked to the idea, paving the way to convert this Idea into an active private Project Workspace!
