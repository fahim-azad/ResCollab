# Supervisor Matching Rules & Validation Cases

This document covers **Task 2** of Sprint 2: Defining the exact rules and edge cases for the Supervisor Recommendation algorithm to ensure it works correctly under all scenarios.

## 1. Requirement-to-Profile Mapping Rules

The recommendation engine relies on the following database fields mapping correctly between the Student (Seeker) and the Supervisor (Provider):

| Student Profile Field | Maps To -> Supervisor Profile Field | Rule | Points |
| :--- | :--- | :--- | :--- |
| `Interests` (e.g., "AI, Web") | `Interests` | Partial string match (case-insensitive) for each comma-separated keyword. | +10 per match |
| `Department` (e.g., "CSE") | `Department` | Exact string match (case-insensitive). | +5 |
| `University` (e.g., "MIT") | `University` | Exact string match (case-insensitive). | +2 |

## 2. Hard Requirements (Filtering)

Before calculating points, the algorithm MUST filter out invalid supervisors.

1. **Role Check:** The returned users MUST have `Role == "Supervisor"` or `Role == "Faculty"`.
2. **Availability Check:** If we implement `IsAcceptingStudents == false`, they MUST be excluded.
3. **Self-Exclusion:** The returned list MUST NOT contain the student themselves.

## 3. Validation Cases (Edge Cases for QA Testing)

When we build the API (Task 3) and test it (Task 5), the QA team must validate these specific scenarios:

### Case 1: The "Empty Profile" Scenario
*   **Condition:** A student has a blank profile (no interests, no department, no university).
*   **Expected Result:** The algorithm should not throw an error. It should return a list of supervisors sorted randomly or by most recently joined, since all scores will be `0`.

### Case 2: The "Zero Match" Scenario
*   **Condition:** A student's interests (e.g., "Biology") have absolutely zero overlap with any supervisor in the database.
*   **Expected Result:** The API returns an empty array `[]` or supervisors with a score of `0`. The UI should display a "No exact matches found" empty state.

### Case 3: Case Sensitivity
*   **Condition:** Student interest is "machine learning", but Supervisor interest is "Machine Learning".
*   **Expected Result:** The algorithm MUST score this as a match (+10). All string comparisons must be `.ToLower()`.

### Case 4: Spacing and Formatting
*   **Condition:** Student interest is " AI ,  Web" (with weird spaces).
*   **Expected Result:** The algorithm must trim whitespace (`.Trim()`) before matching keywords.

## 4. Minimum Threshold
To prevent spamming the student with irrelevant supervisors, the API should ideally only return supervisors who achieve a **Score > 0**. If no supervisors score higher than 0, the UI should handle it gracefully.
