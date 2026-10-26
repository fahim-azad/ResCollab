# External Research Data Collection & Normalization: Architecture, Data Model & Workflow

This document details the architectural design and database specifications for **RES-031: Task T-031.1** (Design external data collection and normalization workflow).

---

## 1. Executive Summary & Acceptance Criteria

To broaden scholarly discovery beyond manual user contributions, ResCollab includes an automated data collection and normalization engine capable of harvesting research papers, preprints, and academic events from authorized external sources.

### Acceptance Criteria Supported:
- **Configured & Permitted Sources**: Harvests data strictly from whitelisted and configured repositories (arXiv, Crossref, OpenAlex, Semantic Scholar, WikiCFP, institutional Open Access repositories).
- **Dual Collection Modalities**: Uses official REST APIs where supported; uses approved fallback parsing (RSS/Atom feeds, HTML Dublin Core `<meta name="citation_title">`, and JSON-LD metadata) only when APIs are unavailable.
- **Canonical Normalization**: Standardizes heterogeneous schemas into a unified, high-integrity research entity.
- **Robust Deduplication**: Resolves duplicate records via exact DOI canonical matching and high-confidence normalized title-author fuzzy matching.
- **Malformed Record Handling**: Quarantines incomplete or malformed entries into an error log without interrupting active collection pipelines.
- **Source Attribution & Provenance**: Always preserves the original external source identifier, repository name, license, and permalink.

---

## 2. Permitted Source Configuration & Policies

| Source Key | Source Name | Primary Mode | Auth / Policy | Fallback Mode |
| :--- | :--- | :--- | :--- | :--- |
| **`ARXIV`** | arXiv.org e-Print Archive | REST API (OAI-PMH / arXiv API) | Public / 3 req/sec rate limit | RSS Feeds |
| **`CROSSREF`** | Crossref Metadata Search | REST API | Polite Pool (`mailto` header) | N/A |
| **`OPENALEX`** | OpenAlex Global Scholarly Graph | REST API | Public API / Rate limited | N/A |
| **`WIKICFP`** | WikiCFP Academic Events | RSS / Atom Feeds | Robots.txt compliant | Structured HTML Meta |
| **`INSTITUTIONAL`** | University DSpace / EPrints | OAI-PMH XML API | Public Institutional Repositories | Dublin Core HTML |

---

## 3. End-to-End Data Pipeline Architecture

```
[Permitted Sources Registry (ExternalDataSources)]
                      │
                      ▼
        [External Ingestion Service]
                      │
   ┌──────────────────┴──────────────────┐
   ▼                                     ▼
[API Primary Ingestion]       [Feed / HTML Fallback Ingestion]
   │                                     │
   └──────────────────┬──────────────────┘
                      │
                      ▼
         [Payload Pre-Validation]
         ├── Has Title & Identifiers? ──► [NO] ──► [IngestionErrorRecords: Quarantined]
         └── [YES]
                      │
                      ▼
            [Normalization Engine]
            ├── 1. Standardize Title (strip LaTeX, trim whitespace)
            ├── 2. Canonicalize DOI (lowercase, strip https://doi.org/)
            ├── 3. Parse Authors Array & Affiliations
            ├── 4. Normalize Year & Publication Dates (ISO-8601)
            └── 5. Retain Source URL & Attribution Metadata
                      │
                      ▼
         [Deduplication & Collision Guard]
         ├── Exact DOI match in DB? ─────────────► [YES] ──► Skip or Update Metadata
         ├── Fuzzy Title + Author match (>92%)? ──► [YES] ──► Mark Duplicate Flag
         └── [NO]
                      │
                      ▼
        [Save to ExternalResearchRecords]
                      │
                      ▼
          [Update IngestionJobLogs]
```

---

## 4. Entity Framework Core Data Models

The following relational models will be defined in `ResCollab.Api.Models`:

### Model 1: `ExternalDataSource`
Maintains permitted external sources, API credentials, endpoints, and throttling policies.
- `Id` (int, Primary Key)
- `SourceKey` (string, max 50) - E.g. `"ARXIV"`, `"CROSSREF"`, `"OPENALEX"`, `"WIKICFP"`
- `Name` (string, max 200) - Descriptive title
- `BaseUrl` (string, max 500)
- `CollectionMethod` (string, max 50) - `"API"`, `"RSS_Feed"`, `"OAI_PMH"`, `"HTML_Meta"`
- `ApiKey` (string?, max 500) - Encrypted or bearer token
- `RateLimitPerMinute` (int, default 60)
- `IsActive` (bool, default true)
- `LastRunAt` (DateTime?)
- `CreatedAt`, `UpdatedAt` (DateTime)

### Model 2: `ExternalResearchRecord`
Staging and discovery repository storing normalized research papers, preprints, and academic events.
- `Id` (int, Primary Key)
- `SourceId` (int?, Foreign Key to `ExternalDataSource`)
- `ExternalId` (string, max 200) - Unique ID from the source repository (e.g. arXiv ID: `"2301.12345"`)
- `Title` (string, max 500) - Cleaned title
- `NormalizedTitleHash` (string, max 128) - Lowercase alphanumeric hash for fast duplicate detection
- `Authors` (string, max 2000) - Formatted author string / JSON array
- `Abstract` (string?, max 8000)
- `Doi` (string?, max 200) - Canonicalized DOI (`10.xxxx/...`)
- `PublicationYear` (int?)
- `PublicationDate` (DateTime?)
- `JournalOrVenue` (string?, max 300)
- `PrimaryField` (string?, max 200) - Category / Discipline
- `OriginalUrl` (string, max 1000) - Source permalink
- `PdfDownloadUrl` (string?, max 1000)
- `License` (string?, max 100) - E.g. `"CC-BY-4.0"`, `"OpenAccess"`
- `IngestionStatus` (string, max 50) - `"Normalized"`, `"Duplicate"`, `"Merged"`, `"Rejected"`
- `CollectedAt` (DateTime)

### Model 3: `IngestionJobLog`
Execution audit tracker for collection runs.
- `Id` (int, Primary Key)
- `SourceId` (int, Foreign Key to `ExternalDataSource`)
- `Status` (string, max 50) - `"Running"`, `"Success"`, `"PartialFailure"`, `"Failed"`
- `RecordsFetched` (int)
- `RecordsNormalized` (int)
- `DuplicatesSkipped` (int)
- `ErrorsCount` (int)
- `DurationMs` (long)
- `SummaryMessage` (string?, max 2000)
- `StartedAt` (DateTime)
- `CompletedAt` (DateTime?)

### Model 4: `IngestionErrorRecord`
Quarantine log for malformed or incomplete records that failed normalization.
- `Id` (int, Primary Key)
- `JobLogId` (int, Foreign Key to `IngestionJobLog`)
- `RawPayload` (string, max 8000)
- `ErrorCode` (string, max 100) - `"MissingTitle"`, `"InvalidDoiFormat"`, `"ParsingException"`, `"HttpTimeout"`
- `ErrorMessage` (string, max 2000)
- `OccurredAt` (DateTime)

---

## 5. Normalization & Deduplication Rules

1. **Title Normalization**: Strip HTML tags, remove LaTeX formatting commands (`\textbf`, `\math`), convert to NFC Unicode, trim extraneous whitespace.
2. **Canonical DOI**: Strip URL prefix (`https://doi.org/`, `http://dx.doi.org/`), convert to lowercase.
3. **Exact Duplication**: If an incoming record matches an existing `Doi`, compare timestamps: retain richer metadata, mark incoming as duplicate.
4. **Fuzzy Duplication**: Generate title hash `NormalizedTitleHash = SHA256(StripSpecialChars(Title.ToLower()))`. Flag duplicate if matching hash exists with identical first author.
