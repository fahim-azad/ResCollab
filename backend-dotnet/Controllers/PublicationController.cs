using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PublicationController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public PublicationController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        // =============================================
        // READ ENDPOINTS
        // =============================================

        // GET /api/publication?ownerId=X&publicationType=Y&year=Z&doi=D&journalOrConference=J&search=S
        [HttpGet]
        public async Task<IActionResult> GetPublications(
            [FromQuery] int? ownerId,
            [FromQuery] string? publicationType,
            [FromQuery] int? year,
            [FromQuery] string? doi,
            [FromQuery] string? journalOrConference,
            [FromQuery] string? search)
        {
            var query = _context.Publications
                .Include(p => p.Owner)
                .Where(p => p.Visibility == "Public");

            if (ownerId.HasValue)
                query = query.Where(p => p.OwnerId == ownerId.Value);

            if (!string.IsNullOrWhiteSpace(publicationType))
                query = query.Where(p => p.PublicationType == publicationType);

            if (year.HasValue)
                query = query.Where(p => p.PublicationYear == year.Value);

            if (!string.IsNullOrWhiteSpace(doi))
            {
                var normDoi = NormalizeDoi(doi);
                query = query.Where(p => p.DOI != null && (p.DOI == normDoi || p.DOI.Contains(doi)));
            }

            if (!string.IsNullOrWhiteSpace(journalOrConference))
                query = query.Where(p => p.JournalOrConference != null && p.JournalOrConference.Contains(journalOrConference));

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(p =>
                    p.Title.Contains(search) ||
                    p.Authors.Contains(search) ||
                    (p.DOI != null && p.DOI.Contains(search)) ||
                    (p.JournalOrConference != null && p.JournalOrConference.Contains(search)));

            var results = await query
                .OrderByDescending(p => p.PublicationYear)
                .ThenByDescending(p => p.CreatedAt)
                .Select(p => new {
                    p.Id,
                    p.OwnerId,
                    OwnerName = p.Owner != null ? p.Owner.FullName : null,
                    p.Title,
                    p.Authors,
                    p.DOI,
                    p.JournalOrConference,
                    p.PublicationYear,
                    p.PublicationType,
                    p.SourceLink,
                    p.Visibility,
                    p.CreatedAt
                })
                .ToListAsync();

            return Ok(results);
        }

        // GET /api/publication/my
        [HttpGet("my")]
        public async Task<IActionResult> GetMyPublications()
        {
            var userId = GetUserId();
            var publications = await _context.Publications
                .Where(p => p.OwnerId == userId)
                .OrderByDescending(p => p.PublicationYear)
                .ThenByDescending(p => p.CreatedAt)
                .ToListAsync();

            return Ok(publications);
        }

        // GET /api/publication/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetPublication(int id)
        {
            var pub = await _context.Publications
                .Include(p => p.Owner)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pub == null) return NotFound("Publication not found.");

            var userId = GetUserId();
            if (pub.Visibility == "Private" && pub.OwnerId != userId)
                return Forbid();

            return Ok(new {
                pub.Id,
                pub.OwnerId,
                OwnerName = pub.Owner?.FullName,
                pub.Title,
                pub.Authors,
                pub.DOI,
                pub.JournalOrConference,
                pub.PublicationYear,
                pub.Abstract,
                pub.SourceLink,
                pub.PublicationType,
                pub.Visibility,
                pub.CreatedAt,
                pub.UpdatedAt
            });
        }

        // =============================================
        // WRITE ENDPOINTS WITH VALIDATION
        // =============================================

        public class PublicationRequest
        {
            public string Title { get; set; } = string.Empty;
            public string Authors { get; set; } = string.Empty;
            public string? DOI { get; set; }
            public string? JournalOrConference { get; set; }
            public int PublicationYear { get; set; }
            public string? Abstract { get; set; }
            public string? SourceLink { get; set; }
            public string PublicationType { get; set; } = "Journal";
            public string Visibility { get; set; } = "Public";
        }

        public static string? NormalizeDoi(string? doi)
        {
            if (string.IsNullOrWhiteSpace(doi)) return null;
            var trimmed = doi.Trim();
            if (trimmed.StartsWith("https://doi.org/", StringComparison.OrdinalIgnoreCase))
                trimmed = trimmed.Substring("https://doi.org/".Length);
            else if (trimmed.StartsWith("http://doi.org/", StringComparison.OrdinalIgnoreCase))
                trimmed = trimmed.Substring("http://doi.org/".Length);
            else if (trimmed.StartsWith("https://dx.doi.org/", StringComparison.OrdinalIgnoreCase))
                trimmed = trimmed.Substring("https://dx.doi.org/".Length);
            else if (trimmed.StartsWith("http://dx.doi.org/", StringComparison.OrdinalIgnoreCase))
                trimmed = trimmed.Substring("http://dx.doi.org/".Length);
            else if (trimmed.StartsWith("doi:", StringComparison.OrdinalIgnoreCase))
                trimmed = trimmed.Substring("doi:".Length);

            return trimmed.Trim().Trim('/');
        }

        public static string? NormalizeSourceLink(string? link)
        {
            if (string.IsNullOrWhiteSpace(link)) return null;
            var trimmed = link.Trim();
            if (trimmed.Contains("://"))
            {
                return trimmed;
            }
            if (!trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                trimmed = "https://" + trimmed;
            }
            return trimmed;
        }

        public static string? ValidatePublicationRequest(PublicationRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Title))
                return "Title is required.";

            if (string.IsNullOrWhiteSpace(req.Authors))
                return "Authors field is required.";

            int currentYear = DateTime.UtcNow.Year;
            if (req.PublicationYear < 1900 || req.PublicationYear > currentYear + 1)
                return $"Publication year must be between 1900 and {currentYear + 1}.";

            var validTypes = new[] { "Journal", "Conference", "Book", "Thesis", "Preprint", "Other" };
            if (!validTypes.Contains(req.PublicationType))
                return "Invalid publication type. Must be: Journal, Conference, Book, Thesis, Preprint, or Other.";

            var validVisibility = new[] { "Public", "Private" };
            if (!validVisibility.Contains(req.Visibility))
                return "Visibility must be 'Public' or 'Private'.";

            var normDoi = NormalizeDoi(req.DOI);
            var normLink = NormalizeSourceLink(req.SourceLink);

            // At least one identifying field must be provided
            if (string.IsNullOrWhiteSpace(normDoi) &&
                string.IsNullOrWhiteSpace(req.JournalOrConference) &&
                string.IsNullOrWhiteSpace(normLink))
                return "At least one of DOI, Journal/Conference, or Source Link must be provided.";

            // Basic DOI format check: should start with "10." and contain a registrant delimiter '/'
            if (!string.IsNullOrWhiteSpace(normDoi))
            {
                if (!normDoi.StartsWith("10.") || !normDoi.Contains('/'))
                    return "DOI format appears invalid. Standard DOIs begin with '10.' followed by a registrant code and suffix (e.g. 10.1109/TSE.2024.1234567).";
            }

            // Source link validation: valid URI
            if (!string.IsNullOrWhiteSpace(normLink))
            {
                if (!Uri.TryCreate(normLink, UriKind.Absolute, out var uriResult) ||
                    (uriResult.Scheme != Uri.UriSchemeHttp && uriResult.Scheme != Uri.UriSchemeHttps))
                {
                    return "Source link must be a valid HTTP or HTTPS URL.";
                }
            }

            return null; // valid
        }

        // POST /api/publication
        [HttpPost]
        public async Task<IActionResult> CreatePublication([FromBody] PublicationRequest req)
        {
            var validationError = ValidatePublicationRequest(req);
            if (validationError != null) return BadRequest(validationError);

            var userId = GetUserId();

            var publication = new Publication
            {
                OwnerId = userId,
                Title = req.Title.Trim(),
                Authors = req.Authors.Trim(),
                DOI = NormalizeDoi(req.DOI),
                JournalOrConference = req.JournalOrConference?.Trim(),
                PublicationYear = req.PublicationYear,
                Abstract = req.Abstract?.Trim(),
                SourceLink = NormalizeSourceLink(req.SourceLink),
                PublicationType = req.PublicationType,
                Visibility = req.Visibility
            };

            _context.Publications.Add(publication);
            await _context.SaveChangesAsync();
            return StatusCode(201, publication);
        }

        // PUT /api/publication/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePublication(int id, [FromBody] PublicationRequest req)
        {
            var validationError = ValidatePublicationRequest(req);
            if (validationError != null) return BadRequest(validationError);

            var userId = GetUserId();
            var pub = await _context.Publications.FindAsync(id);

            if (pub == null) return NotFound("Publication not found.");
            if (pub.OwnerId != userId) return Forbid();

            pub.Title = req.Title.Trim();
            pub.Authors = req.Authors.Trim();
            pub.DOI = NormalizeDoi(req.DOI);
            pub.JournalOrConference = req.JournalOrConference?.Trim();
            pub.PublicationYear = req.PublicationYear;
            pub.Abstract = req.Abstract?.Trim();
            pub.SourceLink = NormalizeSourceLink(req.SourceLink);
            pub.PublicationType = req.PublicationType;
            pub.Visibility = req.Visibility;
            pub.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(pub);
        }

        // DELETE /api/publication/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePublication(int id)
        {
            var userId = GetUserId();
            var pub = await _context.Publications.FindAsync(id);

            if (pub == null) return NotFound("Publication not found.");
            if (pub.OwnerId != userId) return Forbid();

            _context.Publications.Remove(pub);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Publication deleted." });
        }

        // PATCH /api/publication/{id}/visibility
        [HttpPatch("{id}/visibility")]
        public async Task<IActionResult> UpdateVisibility(int id, [FromBody] string visibility)
        {
            var userId = GetUserId();
            var pub = await _context.Publications.FindAsync(id);

            if (pub == null) return NotFound("Publication not found.");
            if (pub.OwnerId != userId) return Forbid();

            var valid = new[] { "Public", "Private" };
            if (!valid.Contains(visibility))
                return BadRequest("Visibility must be 'Public' or 'Private'.");

            pub.Visibility = visibility;
            pub.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Visibility updated to {visibility}." });
        }
    }
}
