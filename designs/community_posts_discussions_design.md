# Research Community Communication: Data Model & Discussion Workflow

This document details the architectural design and database specifications for **RES-020: Task T-020.1** (Design community post, comment and reaction data model).

---

## 1. Executive Summary & Acceptance Criteria

ResCollab community discussions empower researchers, faculty, and students to broadcast academic breakthroughs, debate literature, initiate peer feedback, and ask methodology questions in an open, structured scholarly feed.

### Acceptance Criteria Supported:
- **Authorized Post Creation**: Logged-in researchers can publish academic posts with categories, tags, and research paper/preprint attachments.
- **Feed Browsing**: Users can browse chronological and engagement-ranked community discussions.
- **Threaded Commenting**: Users can reply to discussions with 1-level nested responses.
- **Scholarly Reactions**: Users can react to posts using academic sentiment reactions (`Like`, `Insightful`, `Curious`, `Celebrate`, `Support`).
- **Attribution & Timestamps**: Author avatars, full names, roles, institutions, and formatted creation timestamps are prominently rendered.
- **Authorization & Guardrails**: Authors can edit/delete their own posts; unauthorized mutation attempts return 401/403.
- **Empty State & Resilience**: Gracefully handles empty category feeds and server errors.

---

## 2. Entity Framework Core Data Models

The following relational models will be registered in `ResCollab.Api.Models`:

### Model 1: `CommunityPost`
Represents an academic discussion thread or announcement.
- `Id` (int, PK)
- `AuthorId` (int, FK to `User`)
- `Title` (string, max 300) - Concise subject or discussion query
- `Content` (string, max 5000) - Markdown-supported body
- `Category` (string) - `"General"`, `"ResearchInquiry"`, `"PaperDiscussion"`, `"ConferenceUpdate"`, `"CollaborationCall"`
- `Tags` (string?, max 500) - Comma-delimited taxonomy keywords (e.g. `"GraphNeuralNetworks, Chemistry"`)
- `AttachmentUrl` (string?, max 1000) - Link to PDF, arXiv preprint, dataset, or diagram
- `AttachmentType` (string?, max 50) - `"Link"`, `"PDF"`, `"Image"`
- `ReactionsCount` (int, default 0)
- `CommentsCount` (int, default 0)
- `SharesCount` (int, default 0)
- `IsPinned` (bool, default false) - Highlighted institutional or moderator announcements
- `Visibility` (string) - `"Public"`, `"Institution"`, `"ConnectionsOnly"`
- `CreatedAt`, `UpdatedAt` (DateTime)

### Model 2: `CommunityComment`
Represents comments and threaded replies to a community post.
- `Id` (int, PK)
- `PostId` (int, FK to `CommunityPost`)
- `AuthorId` (int, FK to `User`)
- `ParentCommentId` (int?, FK to `CommunityComment`) - Null for top-level comments; references parent for nested replies
- `Content` (string, max 2000)
- `LikesCount` (int, default 0)
- `CreatedAt`, `UpdatedAt` (DateTime)

### Model 3: `PostReaction`
Captures user reactions to avoid duplicate voting and power reaction metrics.
- `Id` (int, PK)
- `PostId` (int, FK to `CommunityPost`)
- `UserId` (int, FK to `User`)
- `ReactionType` (string, max 50) - `"Like"`, `"Insightful"`, `"Curious"`, `"Celebrate"`, `"Support"`
- `CreatedAt` (DateTime)
- Unique Index: `(PostId, UserId)` to allow 1 reaction per user per post (with toggle or reaction switching).

### Model 4: `PostShare`
Tracks shares/re-shares of academic posts across channels or user networks.
- `Id` (int, PK)
- `PostId` (int, FK to `CommunityPost`)
- `UserId` (int, FK to `User`)
- `ShareNote` (string?, max 500)
- `CreatedAt` (DateTime)

---

## 3. Discussion & Moderation Workflow

```
[Author] ──(POST /api/community/posts)──► [Validate Content & Tags]
                                                    │
                                                    ▼
                                            [Save Post to DB]
                                                    │
                                                    ▼
[Followers / Feed] ◄──(GET /api/community/posts)────┴──► [Display Post in Feed]
                                                              │
               ┌──────────────────────────────────────────────┴──────────────────────────┐
               ▼                                                                         ▼
     [Add Reaction]                                                                [Add Comment]
(POST /api/community/posts/{id}/react)                       (POST /api/community/posts/{id}/comments)
               │                                                                         │
    [Toggle or Update Reaction]                                              [Save Top-Level or Reply]
    [Increment/Decrement Counter]                                            [Increment CommentsCount]
```

---

## 4. API Contract Preview (For Task T-020.2)

- `GET /api/community/posts`: Feed retrieval with search, category filtering, and pagination (`page`, `pageSize`).
- `GET /api/community/posts/{id}`: Detailed post view including comments tree.
- `POST /api/community/posts`: Create a new post.
- `PUT /api/community/posts/{id}`: Edit post (author only).
- `DELETE /api/community/posts/{id}`: Delete post (author or moderator only).
- `POST /api/community/posts/{id}/comments`: Post a comment or reply.
- `POST /api/community/posts/{id}/react`: Toggle or update post reaction.
- `POST /api/community/posts/{id}/share`: Share post.
