# Teammate Matching: Validation & User Stories

This document covers **Task 7** of Sprint 2: Validating the teammate matching criteria against our core user stories and outlining exact edge cases for the backend implementation (Task 8).

## 1. User Story Validation

| User Story | How our Criteria Satisfies This |
| :--- | :--- |
| **US1:** As a Student, I want to find peers in my university to collaborate locally. | Our algorithm explicitly adds **+5 Points** for a University match, pushing local students to the top of the list. |
| **US2:** As a Student, I want to find peers with the same research interests to form a team. | Our algorithm adds **+10 Points per shared interest keyword**, ensuring high relevance. |
| **US3:** As a Student, I want to find teammates with complementary skills (e.g., I know backend, I need a frontend dev). | The API returns the raw `Skills` array. The UI will render these as visual tags, allowing the student to manually filter and pick a balanced team from their highly-scored matches. |

## 2. Hard Requirements (Backend Filtering)

Before points are even calculated, the backend MUST apply these strict filters:
1. **Self-Exclusion:** A student must NEVER see their own profile in the recommendation list (`u.Id != currentUserId`).
2. **Role Enforcement:** The algorithm MUST ONLY return users where `Role == "Student"`. Supervisors and Faculty must not appear here.

## 3. QA Validation Cases (Edge Cases)

When Task 8 and 9 are complete, the QA team must test these specific scenarios:

### Case 1: The "No Skills" Scenario
*   **Condition:** Student B has a high research match (+20 pts) but their `Skills` field in the database is `null` or empty.
*   **Expected Result:** The API should return `skills: []` (an empty array) rather than crashing or returning null. The UI should display "No specific skills listed."

### Case 2: Case-Insensitive Matching
*   **Condition:** Student A has interest "DEEP LEARNING", Student B has "Deep Learning".
*   **Expected Result:** The algorithm must convert strings to `.ToLower()` and `.Trim()` before comparing to ensure a +10 point match.

### Case 3: The "Zero Match" Fallback
*   **Condition:** A student has interests that overlap with absolutely no one in the database.
*   **Expected Result:** The API should return a fallback list of the newest or random students (capped at 10) so the UI is not empty, but their `MatchScore` will be `0`.
