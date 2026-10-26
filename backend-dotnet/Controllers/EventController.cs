using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
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
    [Route("api/events")]
    [ApiController]
    public class EventController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public EventController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        private string GetCurrentUserRole()
        {
            return User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
        }

        // =========================================================================
        // 1. SEARCH & FILTER ACADEMIC EVENTS (PAGINATED)
        // GET /api/events?search=vision&eventType=Conference&fieldOfStudy=AI&isVirtual=true&hasOpenCfp=true&page=1&pageSize=12
        // =========================================================================
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetEvents(
            [FromQuery] string? search = null,
            [FromQuery] string? eventType = null,
            [FromQuery] string? fieldOfStudy = null,
            [FromQuery] bool? isVirtual = null,
            [FromQuery] bool? hasOpenCfp = null,
            [FromQuery] int? deadlineWithinDays = null,
            [FromQuery] string? status = null,
            [FromQuery] string? sort = "deadline",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 12)
        {
            var currentUserId = GetCurrentUserId();
            var query = _context.AcademicEvents
                .Include(e => e.PostedBy)
                .AsQueryable();

            // Status filter
            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(e => e.Status.ToLower() == status.ToLower());
            }
            else if (string.IsNullOrWhiteSpace(status))
            {
                // Default to active / upcoming
                query = query.Where(e => e.Status != "Cancelled");
            }

            // EventType filter
            if (!string.IsNullOrWhiteSpace(eventType) && !eventType.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(e => e.EventType.ToLower() == eventType.ToLower());
            }

            // Field of Study filter
            if (!string.IsNullOrWhiteSpace(fieldOfStudy) && !fieldOfStudy.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(e => e.FieldOfStudy.ToLower().Contains(fieldOfStudy.ToLower()));
            }

            // Virtual / In-Person filter
            if (isVirtual.HasValue)
            {
                query = query.Where(e => e.IsVirtual == isVirtual.Value);
            }

            // Open CFP filter (submission deadline is in the future)
            if (hasOpenCfp.HasValue && hasOpenCfp.Value)
            {
                var now = DateTime.UtcNow;
                query = query.Where(e => e.SubmissionDeadline.HasValue && e.SubmissionDeadline.Value >= now);
            }

            // Impending Deadline Window (e.g. next 30 days)
            if (deadlineWithinDays.HasValue && deadlineWithinDays.Value > 0)
            {
                var now = DateTime.UtcNow;
                var maxDate = now.AddDays(deadlineWithinDays.Value);
                query = query.Where(e => e.SubmissionDeadline.HasValue &&
                                         e.SubmissionDeadline.Value >= now &&
                                         e.SubmissionDeadline.Value <= maxDate);
            }

            // Keyword Search across title, organizer, description, field, and location
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(e =>
                    e.Title.ToLower().Contains(s) ||
                    e.Organizer.ToLower().Contains(s) ||
                    e.Description.ToLower().Contains(s) ||
                    e.FieldOfStudy.ToLower().Contains(s) ||
                    (e.Location != null && e.Location.ToLower().Contains(s)));
            }

            // Sorting
            query = sort?.ToLower() switch
            {
                "date" => query.OrderBy(e => e.StartDate ?? DateTime.MaxValue).ThenBy(e => e.CreatedAt),
                "title" => query.OrderBy(e => e.Title),
                "newest" => query.OrderByDescending(e => e.CreatedAt),
                _ => query.OrderBy(e => e.SubmissionDeadline == null)
                          .ThenBy(e => e.SubmissionDeadline ?? DateTime.MaxValue)
                          .ThenBy(e => e.StartDate ?? DateTime.MaxValue)
            };

            var totalCount = await query.CountAsync();
            var skip = (Math.Max(1, page) - 1) * pageSize;
            var events = await query.Skip(skip).Take(pageSize).ToListAsync();

            // Bookmarks map for logged in user
            var eventIds = events.Select(e => e.Id).ToList();
            Dictionary<int, EventBookmark> userBookmarks = new();

            if (currentUserId > 0)
            {
                userBookmarks = await _context.EventBookmarks
                    .Where(b => b.UserId == currentUserId && eventIds.Contains(b.EventId))
                    .ToDictionaryAsync(b => b.EventId);
            }

            var nowUtc = DateTime.UtcNow;

            var items = events.Select(e =>
            {
                userBookmarks.TryGetValue(e.Id, out var bookmark);
                int? daysRemainingSubmission = e.SubmissionDeadline.HasValue
                    ? (int)Math.Ceiling((e.SubmissionDeadline.Value - nowUtc).TotalDays)
                    : null;

                int? daysRemainingRegistration = e.RegistrationDeadline.HasValue
                    ? (int)Math.Ceiling((e.RegistrationDeadline.Value - nowUtc).TotalDays)
                    : null;

                return new AcademicEventDto
                {
                    Id = e.Id,
                    Title = e.Title,
                    Organizer = e.Organizer,
                    EventType = e.EventType,
                    Description = e.Description,
                    FieldOfStudy = e.FieldOfStudy,
                    Location = e.Location,
                    IsVirtual = e.IsVirtual,
                    StartDate = e.StartDate,
                    EndDate = e.EndDate,
                    SubmissionDeadline = e.SubmissionDeadline,
                    RegistrationDeadline = e.RegistrationDeadline,
                    WebsiteUrl = e.WebsiteUrl,
                    RegistrationUrl = e.RegistrationUrl,
                    Source = e.Source,
                    Status = e.Status,
                    PostedById = e.PostedById,
                    PostedByName = e.PostedBy?.FullName ?? "ResCollab Discovery",
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt,
                    DaysRemainingForSubmission = daysRemainingSubmission,
                    DaysRemainingForRegistration = daysRemainingRegistration,
                    IsBookmarked = bookmark != null,
                    BookmarkId = bookmark?.Id,
                    BookmarkNotes = bookmark?.Notes,
                    IsSubmitter = currentUserId > 0 && e.PostedById == currentUserId
                };
            }).ToList();

            var result = new PaginatedEventsResultDto
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };

            return Ok(result);
        }

        // =========================================================================
        // 2. GET SINGLE EVENT DETAILS
        // GET /api/events/{id}
        // =========================================================================
        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetEventById(int id)
        {
            var currentUserId = GetCurrentUserId();

            var ev = await _context.AcademicEvents
                .Include(e => e.PostedBy)
                .Include(e => e.Bookmarks)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (ev == null)
            {
                return NotFound(new { message = $"Academic event with ID {id} was not found." });
            }

            EventBookmark? userBookmark = null;
            if (currentUserId > 0)
            {
                userBookmark = ev.Bookmarks.FirstOrDefault(b => b.UserId == currentUserId);
            }

            var nowUtc = DateTime.UtcNow;
            int? daysRemainingSubmission = ev.SubmissionDeadline.HasValue
                ? (int)Math.Ceiling((ev.SubmissionDeadline.Value - nowUtc).TotalDays)
                : null;

            int? daysRemainingRegistration = ev.RegistrationDeadline.HasValue
                ? (int)Math.Ceiling((ev.RegistrationDeadline.Value - nowUtc).TotalDays)
                : null;

            var dto = new AcademicEventDetailDto
            {
                Id = ev.Id,
                Title = ev.Title,
                Organizer = ev.Organizer,
                EventType = ev.EventType,
                Description = ev.Description,
                FieldOfStudy = ev.FieldOfStudy,
                Location = ev.Location,
                IsVirtual = ev.IsVirtual,
                StartDate = ev.StartDate,
                EndDate = ev.EndDate,
                SubmissionDeadline = ev.SubmissionDeadline,
                RegistrationDeadline = ev.RegistrationDeadline,
                WebsiteUrl = ev.WebsiteUrl,
                RegistrationUrl = ev.RegistrationUrl,
                Source = ev.Source,
                Status = ev.Status,
                PostedById = ev.PostedById,
                PostedByName = ev.PostedBy?.FullName ?? "ResCollab Discovery",
                CreatedAt = ev.CreatedAt,
                UpdatedAt = ev.UpdatedAt,
                DaysRemainingForSubmission = daysRemainingSubmission,
                DaysRemainingForRegistration = daysRemainingRegistration,
                IsBookmarked = userBookmark != null,
                BookmarkId = userBookmark?.Id,
                BookmarkNotes = userBookmark?.Notes,
                TotalBookmarksCount = ev.Bookmarks.Count,
                IsSubmitter = currentUserId > 0 && ev.PostedById == currentUserId
            };

            return Ok(dto);
        }

        // =========================================================================
        // 3. CREATE RESEARCH EVENT / CFP
        // POST /api/events
        // =========================================================================
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateEvent([FromBody] CreateEventRequest req)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId <= 0) return Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Title))
            {
                return BadRequest(new { message = "Event title is required." });
            }

            if (string.IsNullOrWhiteSpace(req.Organizer))
            {
                return BadRequest(new { message = "Organizer is required." });
            }

            if (string.IsNullOrWhiteSpace(req.Description))
            {
                return BadRequest(new { message = "Event description cannot be empty." });
            }

            if (req.StartDate.HasValue && req.EndDate.HasValue && req.EndDate.Value < req.StartDate.Value)
            {
                return BadRequest(new { message = "Event end date cannot be earlier than start date." });
            }

            var academicEvent = new AcademicEvent
            {
                Title = req.Title.Trim(),
                Organizer = req.Organizer.Trim(),
                EventType = string.IsNullOrWhiteSpace(req.EventType) ? "Conference" : req.EventType.Trim(),
                Description = req.Description.Trim(),
                FieldOfStudy = string.IsNullOrWhiteSpace(req.FieldOfStudy) ? "General" : req.FieldOfStudy.Trim(),
                Location = req.Location?.Trim(),
                IsVirtual = req.IsVirtual,
                StartDate = req.StartDate,
                EndDate = req.EndDate,
                SubmissionDeadline = req.SubmissionDeadline,
                RegistrationDeadline = req.RegistrationDeadline,
                WebsiteUrl = SanitizeUrl(req.WebsiteUrl),
                RegistrationUrl = SanitizeUrl(req.RegistrationUrl),
                Source = string.IsNullOrWhiteSpace(req.Source) ? "Manual Submission" : req.Source.Trim(),
                Status = string.IsNullOrWhiteSpace(req.Status) ? "Upcoming" : req.Status.Trim(),
                PostedById = currentUserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.AcademicEvents.Add(academicEvent);
            await _context.SaveChangesAsync();

            var author = await _context.Users.FindAsync(currentUserId);

            var createdDto = new AcademicEventDto
            {
                Id = academicEvent.Id,
                Title = academicEvent.Title,
                Organizer = academicEvent.Organizer,
                EventType = academicEvent.EventType,
                Description = academicEvent.Description,
                FieldOfStudy = academicEvent.FieldOfStudy,
                Location = academicEvent.Location,
                IsVirtual = academicEvent.IsVirtual,
                StartDate = academicEvent.StartDate,
                EndDate = academicEvent.EndDate,
                SubmissionDeadline = academicEvent.SubmissionDeadline,
                RegistrationDeadline = academicEvent.RegistrationDeadline,
                WebsiteUrl = academicEvent.WebsiteUrl,
                RegistrationUrl = academicEvent.RegistrationUrl,
                Source = academicEvent.Source,
                Status = academicEvent.Status,
                PostedById = currentUserId,
                PostedByName = author?.FullName ?? "Researcher",
                CreatedAt = academicEvent.CreatedAt,
                UpdatedAt = academicEvent.UpdatedAt,
                DaysRemainingForSubmission = academicEvent.SubmissionDeadline.HasValue
                    ? (int)Math.Ceiling((academicEvent.SubmissionDeadline.Value - DateTime.UtcNow).TotalDays)
                    : null,
                DaysRemainingForRegistration = academicEvent.RegistrationDeadline.HasValue
                    ? (int)Math.Ceiling((academicEvent.RegistrationDeadline.Value - DateTime.UtcNow).TotalDays)
                    : null,
                IsBookmarked = false,
                IsSubmitter = true
            };

            return CreatedAtAction(nameof(GetEventById), new { id = academicEvent.Id }, createdDto);
        }

        // =========================================================================
        // 4. UPDATE ACADEMIC EVENT
        // PUT /api/events/{id}
        // =========================================================================
        [HttpPut("{id:int}")]
        [Authorize]
        public async Task<IActionResult> UpdateEvent(int id, [FromBody] UpdateEventRequest req)
        {
            var currentUserId = GetCurrentUserId();
            var currentUserRole = GetCurrentUserRole();

            var ev = await _context.AcademicEvents.FirstOrDefaultAsync(e => e.Id == id);
            if (ev == null)
            {
                return NotFound(new { message = $"Academic event with ID {id} was not found." });
            }

            var isSubmitter = ev.PostedById == currentUserId;
            var isAdmin = currentUserRole == "Admin" || currentUserRole == "Moderator";

            if (!isSubmitter && !isAdmin)
            {
                return Forbid();
            }

            if (!string.IsNullOrWhiteSpace(req.Title)) ev.Title = req.Title.Trim();
            if (!string.IsNullOrWhiteSpace(req.Organizer)) ev.Organizer = req.Organizer.Trim();
            if (!string.IsNullOrWhiteSpace(req.EventType)) ev.EventType = req.EventType.Trim();
            if (!string.IsNullOrWhiteSpace(req.Description)) ev.Description = req.Description.Trim();
            if (!string.IsNullOrWhiteSpace(req.FieldOfStudy)) ev.FieldOfStudy = req.FieldOfStudy.Trim();
            if (req.Location != null) ev.Location = req.Location.Trim();
            if (req.IsVirtual.HasValue) ev.IsVirtual = req.IsVirtual.Value;
            if (req.StartDate.HasValue) ev.StartDate = req.StartDate.Value;
            if (req.EndDate.HasValue) ev.EndDate = req.EndDate.Value;
            if (req.SubmissionDeadline.HasValue) ev.SubmissionDeadline = req.SubmissionDeadline.Value;
            if (req.RegistrationDeadline.HasValue) ev.RegistrationDeadline = req.RegistrationDeadline.Value;
            if (req.WebsiteUrl != null) ev.WebsiteUrl = SanitizeUrl(req.WebsiteUrl);
            if (req.RegistrationUrl != null) ev.RegistrationUrl = SanitizeUrl(req.RegistrationUrl);
            if (!string.IsNullOrWhiteSpace(req.Status)) ev.Status = req.Status.Trim();

            ev.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Event updated successfully.", eventId = ev.Id });
        }

        // =========================================================================
        // 5. DELETE ACADEMIC EVENT
        // DELETE /api/events/{id}
        // =========================================================================
        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteEvent(int id)
        {
            var currentUserId = GetCurrentUserId();
            var currentUserRole = GetCurrentUserRole();

            var ev = await _context.AcademicEvents.FirstOrDefaultAsync(e => e.Id == id);
            if (ev == null)
            {
                return NotFound(new { message = $"Academic event with ID {id} was not found." });
            }

            var isSubmitter = ev.PostedById == currentUserId;
            var isAdmin = currentUserRole == "Admin" || currentUserRole == "Moderator";

            if (!isSubmitter && !isAdmin)
            {
                return Forbid();
            }

            _context.AcademicEvents.Remove(ev);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Academic event deleted successfully.", eventId = id });
        }

        // =========================================================================
        // 6. TOGGLE EVENT BOOKMARK
        // POST /api/events/{id}/bookmark
        // =========================================================================
        [HttpPost("{id:int}/bookmark")]
        [Authorize]
        public async Task<IActionResult> ToggleBookmark(int id, [FromBody] BookmarkEventRequest? req)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId <= 0) return Unauthorized();

            var ev = await _context.AcademicEvents.FirstOrDefaultAsync(e => e.Id == id);
            if (ev == null)
            {
                return NotFound(new { message = $"Academic event with ID {id} was not found." });
            }

            var existingBookmark = await _context.EventBookmarks
                .FirstOrDefaultAsync(b => b.EventId == id && b.UserId == currentUserId);

            if (existingBookmark != null)
            {
                // Remove bookmark
                _context.EventBookmarks.Remove(existingBookmark);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    eventId = id,
                    isBookmarked = false,
                    message = "Event removed from saved bookmarks."
                });
            }
            else
            {
                // Add bookmark
                var bookmark = new EventBookmark
                {
                    EventId = id,
                    UserId = currentUserId,
                    Notes = req?.Notes?.Trim(),
                    CreatedAt = DateTime.UtcNow
                };

                _context.EventBookmarks.Add(bookmark);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    eventId = id,
                    isBookmarked = true,
                    bookmarkId = bookmark.Id,
                    notes = bookmark.Notes,
                    message = "Event bookmarked successfully."
                });
            }
        }

        // =========================================================================
        // 7. GET MY BOOKMARKED EVENTS
        // GET /api/events/my-bookmarks
        // =========================================================================
        [HttpGet("my-bookmarks")]
        [Authorize]
        public async Task<IActionResult> GetMyBookmarks()
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId <= 0) return Unauthorized();

            var bookmarks = await _context.EventBookmarks
                .Include(b => b.Event)
                    .ThenInclude(e => e!.PostedBy)
                .Where(b => b.UserId == currentUserId)
                .OrderBy(b => b.Event!.SubmissionDeadline ?? DateTime.MaxValue)
                .ThenBy(b => b.Event!.StartDate ?? DateTime.MaxValue)
                .ToListAsync();

            var nowUtc = DateTime.UtcNow;

            var items = bookmarks
                .Where(b => b.Event != null)
                .Select(b =>
                {
                    var e = b.Event!;
                    int? daysRemainingSubmission = e.SubmissionDeadline.HasValue
                        ? (int)Math.Ceiling((e.SubmissionDeadline.Value - nowUtc).TotalDays)
                        : null;

                    int? daysRemainingRegistration = e.RegistrationDeadline.HasValue
                        ? (int)Math.Ceiling((e.RegistrationDeadline.Value - nowUtc).TotalDays)
                        : null;

                    return new AcademicEventDto
                    {
                        Id = e.Id,
                        Title = e.Title,
                        Organizer = e.Organizer,
                        EventType = e.EventType,
                        Description = e.Description,
                        FieldOfStudy = e.FieldOfStudy,
                        Location = e.Location,
                        IsVirtual = e.IsVirtual,
                        StartDate = e.StartDate,
                        EndDate = e.EndDate,
                        SubmissionDeadline = e.SubmissionDeadline,
                        RegistrationDeadline = e.RegistrationDeadline,
                        WebsiteUrl = e.WebsiteUrl,
                        RegistrationUrl = e.RegistrationUrl,
                        Source = e.Source,
                        Status = e.Status,
                        PostedById = e.PostedById,
                        PostedByName = e.PostedBy?.FullName ?? "ResCollab Discovery",
                        CreatedAt = e.CreatedAt,
                        UpdatedAt = e.UpdatedAt,
                        DaysRemainingForSubmission = daysRemainingSubmission,
                        DaysRemainingForRegistration = daysRemainingRegistration,
                        IsBookmarked = true,
                        BookmarkId = b.Id,
                        BookmarkNotes = b.Notes,
                        IsSubmitter = e.PostedById == currentUserId
                    };
                }).ToList();

            return Ok(items);
        }

        // =========================================================================
        // 8. UPCOMING DEADLINES (NEXT X DAYS)
        // GET /api/events/upcoming-deadlines?days=30
        // =========================================================================
        [HttpGet("upcoming-deadlines")]
        [AllowAnonymous]
        public async Task<IActionResult> GetUpcomingDeadlines([FromQuery] int days = 30)
        {
            var now = DateTime.UtcNow;
            var maxDate = now.AddDays(Math.Max(1, days));

            var events = await _context.AcademicEvents
                .Where(e => e.Status != "Cancelled" &&
                            e.SubmissionDeadline.HasValue &&
                            e.SubmissionDeadline.Value >= now &&
                            e.SubmissionDeadline.Value <= maxDate)
                .OrderBy(e => e.SubmissionDeadline!.Value)
                .Take(20)
                .ToListAsync();

            var deadlines = events.Select(e =>
            {
                var daysRemaining = (int)Math.Ceiling((e.SubmissionDeadline!.Value - now).TotalDays);
                var urgency = daysRemaining switch
                {
                    <= 3 => "critical",
                    <= 7 => "high",
                    <= 14 => "medium",
                    _ => "normal"
                };

                return new AcademicEventDeadlineDto
                {
                    EventId = e.Id,
                    Title = e.Title,
                    Organizer = e.Organizer,
                    EventType = e.EventType,
                    FieldOfStudy = e.FieldOfStudy,
                    SubmissionDeadline = e.SubmissionDeadline!.Value,
                    DaysRemaining = daysRemaining,
                    UrgencyLevel = urgency,
                    IsVirtual = e.IsVirtual,
                    WebsiteUrl = e.WebsiteUrl
                };
            }).ToList();

            return Ok(deadlines);
        }

        // =========================================================================
        // 9. EVENT FILTERS & TAXONOMY FACETS
        // GET /api/events/facets
        // GET /api/events/filters
        // =========================================================================
        [HttpGet("facets")]
        [HttpGet("filters")]
        [AllowAnonymous]
        public async Task<IActionResult> GetFacets()
        {
            var now = DateTime.UtcNow;

            var totalEvents = await _context.AcademicEvents.CountAsync();
            var upcomingEvents = await _context.AcademicEvents
                .CountAsync(e => e.Status == "Upcoming" || e.Status == "Ongoing");
            var openCfpCount = await _context.AcademicEvents
                .CountAsync(e => e.SubmissionDeadline.HasValue && e.SubmissionDeadline.Value >= now);
            var virtualCount = await _context.AcademicEvents
                .CountAsync(e => e.IsVirtual);

            var eventTypes = await _context.AcademicEvents
                .GroupBy(e => e.EventType)
                .Select(g => new FacetItemDto { Name = g.Key, Count = g.Count() })
                .OrderByDescending(f => f.Count)
                .ToListAsync();

            var fieldsOfStudy = await _context.AcademicEvents
                .GroupBy(e => e.FieldOfStudy)
                .Select(g => new FacetItemDto { Name = g.Key, Count = g.Count() })
                .OrderByDescending(f => f.Count)
                .Take(12)
                .ToListAsync();

            return Ok(new EventFacetsDto
            {
                TotalEvents = totalEvents,
                UpcomingEvents = upcomingEvents,
                OpenCfpCount = openCfpCount,
                VirtualCount = virtualCount,
                EventTypes = eventTypes,
                FieldsOfStudy = fieldsOfStudy
            });
        }

        // =========================================================================
        // HELPER METHODS
        // =========================================================================
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
    }

    // =========================================================================
    // DTO REQUEST / RESPONSE MODELS
    // =========================================================================

    public class CreateEventRequest
    {
        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        public string Organizer { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string EventType { get; set; } = "Conference";

        [Required]
        [MaxLength(4000)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string FieldOfStudy { get; set; } = "General";

        [MaxLength(300)]
        public string? Location { get; set; }

        public bool IsVirtual { get; set; } = false;

        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? SubmissionDeadline { get; set; }
        public DateTime? RegistrationDeadline { get; set; }

        [MaxLength(1000)]
        public string? WebsiteUrl { get; set; }

        [MaxLength(1000)]
        public string? RegistrationUrl { get; set; }

        public string? Source { get; set; } = "Manual Submission";
        public string? Status { get; set; } = "Upcoming";
    }

    public class UpdateEventRequest
    {
        public string? Title { get; set; }
        public string? Organizer { get; set; }
        public string? EventType { get; set; }
        public string? Description { get; set; }
        public string? FieldOfStudy { get; set; }
        public string? Location { get; set; }
        public bool? IsVirtual { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? SubmissionDeadline { get; set; }
        public DateTime? RegistrationDeadline { get; set; }
        public string? WebsiteUrl { get; set; }
        public string? RegistrationUrl { get; set; }
        public string? Status { get; set; }
    }

    public class BookmarkEventRequest
    {
        [MaxLength(500)]
        public string? Notes { get; set; }
    }

    public class AcademicEventDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Organizer { get; set; } = string.Empty;
        public string EventType { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string FieldOfStudy { get; set; } = string.Empty;
        public string? Location { get; set; }
        public bool IsVirtual { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? SubmissionDeadline { get; set; }
        public DateTime? RegistrationDeadline { get; set; }
        public string? WebsiteUrl { get; set; }
        public string? RegistrationUrl { get; set; }
        public string Source { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int? PostedById { get; set; }
        public string PostedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int? DaysRemainingForSubmission { get; set; }
        public int? DaysRemainingForRegistration { get; set; }
        public bool IsBookmarked { get; set; }
        public int? BookmarkId { get; set; }
        public string? BookmarkNotes { get; set; }
        public bool IsSubmitter { get; set; }
    }

    public class AcademicEventDetailDto : AcademicEventDto
    {
        public int TotalBookmarksCount { get; set; }
    }

    public class PaginatedEventsResultDto
    {
        public List<AcademicEventDto> Items { get; set; } = new List<AcademicEventDto>();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    public class AcademicEventDeadlineDto
    {
        public int EventId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Organizer { get; set; } = string.Empty;
        public string EventType { get; set; } = string.Empty;
        public string FieldOfStudy { get; set; } = string.Empty;
        public DateTime SubmissionDeadline { get; set; }
        public int DaysRemaining { get; set; }
        public string UrgencyLevel { get; set; } = "normal"; // "critical", "high", "medium", "normal"
        public bool IsVirtual { get; set; }
        public string? WebsiteUrl { get; set; }
    }

    public class EventFacetsDto
    {
        public int TotalEvents { get; set; }
        public int UpcomingEvents { get; set; }
        public int OpenCfpCount { get; set; }
        public int VirtualCount { get; set; }
        public List<FacetItemDto> EventTypes { get; set; } = new List<FacetItemDto>();
        public List<FacetItemDto> FieldsOfStudy { get; set; } = new List<FacetItemDto>();
    }

    public class FacetItemDto
    {
        public string Name { get; set; } = string.Empty;
        public int Count { get; set; }
    }
}
