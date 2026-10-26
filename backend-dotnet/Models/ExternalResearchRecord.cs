using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Configuration for permitted and whitelisted external research repositories
    public class ExternalDataSource
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string SourceKey { get; set; } = string.Empty; // "ARXIV", "CROSSREF", "OPENALEX", "WIKICFP"

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string BaseUrl { get; set; } = string.Empty;

        // "API", "RSS_Feed", "OAI_PMH", "HTML_Meta"
        [Required]
        [MaxLength(50)]
        public string CollectionMethod { get; set; } = "API";

        [MaxLength(500)]
        public string? ApiKey { get; set; }

        public int RateLimitPerMinute { get; set; } = 60;

        public bool IsActive { get; set; } = true;

        public DateTime? LastRunAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<ExternalResearchRecord> Records { get; set; } = new List<ExternalResearchRecord>();
        public ICollection<IngestionJobLog> JobLogs { get; set; } = new List<IngestionJobLog>();
    }

    // Normalized research entity staged from external collection
    public class ExternalResearchRecord
    {
        [Key]
        public int Id { get; set; }

        public int? SourceId { get; set; }

        [Required]
        [MaxLength(200)]
        public string ExternalId { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(128)]
        public string? NormalizedTitleHash { get; set; }

        [Required]
        [MaxLength(2000)]
        public string Authors { get; set; } = string.Empty;

        [MaxLength(8000)]
        public string? Abstract { get; set; }

        [MaxLength(200)]
        public string? Doi { get; set; }

        public int? PublicationYear { get; set; }

        public DateTime? PublicationDate { get; set; }

        [MaxLength(300)]
        public string? JournalOrVenue { get; set; }

        [MaxLength(200)]
        public string? PrimaryField { get; set; }

        [Required]
        [MaxLength(1000)]
        public string OriginalUrl { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? PdfDownloadUrl { get; set; }

        [MaxLength(100)]
        public string? License { get; set; }

        // "Normalized", "Duplicate", "Merged", "Rejected"
        [Required]
        [MaxLength(50)]
        public string IngestionStatus { get; set; } = "Normalized";

        public DateTime CollectedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("SourceId")]
        public ExternalDataSource? Source { get; set; }
    }

    // Run audit and execution metrics for data collection tasks
    public class IngestionJobLog
    {
        [Key]
        public int Id { get; set; }

        public int SourceId { get; set; }

        // "Running", "Success", "PartialFailure", "Failed"
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Running";

        public int RecordsFetched { get; set; } = 0;

        public int RecordsNormalized { get; set; } = 0;

        public int DuplicatesSkipped { get; set; } = 0;

        public int ErrorsCount { get; set; } = 0;

        public long DurationMs { get; set; } = 0;

        [MaxLength(2000)]
        public string? SummaryMessage { get; set; }

        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        public DateTime? CompletedAt { get; set; }

        // Navigation
        [ForeignKey("SourceId")]
        public ExternalDataSource? Source { get; set; }

        public ICollection<IngestionErrorRecord> ErrorRecords { get; set; } = new List<IngestionErrorRecord>();
    }

    // Quarantined records that encountered parsing, format, or network errors
    public class IngestionErrorRecord
    {
        [Key]
        public int Id { get; set; }

        public int JobLogId { get; set; }

        [MaxLength(8000)]
        public string RawPayload { get; set; } = string.Empty;

        // "MissingTitle", "InvalidDoiFormat", "ParsingException", "HttpTimeout"
        [Required]
        [MaxLength(100)]
        public string ErrorCode { get; set; } = "ParsingException";

        [Required]
        [MaxLength(2000)]
        public string ErrorMessage { get; set; } = string.Empty;

        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("JobLogId")]
        public IngestionJobLog? JobLog { get; set; }
    }

    // DTOs for collection and ingestion status
    public class TriggerIngestionDto
    {
        [Required]
        public string SourceKey { get; set; } = string.Empty;

        public string? QueryKeyword { get; set; }

        public int MaxRecords { get; set; } = 50;
    }

    public class SourceStatusSummaryDto
    {
        public int SourceId { get; set; }
        public string SourceKey { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string CollectionMethod { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public int TotalRecordsIngested { get; set; }
        public int TotalDuplicatesFiltered { get; set; }
        public DateTime? LastSuccessfulRun { get; set; }
        public string? LastJobStatus { get; set; }
    }
}
