# Teammate Matching & Complementary Skill Model

This document outlines **Task 6** of Sprint 2: Designing the logic to recommend fellow students as potential teammates.

## 1. Core Concept: The "Research Fit vs. Skill Fit"

Unlike supervisors (where a student seeks mentorship in a specific domain), finding a teammate requires a balance of two things:
1.  **Research Fit (Similarity):** You want teammates who are passionate about the exact same research topics (e.g., both love "Machine Learning").
2.  **Skill Fit (Complementary):** You want teammates who bring different, complementary skills to the table (e.g., You know "Python Data Scraping", they know "React UI Development").

## 2. Matching Algorithm (The Scoring Rules)

When Student A opens the "Find Teammates" page, the algorithm scores all other students (Student B) using this Weighted Point System:

### Rule 1: Research Interest Overlap (Primary Weight: +10 pts)
*   **Logic:** Split the `Interests` strings. For every exact or partial keyword match between Student A and Student B, add **+10 Points**.
*   *Why?* Without shared interests, a research project cannot happen.

### Rule 2: University / Proximity Overlap (Secondary Weight: +5 pts)
*   **Logic:** If `Student A.University == Student B.University`, add **+5 Points**. 
*   *Why?* Working with someone from the same university makes physical meetups and lab access significantly easier.

### Rule 3: Department Overlap (+2 pts)
*   **Logic:** If `Student A.Department == Student B.Department`, add **+2 Points**.

## 3. The "Complementary Skill" Visual Model

Instead of forcing the backend to algorithmically guess what skills a student *lacks*, we will use a **Visual Complementary Model** for the MVP.

*   The backend will simply return the highly-scored students based on shared interests.
*   The Frontend UI will display Student B's `Skills` as highlighted badges on their card. 
*   This empowers Student A to manually review the top-matched peers and think: *"We both love AI (+10 points), but I see they know Backend Development and I only know Frontend. They are a perfect complementary fit!"*

## 4. API Contract (For Task 8)

**Endpoint:** `GET /api/recommendation/teammates`
**Headers:** `Authorization: Bearer <JWT_TOKEN>`

**Response JSON Model:**
```json
[
  {
    "userId": 99,
    "fullName": "Bob Builder",
    "university": "MIT",
    "department": "CSE",
    "matchedInterests": ["Artificial Intelligence", "Robotics"],
    "skills": ["C++", "ROS", "Hardware Design"],
    "matchScore": 25,
    "bio": "Looking for software devs to help me build an AI robot."
  }
]
```

## 5. Exclusions (Filters)
*   The API MUST exclude the currently logged-in student (you cannot match with yourself).
*   The API MUST only return users where `Role == "Student"`.
