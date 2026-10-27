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
    [Route("api/reports")]
    [ApiController]
    [Authorize]
    public class ReportController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ReportController(ApplicationDbContext context)
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

        private bool IsModeratorOrAdmin()
        {
            var role = GetCurrentUserRole();
            return role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                   role.Equals("Moderator", StringComparison.OrdinalIgnoreCase) ||
                   role.Equals("InstitutionalAdmin", StringComparison.OrdinalIgnoreCase);
        }

        // =========================================================================
        // 1. SUBMIT CONTENT OR USER REPORT
        // POST /api/reports
        // =========================================================================
        [HttpPost]
        public async Task<IActionResult> SubmitReport([FromBody] CreateReportDto req)
        {
            var reporterId = GetCurrentUserId();
            if (reporterId <= 0) return Unauthorized();

            if (string.IsNullOrWhiteSpace(req.TargetType))
            {
                return BadRequest(new { message = "Target type is required." });
            }

            if (req.TargetId <= 0)
            {
                return BadRequest(new { message = "A valid Target ID must be provided." });
            }

            if (string.IsNullOrWhiteSpace(req.Reason))
            {
                return BadRequest(new { message = "Violation reason is required." });
            }

            if (string.IsNullOrWhiteSpace(req.Description))
            {
                return BadRequest(new { message = "Detailed report explanation cannot be empty." });
            }

            var targetType = req.TargetType.Trim();
            int? detectedReportedUserId = req.ReportedUserId;

            // Verify target existence and auto-detect reported user
            switch (targetType.ToLower())
            {
                case "user":
                    var targetUser = await _context.Users.FindAsync(req.TargetId);
                    if (targetUser == null)
                    {
                        return NotFound(new { message = $"Reported user with ID {req.TargetId} was not found." });
                    }
                    if (targetUser.Id == reporterId)
                    {
                        return BadRequest(new { message = "You cannot report your own account." });
                    }
                    detectedReportedUserId = targetUser.Id;
                    break;

                case "communitypost":
                    var post = await _context.CommunityPosts.FindAsync(req.TargetId);
                    if (post == null)
                    {
                        return NotFound(new { message = $"Community post with ID {req.TargetId} was not found." });
                    }
                    if (post.AuthorId == reporterId)
                    {
                        return BadRequest(new { message = "You cannot report your own community post." });
                    }
                    detectedReportedUserId = post.AuthorId;
                    break;

                case "communitycomment":
                    var comment = await _context.CommunityComments.FindAsync(req.TargetId);
                    if (comment == null)
                    {
                        return NotFound(new { message = $"Community comment with ID {req.TargetId} was not found." });
                    }
                    if (comment.AuthorId == reporterId)
                    {
                        return BadRequest(new { message = "You cannot report your own comment." });
                    }
                    detectedReportedUserId = comment.AuthorId;
                    break;

                case "openproject":
                    var project = await _context.OpenProjects.FindAsync(req.TargetId);
                    if (project == null)
                    {
                        return NotFound(new { message = $"Research project with ID {req.TargetId} was not found." });
                    }
                    if (project.SupervisorId == reporterId)
                    {
                        return BadRequest(new { message = "You cannot report your own research project." });
                    }
                    detectedReportedUserId = project.SupervisorId;
                    break;

                case "researchidea":
                    var idea = await _context.ResearchIdeas.FindAsync(req.TargetId);
                    if (idea == null)
                    {
                        return NotFound(new { message = $"Research idea with ID {req.TargetId} was not found." });
                    }
                    if (idea.CreatorId == reporterId)
                    {
                        return BadRequest(new { message = "You cannot report your own research idea." });
                    }
                    detectedReportedUserId = idea.CreatorId;
                    break;

                case "publication":
                    var pub = await _context.Publications.FindAsync(req.TargetId);
                    if (pub == null)
                    {
                        return NotFound(new { message = $"Publication with ID {req.TargetId} was not found." });
                    }
                    if (pub.OwnerId == reporterId)
                    {
                        return BadRequest(new { message = "You cannot report your own publication." });
                    }
                    detectedReportedUserId = pub.OwnerId;
                    break;

                default:
                    return BadRequest(new { message = $"Unsupported target type '{targetType}'." });
            }

            // Guardrail: Duplicate active report check
            var existingReport = await _context.ReportSubmissions
                .AnyAsync(r => r.ReporterId == reporterId &&
                               r.TargetType.ToLower() == targetType.ToLower() &&
                               r.TargetId == req.TargetId &&
                               (r.Status == "Pending" || r.Status == "UnderReview"));

            if (existingReport)
            {
                return BadRequest(new { message = "You have already submitted an active report for this item. Our moderation team is reviewing it." });
            }

            var report = new ReportSubmission
            {
                ReporterId = reporterId,
                TargetType = targetType,
                TargetId = req.TargetId,
                ReportedUserId = detectedReportedUserId,
                Reason = req.Reason.Trim(),
                Description = req.Description.Trim(),
                EvidenceUrl = req.EvidenceUrl?.Trim(),
                Status = "Pending",
                ActionTaken = "None",
                SubmittedAt = DateTime.UtcNow
            };

            _context.ReportSubmissions.Add(report);
            await _context.SaveChangesAsync();

            var reporter = await _context.Users.FindAsync(reporterId);
            var reportedUser = detectedReportedUserId.HasValue ? await _context.Users.FindAsync(detectedReportedUserId.Value) : null;

            var responseDto = new ReportSummaryDto
            {
                Id = report.Id,
                TargetType = report.TargetType,
                TargetId = report.TargetId,
                Reason = report.Reason,
                Description = report.Description,
                Status = report.Status,
                ReporterName = reporter?.FullName ?? "Researcher",
                ReportedUserName = reportedUser?.FullName,
                ModeratorName = null,
                ActionTaken = report.ActionTaken,
                SubmittedAt = report.SubmittedAt,
                ResolvedAt = report.ResolvedAt
            };

            return CreatedAtAction(nameof(GetReportById), new { id = report.Id }, responseDto);
        }

        // =========================================================================
        // 2. MODERATOR QUEUE: LIST REPORTS WITH FILTERS
        // GET /api/reports?status=Pending&targetType=CommunityPost&page=1&pageSize=15
        // =========================================================================
        [HttpGet]
        public async Task<IActionResult> GetReports(
            [FromQuery] string? status = null,
            [FromQuery] string? targetType = null,
            [FromQuery] string? reason = null,
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 15)
        {
            if (!IsModeratorOrAdmin())
            {
                return Forbid();
            }

            var query = _context.ReportSubmissions
                .Include(r => r.Reporter)
                .Include(r => r.ReportedUser)
                .Include(r => r.Moderator)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.Status.ToLower() == status.ToLower());
            }

            if (!string.IsNullOrWhiteSpace(targetType) && !targetType.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.TargetType.ToLower() == targetType.ToLower());
            }

            if (!string.IsNullOrWhiteSpace(reason) && !reason.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.Reason.ToLower() == reason.ToLower());
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(r =>
                    r.Reason.ToLower().Contains(s) ||
                    r.Description.ToLower().Contains(s) ||
                    r.TargetType.ToLower().Contains(s) ||
                    (r.Reporter != null && r.Reporter.FullName.ToLower().Contains(s)) ||
                    (r.ReportedUser != null && r.ReportedUser.FullName.ToLower().Contains(s)));
            }

            query = query.OrderByDescending(r => r.Status == "Pending")
                         .ThenByDescending(r => r.Status == "UnderReview")
                         .ThenByDescending(r => r.SubmittedAt);

            var totalCount = await query.CountAsync();
            var skip = (Math.Max(1, page) - 1) * pageSize;
            var reports = await query.Skip(skip).Take(pageSize).ToListAsync();

            var items = reports.Select(r => new ReportSummaryDto
            {
                Id = r.Id,
                TargetType = r.TargetType,
                TargetId = r.TargetId,
                Reason = r.Reason,
                Description = r.Description,
                Status = r.Status,
                ReporterName = r.Reporter?.FullName ?? "Unknown",
                ReportedUserName = r.ReportedUser?.FullName,
                ModeratorName = r.Moderator?.FullName,
                ActionTaken = r.ActionTaken,
                SubmittedAt = r.SubmittedAt,
                ResolvedAt = r.ResolvedAt
            }).ToList();

            return Ok(new PaginatedReportsResultDto
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        // =========================================================================
        // 3. GET REPORTS SUBMITTED BY CURRENT USER
        // GET /api/reports/my-reports
        // =========================================================================
        [HttpGet("my-reports")]
        public async Task<IActionResult> GetMyReports()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var reports = await _context.ReportSubmissions
                .Include(r => r.ReportedUser)
                .Where(r => r.ReporterId == userId)
                .OrderByDescending(r => r.SubmittedAt)
                .ToListAsync();

            var items = reports.Select(r => new ReportSummaryDto
            {
                Id = r.Id,
                TargetType = r.TargetType,
                TargetId = r.TargetId,
                Reason = r.Reason,
                Description = r.Description,
                Status = r.Status,
                ReporterName = "You",
                ReportedUserName = r.ReportedUser?.FullName,
                ModeratorName = null, // Confidential
                ActionTaken = r.ActionTaken,
                SubmittedAt = r.SubmittedAt,
                ResolvedAt = r.ResolvedAt
            }).ToList();

            return Ok(items);
        }

        // =========================================================================
        // 4. MODERATION STATS & OVERVIEW
        // GET /api/reports/stats
        // =========================================================================
        [HttpGet("stats")]
        public async Task<IActionResult> GetReportStats()
        {
            if (!IsModeratorOrAdmin())
            {
                return Forbid();
            }

            var totalReports = await _context.ReportSubmissions.CountAsync();
            var pendingCount = await _context.ReportSubmissions.CountAsync(r => r.Status == "Pending");
            var underReviewCount = await _context.ReportSubmissions.CountAsync(r => r.Status == "UnderReview");
            var resolvedCount = await _context.ReportSubmissions.CountAsync(r => r.Status == "Resolved");
            var dismissedCount = await _context.ReportSubmissions.CountAsync(r => r.Status == "Dismissed");

            var byReason = await _context.ReportSubmissions
                .GroupBy(r => r.Reason)
                .Select(g => new { Reason = g.Key, Count = g.Count() })
                .OrderByDescending(g => g.Count)
                .ToListAsync();

            var byTargetType = await _context.ReportSubmissions
                .GroupBy(r => r.TargetType)
                .Select(g => new { TargetType = g.Key, Count = g.Count() })
                .OrderByDescending(g => g.Count)
                .ToListAsync();

            var actionsBreakdown = await _context.ReportSubmissions
                .Where(r => r.ActionTaken != null && r.ActionTaken != "None")
                .GroupBy(r => r.ActionTaken!)
                .Select(g => new { Action = g.Key, Count = g.Count() })
                .ToListAsync();

            return Ok(new
            {
                totalReports,
                pendingCount,
                underReviewCount,
                resolvedCount,
                dismissedCount,
                byReason,
                byTargetType,
                actionsBreakdown
            });
        }

        // =========================================================================
        // 5. GET DETAILED REPORT & TARGET CONTEXT
        // GET /api/reports/{id}
        // =========================================================================
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetReportById(int id)
        {
            var userId = GetCurrentUserId();
            var report = await _context.ReportSubmissions
                .Include(r => r.Reporter)
                .Include(r => r.ReportedUser)
                .Include(r => r.Moderator)
                .Include(r => r.AuditLogs)
                    .ThenInclude(a => a.Moderator)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (report == null)
            {
                return NotFound(new { message = $"Report with ID {id} was not found." });
            }

            var isStaff = IsModeratorOrAdmin();
            var isReporter = report.ReporterId == userId;

            if (!isStaff && !isReporter)
            {
                return Forbid();
            }

            // Fetch target content preview for moderator context
            string? targetTitle = null;
            string? targetContentPreview = null;
            string? targetUrl = null;

            switch (report.TargetType.ToLower())
            {
                case "communitypost":
                    var post = await _context.CommunityPosts.FindAsync(report.TargetId);
                    if (post != null)
                    {
                        targetTitle = post.Title;
                        targetContentPreview = post.Content.Length > 200 ? post.Content.Substring(0, 200) + "..." : post.Content;
                        targetUrl = $"/community/{post.Id}";
                    }
                    break;

                case "communitycomment":
                    var comment = await _context.CommunityComments.Include(c => c.Post).FirstOrDefaultAsync(c => c.Id == report.TargetId);
                    if (comment != null)
                    {
                        targetTitle = $"Comment on: {comment.Post?.Title ?? "Discussion"}";
                        targetContentPreview = comment.Content;
                        targetUrl = $"/community/{comment.PostId}";
                    }
                    break;

                case "openproject":
                    var proj = await _context.OpenProjects.FindAsync(report.TargetId);
                    if (proj != null)
                    {
                        targetTitle = proj.Title;
                        targetContentPreview = proj.Description.Length > 200 ? proj.Description.Substring(0, 200) + "..." : proj.Description;
                        targetUrl = $"/open-projects";
                    }
                    break;

                case "publication":
                    var pub = await _context.Publications.FindAsync(report.TargetId);
                    if (pub != null)
                    {
                        targetTitle = pub.Title;
                        targetContentPreview = pub.Abstract != null && pub.Abstract.Length > 200 ? pub.Abstract.Substring(0, 200) + "..." : pub.Abstract;
                        targetUrl = pub.SourceLink;
                    }
                    break;

                case "researchidea":
                    var idea = await _context.ResearchIdeas.FindAsync(report.TargetId);
                    if (idea != null)
                    {
                        targetTitle = idea.Title;
                        targetContentPreview = idea.Description.Length > 200 ? idea.Description.Substring(0, 200) + "..." : idea.Description;
                        targetUrl = $"/ideas";
                    }
                    break;

                case "user":
                    var targetUser = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == report.TargetId);
                    if (targetUser != null)
                    {
                        targetTitle = targetUser.FullName;
                        targetContentPreview = $"Role: {targetUser.Role} | Institution: {targetUser.Profile?.University ?? "Unspecified"}";
                        targetUrl = $"/profile";
                    }
                    break;
            }

            var auditList = report.AuditLogs
                .OrderByDescending(a => a.Timestamp)
                .Select(a => new ModerationAuditLogDto
                {
                    Id = a.Id,
                    ModeratorId = a.ModeratorId,
                    ModeratorName = a.Moderator?.FullName ?? "Moderator",
                    PreviousStatus = a.PreviousStatus,
                    NewStatus = a.NewStatus,
                    ActionDetails = a.ActionDetails,
                    Timestamp = a.Timestamp
                }).ToList();

            var detailDto = new ReportDetailDto
            {
                Id = report.Id,
                ReporterId = report.ReporterId,
                ReporterName = report.Reporter?.FullName ?? "Unknown",
                TargetType = report.TargetType,
                TargetId = report.TargetId,
                ReportedUserId = report.ReportedUserId,
                ReportedUserName = report.ReportedUser?.FullName,
                Reason = report.Reason,
                Description = report.Description,
                EvidenceUrl = report.EvidenceUrl,
                Status = report.Status,
                ModeratorId = report.ModeratorId,
                ModeratorName = isStaff ? report.Moderator?.FullName : null,
                ResolutionNote = report.ResolutionNote,
                ActionTaken = report.ActionTaken,
                SubmittedAt = report.SubmittedAt,
                ResolvedAt = report.ResolvedAt,
                TargetTitle = targetTitle,
                TargetContentPreview = targetContentPreview,
                TargetUrl = targetUrl,
                AuditLogs = isStaff ? auditList : new List<ModerationAuditLogDto>()
            };

            return Ok(detailDto);
        }

        // =========================================================================
        // 6. UPDATE REPORT STATUS & RECORD MODERATION DECISION
        // PUT /api/reports/{id}/status
        // =========================================================================
        [HttpPut("{id:int}/status")]
        public async Task<IActionResult> UpdateReportStatus(int id, [FromBody] ModerationDecisionDto req)
        {
            if (!IsModeratorOrAdmin())
            {
                return Forbid();
            }

            var moderatorId = GetCurrentUserId();
            var report = await _context.ReportSubmissions
                .Include(r => r.Reporter)
                .Include(r => r.ReportedUser)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (report == null)
            {
                return NotFound(new { message = $"Report with ID {id} was not found." });
            }

            var allowedStatuses = new[] { "Pending", "UnderReview", "Resolved", "Dismissed" };
            var targetStatus = allowedStatuses.FirstOrDefault(s => s.Equals(req.Status, StringComparison.OrdinalIgnoreCase));
            if (targetStatus == null)
            {
                return BadRequest(new { message = $"Invalid status '{req.Status}'. Allowed: Pending, UnderReview, Resolved, Dismissed." });
            }

            var previousStatus = report.Status;
            report.Status = targetStatus;
            report.ModeratorId = moderatorId;
            report.ResolutionNote = req.ResolutionNote?.Trim();
            report.ActionTaken = string.IsNullOrWhiteSpace(req.ActionTaken) ? "None" : req.ActionTaken.Trim();

            if (targetStatus == "Resolved" || targetStatus == "Dismissed")
            {
                report.ResolvedAt = DateTime.UtcNow;
            }
            else
            {
                report.ResolvedAt = null;
            }

            // Create Audit Log
            var auditLog = new ModerationAuditLog
            {
                ReportId = report.Id,
                ModeratorId = moderatorId,
                PreviousStatus = previousStatus,
                NewStatus = targetStatus,
                ActionDetails = $"Decision: {targetStatus} | Action: {report.ActionTaken} | Note: {report.ResolutionNote ?? "None"}",
                Timestamp = DateTime.UtcNow
            };
            _context.ModerationAuditLogs.Add(auditLog);

            // Execute content action if ContentRemoved
            if (report.ActionTaken.Equals("ContentRemoved", StringComparison.OrdinalIgnoreCase))
            {
                if (report.TargetType.Equals("CommunityPost", StringComparison.OrdinalIgnoreCase))
                {
                    var post = await _context.CommunityPosts.FindAsync(report.TargetId);
                    if (post != null)
                    {
                        post.Title = "[Removed by Moderator]";
                        post.Content = "This content has been removed by platform moderators for violating academic integrity guidelines.";
                        post.UpdatedAt = DateTime.UtcNow;
                    }
                }
                else if (report.TargetType.Equals("CommunityComment", StringComparison.OrdinalIgnoreCase))
                {
                    var comment = await _context.CommunityComments.FindAsync(report.TargetId);
                    if (comment != null)
                    {
                        comment.Content = "[This comment was removed by moderators for violating community guidelines]";
                        comment.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }

            // Notify Reporter about resolution
            var reporterNotice = new Notification
            {
                UserId = report.ReporterId,
                Title = $"Report Update: {report.Reason}",
                Message = $"Your report regarding {report.TargetType} #{report.TargetId} has been reviewed. Status: {targetStatus}.",
                Type = "Moderation",
                RelatedEntityId = report.Id,
                CreatedAt = DateTime.UtcNow
            };
            _context.Notifications.Add(reporterNotice);

            // Notify Reported User if an action was taken
            if (report.ReportedUserId.HasValue && !report.ActionTaken.Equals("None", StringComparison.OrdinalIgnoreCase))
            {
                var offenderNotice = new Notification
                {
                    UserId = report.ReportedUserId.Value,
                    Title = $"Moderation Notice: {report.ActionTaken}",
                    Message = $"A moderation action ({report.ActionTaken}) was applied regarding your {report.TargetType} content for reason: {report.Reason}. Note: {report.ResolutionNote ?? "Please adhere to community guidelines."}",
                    Type = "Moderation",
                    RelatedEntityId = report.Id,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Notifications.Add(offenderNotice);
            }

            await _context.SaveChangesAsync();

            var moderator = await _context.Users.FindAsync(moderatorId);

            return Ok(new
            {
                message = "Report status updated successfully.",
                reportId = report.Id,
                status = report.Status,
                actionTaken = report.ActionTaken,
                resolutionNote = report.ResolutionNote,
                moderatorName = moderator?.FullName ?? "Moderator",
                resolvedAt = report.ResolvedAt
            });
        }

        // =========================================================================
        // 7. DELETE REPORT (ADMIN ONLY)
        // DELETE /api/reports/{id}
        // =========================================================================
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteReport(int id)
        {
            var role = GetCurrentUserRole();
            if (!role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            {
                return Forbid();
            }

            var report = await _context.ReportSubmissions
                .Include(r => r.AuditLogs)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (report == null)
            {
                return NotFound(new { message = $"Report with ID {id} was not found." });
            }

            _context.ModerationAuditLogs.RemoveRange(report.AuditLogs);
            _context.ReportSubmissions.Remove(report);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Report and audit logs deleted successfully.", reportId = id });
        }
    }

    // =========================================================================
    // DTO RESPONSE MODELS
    // =========================================================================

    public class ReportDetailDto : ReportSummaryDto
    {
        public int ReporterId { get; set; }
        public int? ReportedUserId { get; set; }
        public int? ModeratorId { get; set; }
        public string? EvidenceUrl { get; set; }
        public string? ResolutionNote { get; set; }
        public string? TargetTitle { get; set; }
        public string? TargetContentPreview { get; set; }
        public string? TargetUrl { get; set; }
        public List<ModerationAuditLogDto> AuditLogs { get; set; } = new List<ModerationAuditLogDto>();
    }

    public class ModerationAuditLogDto
    {
        public int Id { get; set; }
        public int ModeratorId { get; set; }
        public string ModeratorName { get; set; } = string.Empty;
        public string PreviousStatus { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
        public string ActionDetails { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }

    public class PaginatedReportsResultDto
    {
        public List<ReportSummaryDto> Items { get; set; } = new List<ReportSummaryDto>();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }
}
