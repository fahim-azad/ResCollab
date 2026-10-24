# AI-Based Recommendations & Matching Workflow: Criteria, Ranking & Architecture

This document covers **RES-019: Task T-019.1** (Design recommendation criteria and matching workflow).

---

## 1. Executive Summary & Goals

ResCollab users need an intelligent recommendation engine to discover:
1. **Supervisors**: Faculty members whose active research aligns with student aspirations.
2. **Researchers & Collaborators**: Peers across departments and external institutions with complementary domains.
3. **Teammates**: Collaborators possessing complementary skills for active or proposed projects.
4. **Research Papers & Publications**: Relevant literature matching current research themes.
5. **Open Projects**: Research opportunities needing the user's specific skill sets.
6. **Skill Gaps & Topic Recommendations**: Identification of missing skills for high-demand areas.

---

## 2. Multi-Dimensional Matching Criteria

Recommendations are calculated using a weighted multi-attribute matching algorithm:

| Attribute Dimension | Description | Weight (Default) | Metric / Evaluation Method |
| :--- | :--- | :--- | :--- |
| **Research Interests ($\mathbf{S_{int}}$)** | Overlap of keyword tokens, research areas, and taxonomy terms | 35% | Jaccard index + Cosine similarity over normalized tokens |
| **Skill Compatibility ($\mathbf{S_{skill}}$)** | Exact skill match (supervisor/paper) or complementary skill gap match (teammates) | 30% | Set intersection / Jaccard similarity; gap-coverage index |
| **Domain & Affiliation ($\mathbf{S_{affil}}$)** | Department, institution, or cross-institutional alignment | 15% | Hierarchical affinity (Same Department > Same University > Partner University) |
| **Activity & Availability ($\mathbf{S_{act}}$)** | Recent publication date, active project count, `IsAcceptingStudents` | 20% | Binary flags + decay function on last active timestamp |

### Composite Score Formula:
$$\text{Relevance Score} = \min\left(100, \left(W_{int} \cdot S_{int} + W_{skill} \cdot S_{skill} + W_{affil} \cdot S_{affil} + W_{act} \cdot S_{act}\right) \times 100\right)$$

---

## 3. Specialized Recommendation Categories & Workflows

### 3.1 Supervisor Recommendations
- **Target Role**: `Role == "Supervisor" || Role == "Faculty"`.
- **Pre-Conditions**: `Profile.IsAcceptingStudents == true`.
- **Ranking Boost**: Higher weight on past publication topics and grant activity.
- **Output**: Match percentage, shared interests, active lab affiliations, and student acceptance status.

### 3.2 Teammate Matching
- **Target Role**: Researchers, postgraduate, and undergraduate students.
- **Model**: *Complementary Skills Matrix*. If User has "Frontend, React", the system prioritizes candidates having "Python, PyTorch, Data Science" who share the same research domain (e.g., "Healthcare AI").
- **Output**: Complementary skill badges, shared interests, availability status.

### 3.3 Publication & Literature Recommendations
- **Source**: `DbSet<Publication>` and external ingested metadata.
- **Matching**: Title keywords, abstract tokens, DOI subject classifications against user's recorded interests and bookmarked publications.
- **Output**: Title, authors, venue, publication year, matching keywords, DOI link.

### 3.4 Open Research Projects
- **Source**: `DbSet<OpenProject>` and `DbSet<ResearchIdea>`.
- **Matching**: Required project skills matched against user's profile skills.
- **Output**: Match percentage, required vs matched skills, project deadline, lead researcher.

### 3.5 Skill Gap Analysis Workflow
1. User specifies a target research interest or clicks on an Open Project.
2. System extracts required skills $K_{req}$ and user profile skills $K_{user}$.
3. Discrepancy set $\Delta K = K_{req} \setminus K_{user}$ represents the user's **Skill Gap**.
4. The system recommends:
   - High-yield topics/papers to bridge the gap.
   - Teammates on the platform who possess $\Delta K$ for collaboration.

---

## 4. Cold Start & Insufficient Data Handling

When a user has an incomplete profile (e.g. fewer than 2 skills or no interests defined):
1. **Empty State UI Prompt**: Displays an intuitive "Complete your Research Profile" guidance card with one-click suggestions.
2. **Fallback Trending Recommendations**:
   - Top active supervisors in user's institution/department.
   - Most bookmarked research papers on the platform.
   - Most recently created open project listings.
3. **Graceful Error Handling**: If no matches exceed a threshold of 10%, the system falls back to category-trending items without crashing.

---

## 5. Privacy, Permissions & Visibility Rules

1. **Profile Privacy**:
   - Profiles with `IsPublic == false` or `AllowDiscovery == false` are strictly excluded from teammate and researcher recommendation pools.
2. **Blocked Connections**:
   - Users with rejected/blocked connection statuses are excluded from results.
3. **Workspace Access**:
   - Private projects and workspaces are never recommended unless the user is already an invited member.

---

## 6. End-to-End Matching & Refresh Lifecycle

```
[User Trigger: Dashboard / Recommendations View]
                 │
                 ▼
[Check Cached RecommendationRecords (TTL = 24h)]
   ├── Hit & Valid ──► Return Cached Recommendations DTO
   └── Expired / Empty / Force Refresh
                 │
                 ▼
     [Execute Matching Engine]
     ├── 1. Extract User Profile Vectors (Interests, Skills, Affiliation)
     ├── 2. Query Candidate Pool with Privacy & Role Filters
     ├── 3. Calculate Multi-Attribute Weighted Scores
     ├── 4. Sort & Rank (Top-K per category)
     ├── 5. Detect Skill Gaps
     └── 6. Cache into `UserRecommendationRecord`
                 │
                 ▼
[Return Unified RecommendationResponse with Confidence Scores & Explanations]
```
