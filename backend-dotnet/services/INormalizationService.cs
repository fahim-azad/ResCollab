using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public interface INormalizationService
    {
        NormalizedRecordResult NormalizeAndValidate(RawResearchInputDto input);
        DeduplicationMatchResult CheckDuplicate(NormalizedRecordResult candidate, List<ExternalResearchRecord> existingRecords);
        Task<DeduplicationRunSummaryDto> RunDeduplicationPassAsync();
        Task<PaginatedQuarantineDto> GetQuarantinedRecordsAsync(string? errorCode = null, int page = 1, int pageSize = 20);
        Task<ReprocessQuarantineResultDto> ReprocessQuarantinedRecordAsync(int errorRecordId);
    }

    public class RawResearchInputDto
    {
        public string? Title { get; set; }
        public string? Authors { get; set; }
        public string? Abstract { get; set; }
        public string? Doi { get; set; }
        public int? PublicationYear { get; set; }
        public DateTime? PublicationDate { get; set; }
        public string? JournalOrVenue { get; set; }
        public string? PrimaryField { get; set; }
        public string? OriginalUrl { get; set; }
        public string? PdfDownloadUrl { get; set; }
        public string? License { get; set; }
    }

    public class NormalizedRecordResult
    {
        public bool IsValid { get; set; }
        public List<string> ValidationErrors { get; set; } = new List<string>();
        public string Title { get; set; } = string.Empty;
        public string NormalizedTitleHash { get; set; } = string.Empty;
        public string Authors { get; set; } = string.Empty;
        public string FirstAuthor { get; set; } = string.Empty;
        public string? Abstract { get; set; }
        public string? Doi { get; set; }
        public int? PublicationYear { get; set; }
        public DateTime? PublicationDate { get; set; }
        public string? JournalOrVenue { get; set; }
        public string? PrimaryField { get; set; }
        public string OriginalUrl { get; set; } = string.Empty;
        public string? PdfDownloadUrl { get; set; }
        public string? License { get; set; }
    }

    public class DeduplicationMatchResult
    {
        public bool IsDuplicate { get; set; }
        public string DuplicateType { get; set; } = "None"; // "None", "ExactDoi", "ExactTitleHash", "FuzzyTitleAuthor"
        public int? MatchedRecordId { get; set; }
        public double SimilarityScore { get; set; }
        public bool CanMerge { get; set; }
    }

    public class DeduplicationRunSummaryDto
    {
        public int TotalScanned { get; set; }
        public int DuplicatesIdentified { get; set; }
        public int MergedRecords { get; set; }
        public long DurationMs { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class PaginatedQuarantineDto
    {
        public List<IngestionErrorRecord> Items { get; set; } = new List<IngestionErrorRecord>();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    public class ReprocessQuarantineResultDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public int? PromotedRecordId { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
    }
}
