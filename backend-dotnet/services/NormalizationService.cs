using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public class NormalizationService : INormalizationService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<NormalizationService> _logger;

        private static readonly Regex DoiRegex = new(
            @"^10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public NormalizationService(ApplicationDbContext context, ILogger<NormalizationService> logger)
        {
            _context = context;
            _logger = logger;
        }

        // =========================================================================
        // 1. NORMALIZE & VALIDATE INCOMING PAYLOAD
        // =========================================================================

        public NormalizedRecordResult NormalizeAndValidate(RawResearchInputDto input)
        {
            var result = new NormalizedRecordResult();

            // 1. Title Normalization & Validation
            if (string.IsNullOrWhiteSpace(input.Title))
            {
                result.ValidationErrors.Add("Title is missing or empty.");
            }
            else
            {
                var cleanTitle = CleanTitle(input.Title);
                if (cleanTitle.Length < 5)
                {
                    result.ValidationErrors.Add("Title is too short (< 5 characters) or unparseable.");
                }
                else
                {
                    result.Title = cleanTitle;
                    result.NormalizedTitleHash = ComputeTitleHash(cleanTitle);
                }
            }

            // 2. Canonical DOI Normalization & Validation
            if (!string.IsNullOrWhiteSpace(input.Doi))
            {
                var canonicalDoi = CanonicalizeDoi(input.Doi);
                if (!string.IsNullOrWhiteSpace(canonicalDoi))
                {
                    if (DoiRegex.IsMatch(canonicalDoi))
                    {
                        result.Doi = canonicalDoi;
                    }
                    else
                    {
                        result.ValidationErrors.Add($"Invalid DOI format: '{input.Doi}'. Expected format '10.xxxx/...'.");
                    }
                }
            }

            // 3. Author List Standardization
            var (formattedAuthors, firstAuthor) = StandardizeAuthors(input.Authors);
            result.Authors = formattedAuthors;
            result.FirstAuthor = firstAuthor;

            // 4. Abstract Normalization
            if (!string.IsNullOrWhiteSpace(input.Abstract))
            {
                var cleanAbs = WebUtility.HtmlDecode(input.Abstract);
                cleanAbs = Regex.Replace(cleanAbs, "<.*?>", string.Empty);
                cleanAbs = Regex.Replace(cleanAbs, @"\s+", " ").Trim();
                result.Abstract = cleanAbs.Length > 8000 ? cleanAbs.Substring(0, 8000) : cleanAbs;
            }

            // 5. Publication Dates & Year Clamping
            var currentYear = DateTime.UtcNow.Year;
            if (input.PublicationYear.HasValue)
            {
                var y = input.PublicationYear.Value;
                if (y >= 1900 && y <= currentYear + 2)
                {
                    result.PublicationYear = y;
                }
            }

            if (input.PublicationDate.HasValue)
            {
                result.PublicationDate = DateTime.SpecifyKind(input.PublicationDate.Value, DateTimeKind.Utc);
                if (!result.PublicationYear.HasValue)
                {
                    result.PublicationYear = result.PublicationDate.Value.Year;
                }
            }

            // 6. Venue & Primary Field
            result.JournalOrVenue = string.IsNullOrWhiteSpace(input.JournalOrVenue)
                ? "Scholarly Publication"
                : input.JournalOrVenue.Trim();

            result.PrimaryField = string.IsNullOrWhiteSpace(input.PrimaryField)
                ? "General Academic"
                : input.PrimaryField.Trim();

            // 7. URL Sanitization
            result.OriginalUrl = SanitizeUrl(input.OriginalUrl) ?? "https://rescollab.org";
            result.PdfDownloadUrl = SanitizeUrl(input.PdfDownloadUrl);

            // 8. License
            result.License = string.IsNullOrWhiteSpace(input.License) ? "OpenAccess" : input.License.Trim();

            result.IsValid = result.ValidationErrors.Count == 0;
            return result;
        }

        // =========================================================================
        // 2. DEDUPLICATION & COLLISION DETECTION
        // =========================================================================

        public DeduplicationMatchResult CheckDuplicate(
            NormalizedRecordResult candidate,
            List<ExternalResearchRecord> existingRecords)
        {
            // Exact DOI match
            if (!string.IsNullOrWhiteSpace(candidate.Doi))
            {
                var doiMatch = existingRecords.FirstOrDefault(r =>
                    !string.IsNullOrWhiteSpace(r.Doi) &&
                    r.Doi.Equals(candidate.Doi, StringComparison.OrdinalIgnoreCase));

                if (doiMatch != null)
                {
                    // Check if candidate has richer data that can be merged
                    bool canMerge = (string.IsNullOrWhiteSpace(doiMatch.Abstract) && !string.IsNullOrWhiteSpace(candidate.Abstract)) ||
                                    (string.IsNullOrWhiteSpace(doiMatch.PdfDownloadUrl) && !string.IsNullOrWhiteSpace(candidate.PdfDownloadUrl));

                    return new DeduplicationMatchResult
                    {
                        IsDuplicate = true,
                        DuplicateType = "ExactDoi",
                        MatchedRecordId = doiMatch.Id,
                        SimilarityScore = 1.0,
                        CanMerge = canMerge
                    };
                }
            }

            // Exact Normalized Title Hash match
            if (!string.IsNullOrWhiteSpace(candidate.NormalizedTitleHash))
            {
                var hashMatch = existingRecords.FirstOrDefault(r =>
                    !string.IsNullOrWhiteSpace(r.NormalizedTitleHash) &&
                    r.NormalizedTitleHash == candidate.NormalizedTitleHash);

                if (hashMatch != null)
                {
                    return new DeduplicationMatchResult
                    {
                        IsDuplicate = true,
                        DuplicateType = "ExactTitleHash",
                        MatchedRecordId = hashMatch.Id,
                        SimilarityScore = 1.0,
                        CanMerge = false
                    };
                }
            }

            // Fuzzy Title + Author matching
            if (!string.IsNullOrWhiteSpace(candidate.Title))
            {
                foreach (var existing in existingRecords)
                {
                    // Only compare if years match or first author matches
                    bool authorOrYearCorrelation = (candidate.PublicationYear.HasValue && existing.PublicationYear == candidate.PublicationYear) ||
                                                   (!string.IsNullOrEmpty(candidate.FirstAuthor) && existing.Authors.Contains(candidate.FirstAuthor, StringComparison.OrdinalIgnoreCase));

                    if (authorOrYearCorrelation)
                    {
                        double similarity = CalculateJaccardSimilarity(candidate.Title, existing.Title);
                        if (similarity >= 0.90)
                        {
                            return new DeduplicationMatchResult
                            {
                                IsDuplicate = true,
                                DuplicateType = "FuzzyTitleAuthor",
                                MatchedRecordId = existing.Id,
                                SimilarityScore = Math.Round(similarity, 3),
                                CanMerge = false
                            };
                        }
                    }
                }
            }

            return new DeduplicationMatchResult
            {
                IsDuplicate = false,
                DuplicateType = "None",
                SimilarityScore = 0.0,
                CanMerge = false
            };
        }

        // =========================================================================
        // 3. BATCH DEDUPLICATION PASS OVER STAGED RECORDS
        // =========================================================================

        public async Task<DeduplicationRunSummaryDto> RunDeduplicationPassAsync()
        {
            var stopwatch = Stopwatch.StartNew();
            var allRecords = await _context.ExternalResearchRecords
                .OrderBy(r => r.CollectedAt)
                .ToListAsync();

            int duplicatesFound = 0;
            int mergedCount = 0;

            var primaryDoiIndex = new Dictionary<string, ExternalResearchRecord>(StringComparer.OrdinalIgnoreCase);
            var primaryHashIndex = new Dictionary<string, ExternalResearchRecord>(StringComparer.OrdinalIgnoreCase);

            foreach (var record in allRecords)
            {
                bool isDuplicate = false;

                // 1. DOI Matching
                if (!string.IsNullOrWhiteSpace(record.Doi))
                {
                    if (primaryDoiIndex.TryGetValue(record.Doi, out var existingDoi))
                    {
                        isDuplicate = true;
                        // Smart merge: transfer missing abstract or pdf link
                        if (string.IsNullOrWhiteSpace(existingDoi.Abstract) && !string.IsNullOrWhiteSpace(record.Abstract))
                        {
                            existingDoi.Abstract = record.Abstract;
                            mergedCount++;
                        }
                        if (string.IsNullOrWhiteSpace(existingDoi.PdfDownloadUrl) && !string.IsNullOrWhiteSpace(record.PdfDownloadUrl))
                        {
                            existingDoi.PdfDownloadUrl = record.PdfDownloadUrl;
                            mergedCount++;
                        }
                    }
                    else
                    {
                        primaryDoiIndex[record.Doi] = record;
                    }
                }

                // 2. Hash Matching
                if (!isDuplicate && !string.IsNullOrWhiteSpace(record.NormalizedTitleHash))
                {
                    if (primaryHashIndex.TryGetValue(record.NormalizedTitleHash, out _))
                    {
                        isDuplicate = true;
                    }
                    else
                    {
                        primaryHashIndex[record.NormalizedTitleHash] = record;
                    }
                }

                if (isDuplicate && record.IngestionStatus != "Duplicate")
                {
                    record.IngestionStatus = "Duplicate";
                    duplicatesFound++;
                }
            }

            await _context.SaveChangesAsync();
            stopwatch.Stop();

            return new DeduplicationRunSummaryDto
            {
                TotalScanned = allRecords.Count,
                DuplicatesIdentified = duplicatesFound,
                MergedRecords = mergedCount,
                DurationMs = stopwatch.ElapsedMilliseconds,
                Message = $"Scanned {allRecords.Count} records. Flagged {duplicatesFound} duplicates and merged {mergedCount} records in {stopwatch.ElapsedMilliseconds}ms."
            };
        }

        // =========================================================================
        // 4. QUARANTINE & ERROR LOG MANAGEMENT
        // =========================================================================

        public async Task<PaginatedQuarantineDto> GetQuarantinedRecordsAsync(
            string? errorCode = null,
            int page = 1,
            int pageSize = 20)
        {
            var query = _context.IngestionErrorRecords
                .Include(e => e.JobLog)
                    .ThenInclude(j => j!.Source)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(errorCode) && !errorCode.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(e => e.ErrorCode.ToLower() == errorCode.ToLower());
            }

            query = query.OrderByDescending(e => e.OccurredAt);

            var totalCount = await query.CountAsync();
            var skip = (Math.Max(1, page) - 1) * pageSize;
            var items = await query.Skip(skip).Take(pageSize).ToListAsync();

            return new PaginatedQuarantineDto
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };
        }

        public async Task<ReprocessQuarantineResultDto> ReprocessQuarantinedRecordAsync(int errorRecordId)
        {
            var error = await _context.IngestionErrorRecords
                .Include(e => e.JobLog)
                .FirstOrDefaultAsync(e => e.Id == errorRecordId);

            if (error == null)
            {
                return new ReprocessQuarantineResultDto
                {
                    Success = false,
                    Message = $"Quarantined record #{errorRecordId} was not found."
                };
            }

            // Attempt to repair and normalize raw payload
            var repairedInput = new RawResearchInputDto
            {
                Title = error.RawPayload,
                Authors = "Reprocessed Contributor",
                OriginalUrl = "https://rescollab.org/reprocessed",
                License = "OpenAccess"
            };

            // If raw payload is JSON, try deserializing
            if (error.RawPayload.TrimStart().StartsWith("{"))
            {
                try
                {
                    using var doc = JsonDocument.Parse(error.RawPayload);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("title", out var tp)) repairedInput.Title = tp.GetString();
                    if (root.TryGetProperty("authors", out var ap)) repairedInput.Authors = ap.GetString();
                    if (root.TryGetProperty("doi", out var dp)) repairedInput.Doi = dp.GetString();
                    if (root.TryGetProperty("url", out var up)) repairedInput.OriginalUrl = up.GetString();
                }
                catch
                {
                    // Keep fallback repaired input
                }
            }

            var norm = NormalizeAndValidate(repairedInput);
            if (!norm.IsValid)
            {
                return new ReprocessQuarantineResultDto
                {
                    Success = false,
                    Message = "Record cannot be promoted: validation errors persist.",
                    Errors = norm.ValidationErrors
                };
            }

            var newRecord = new ExternalResearchRecord
            {
                SourceId = error.JobLog?.SourceId,
                ExternalId = $"repaired-{error.Id}",
                Title = norm.Title,
                NormalizedTitleHash = norm.NormalizedTitleHash,
                Authors = norm.Authors,
                Abstract = norm.Abstract,
                Doi = norm.Doi,
                PublicationYear = norm.PublicationYear,
                PublicationDate = norm.PublicationDate,
                JournalOrVenue = norm.JournalOrVenue,
                PrimaryField = norm.PrimaryField,
                OriginalUrl = norm.OriginalUrl,
                PdfDownloadUrl = norm.PdfDownloadUrl,
                License = norm.License,
                IngestionStatus = "Normalized",
                CollectedAt = DateTime.UtcNow
            };

            _context.ExternalResearchRecords.Add(newRecord);
            _context.IngestionErrorRecords.Remove(error);
            await _context.SaveChangesAsync();

            return new ReprocessQuarantineResultDto
            {
                Success = true,
                Message = "Quarantined record successfully repaired, normalized, and promoted to active records.",
                PromotedRecordId = newRecord.Id
            };
        }

        // =========================================================================
        // 5. HELPER NORMALIZATION ALGORITHMS
        // =========================================================================

        private static string CleanTitle(string title)
        {
            var text = WebUtility.HtmlDecode(title);
            // Remove HTML tags
            text = Regex.Replace(text, "<.*?>", string.Empty);
            // Remove LaTeX formatting commands like \textbf{...}, \emph{...}, \math{...}
            text = Regex.Replace(text, @"\\[a-zA-Z]+(\{[^}]*\})?", "$1");
            // Remove math delimiters $ ... $
            text = Regex.Replace(text, @"\$+([^$]+)\$+", "$1");
            // Clean curly braces and escape slashes
            text = text.Replace("{", "").Replace("}", "").Replace("\\", "");
            // Normalize Unicode
            text = text.Normalize(NormalizationForm.FormC);
            // Collapse whitespace
            text = Regex.Replace(text, @"\s+", " ").Trim();
            return text;
        }

        private static string ComputeTitleHash(string title)
        {
            if (string.IsNullOrWhiteSpace(title)) return string.Empty;
            var alphanumeric = Regex.Replace(title.ToLowerInvariant(), @"[^a-z0-9]", "");
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(alphanumeric));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private static string? CanonicalizeDoi(string? doi)
        {
            if (string.IsNullOrWhiteSpace(doi)) return null;
            var clean = doi.Trim().ToLowerInvariant();
            clean = clean.Replace("https://doi.org/", "")
                         .Replace("http://dx.doi.org/", "")
                         .Replace("http://doi.org/", "")
                         .Replace("doi:", "");
            return clean.Trim('/');
        }

        private static (string FormattedAuthors, string FirstAuthor) StandardizeAuthors(string? authorsInput)
        {
            if (string.IsNullOrWhiteSpace(authorsInput))
            {
                return ("Unknown Author", string.Empty);
            }

            var clean = authorsInput.Trim();
            clean = Regex.Replace(clean, @"\bet al\.?\b", "", RegexOptions.IgnoreCase);
            clean = Regex.Replace(clean, @"\band others\b", "", RegexOptions.IgnoreCase);

            var tokens = clean.Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(t => Regex.Replace(t, @"\s+", " ").Trim())
                .Where(t => !string.IsNullOrEmpty(t))
                .ToList();

            if (!tokens.Any())
            {
                return ("Unknown Author", string.Empty);
            }

            var firstAuthor = tokens.First();
            var formatted = string.Join(", ", tokens);
            return (formatted, firstAuthor);
        }

        private static string? SanitizeUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return null;
            var trimmed = url.Trim();
            if (!trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return $"https://{trimmed}";
            }
            return trimmed;
        }

        private static double CalculateJaccardSimilarity(string s1, string s2)
        {
            var set1 = new HashSet<string>(Regex.Split(s1.ToLowerInvariant(), @"\W+").Where(w => w.Length > 2));
            var set2 = new HashSet<string>(Regex.Split(s2.ToLowerInvariant(), @"\W+").Where(w => w.Length > 2));

            if (!set1.Any() && !set2.Any()) return 1.0;
            if (!set1.Any() || !set2.Any()) return 0.0;

            int intersection = set1.Count(set2.Contains);
            int union = set1.Count + set2.Count - intersection;

            return union > 0 ? (double)intersection / union : 0.0;
        }
    }
}
