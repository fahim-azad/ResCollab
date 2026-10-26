using System;
using System.Collections.Generic;
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
    public class AnalyticsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AnalyticsController(ApplicationDbContext context)
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
        // 1. GLOBAL / PLATFORM SUMMARY ANALYTICS
        // GET /api/analytics/summary
        // =========================================================================
        [HttpGet("summary")]
        public async Task<IActionResult> GetGlobalSummary()
        {
            var totalResearchers = await _context.Users.CountAsync();
            var totalPublications = await _context.Publications.CountAsync();
            var totalWorkspaces = await _context.Workspaces.CountAsync();
            var totalOpenProjects = await _context.OpenProjects.CountAsync();
            var totalLaboratories = await _context.Laboratories.CountAsync();
            var totalUniversities = await _context.Universities.CountAsync();
            var totalCollaborations = await _context.UserConnections.CountAsync(c => c.Status == "Accepted");

            // Extract popular research interests from profiles
            var allInterests = await _context.UserProfiles
                .Where(p => !string.IsNullOrEmpty(p.Interests))
                .Select(p => p.Interests!)
                .ToListAsync();

            var interestFrequency = allInterests
                .SelectMany(i => i.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(g => g.Count())
                .Take(8)
                .Select(g => new TagFrequencyDto { Tag = g.Key, Count = g.Count() })
                .ToList();

            var recentSnapshots = await _context.ResearchAnalyticsSnapshots
                .OrderByDescending(s => s.LastCalculated)
                .Take(5)
                .ToListAsync();

            var dto = new GlobalAnalyticsSummaryDto
            {
                TotalResearchers = totalResearchers,
                TotalPublications = totalPublications,
                TotalWorkspaces = totalWorkspaces,
                TotalOpenProjects = totalOpenProjects,
                TotalLaboratories = totalLaboratories,
                TotalUniversities = totalUniversities,
                TotalCollaborations = totalCollaborations,
                TopResearchAreas = interestFrequency,
                RecentSnapshots = recentSnapshots
            };

            return Ok(dto);
        }

        // =========================================================================
        // 2. INSTITUTIONAL ANALYTICS
        // GET /api/analytics/institutional/{institutionId}
        // =========================================================================
        [HttpGet("institutional/{institutionId}")]
        public async Task<IActionResult> GetInstitutionalAnalytics(int institutionId)
        {
            var university = await _context.Universities
                .Include(u => u.Departments)
                .FirstOrDefaultAsync(u => u.Id == institutionId);

            if (university == null)
            {
                return NotFound(new { message = $"University with ID {institutionId} was not found." });
            }

            var uniName = university.Name.Trim();

            // All affiliated researchers
            var affiliatedUsers = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Profile != null && u.Profile.University != null &&
                            (u.Profile.University.ToLower() == uniName.ToLower() ||
                             u.Profile.University.ToLower().Contains(uniName.ToLower())))
                .ToListAsync();

            var affiliatedUserIds = affiliatedUsers.Select(u => u.Id).ToList();

            var facultyCount = affiliatedUsers.Count(u => u.Role == "Faculty" || u.Role == "Supervisor");
            var studentCount = affiliatedUsers.Count(u => u.Role == "Student");

            // Total publications by affiliated authors
            var publications = await _context.Publications
                .Where(p => affiliatedUserIds.Contains(p.OwnerId))
                .ToListAsync();

            var totalPublications = publications.Count;

            // Yearly publication trends
            var yearlyTrends = publications
                .GroupBy(p => p.PublicationYear)
                .OrderBy(g => g.Key)
                .Select(g => new YearlyTrendDto { Year = g.Key, Count = g.Count() })
                .ToList();

            // Total workspaces led or participated by members
            var activeWorkspacesCount = await _context.WorkspaceMembers
                .Where(wm => affiliatedUserIds.Contains(wm.UserId))
                .Select(wm => wm.WorkspaceId)
                .Distinct()
                .CountAsync();

            // Open projects hosted by institution researchers
            var openProjectsCount = await _context.OpenProjects
                .CountAsync(p => affiliatedUserIds.Contains(p.SupervisorId));

            // Laboratories
            var laboratories = await _context.Laboratories
                .Where(l => l.Institution != null &&
                            (l.Institution.ToLower() == uniName.ToLower() ||
                             l.Institution.ToLower().Contains(uniName.ToLower())))
                .ToListAsync();

            // Department breakdown
            var departmentsBreakdown = new List<DepartmentStatDto>();
            foreach (var dept in university.Departments)
            {
                var deptName = dept.Name.Trim();
                var deptUsers = affiliatedUsers.Where(u =>
                    u.Profile?.Department != null &&
                    u.Profile.Department.Equals(deptName, StringComparison.OrdinalIgnoreCase)).ToList();

                var deptUserIds = deptUsers.Select(u => u.Id).ToList();
                var deptPubsCount = publications.Count(p => deptUserIds.Contains(p.OwnerId));
                var deptLabsCount = laboratories.Count(l =>
                    l.Department != null && l.Department.Equals(deptName, StringComparison.OrdinalIgnoreCase));

                departmentsBreakdown.Add(new DepartmentStatDto
                {
                    DepartmentId = dept.Id,
                    DepartmentName = dept.Name,
                    ResearchersCount = deptUsers.Count,
                    PublicationsCount = deptPubsCount,
                    LaboratoriesCount = deptLabsCount
                });
            }

            // Cross-institutional collaboration links
            var crossCollabs = await _context.UserConnections
                .Include(c => c.Requester).ThenInclude(r => r!.Profile)
                .Include(c => c.Target).ThenInclude(t => t!.Profile)
                .Where(c => c.Status == "Accepted" &&
                            ((affiliatedUserIds.Contains(c.RequesterId) && !affiliatedUserIds.Contains(c.TargetId)) ||
                             (affiliatedUserIds.Contains(c.TargetId) && !affiliatedUserIds.Contains(c.RequesterId))))
                .ToListAsync();

            var externalCollabInstitutions = crossCollabs
                .Select(c => affiliatedUserIds.Contains(c.RequesterId) ? c.Target?.Profile?.University : c.Requester?.Profile?.University)
                .Where(u => !string.IsNullOrEmpty(u) && !u.Equals(uniName, StringComparison.OrdinalIgnoreCase))
                .GroupBy(u => u!)
                .OrderByDescending(g => g.Count())
                .Take(5)
                .Select(g => new CrossInstitutionCollabDto
                {
                    TargetInstitution = g.Key,
                    JointCollaboratorsCount = g.Count()
                })
                .ToList();

            var result = new InstitutionalAnalyticsDto
            {
                InstitutionId = university.Id,
                InstitutionName = university.Name,
                Country = university.Country,
                City = university.City,
                Website = university.Website,
                TotalResearchers = affiliatedUsers.Count,
                FacultyCount = facultyCount,
                StudentCount = studentCount,
                TotalPublications = totalPublications,
                ActiveWorkspacesCount = activeWorkspacesCount,
                OpenProjectsCount = openProjectsCount,
                LaboratoriesCount = laboratories.Count,
                Departments = departmentsBreakdown,
                PublicationTrends = yearlyTrends,
                CrossInstitutionalCollaborations = externalCollabInstitutions
            };

            return Ok(result);
        }

        // =========================================================================
        // 3. DEPARTMENT ANALYTICS
        // GET /api/analytics/department/{departmentId}
        // =========================================================================
        [HttpGet("department/{departmentId}")]
        public async Task<IActionResult> GetDepartmentAnalytics(int departmentId)
        {
            var dept = await _context.Departments
                .Include(d => d.University)
                .FirstOrDefaultAsync(d => d.Id == departmentId);

            if (dept == null)
            {
                return NotFound(new { message = $"Department with ID {departmentId} not found." });
            }

            var deptName = dept.Name.Trim();
            var uniName = dept.University?.Name?.Trim() ?? string.Empty;

            var researchers = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Profile != null && u.Profile.Department != null &&
                            u.Profile.Department.ToLower() == deptName.ToLower() &&
                            (string.IsNullOrEmpty(uniName) || (u.Profile.University != null && u.Profile.University.ToLower().Contains(uniName.ToLower()))))
                .ToListAsync();

            var researcherIds = researchers.Select(r => r.Id).ToList();

            var facultyCount = researchers.Count(r => r.Role == "Faculty" || r.Role == "Supervisor");
            var studentCount = researchers.Count(r => r.Role == "Student");

            var publicationsCount = await _context.Publications
                .CountAsync(p => researcherIds.Contains(p.OwnerId));

            var labsCount = await _context.Laboratories
                .CountAsync(l => l.Department != null && l.Department.ToLower() == deptName.ToLower());

            var activeProjectsCount = await _context.WorkspaceMembers
                .Where(wm => researcherIds.Contains(wm.UserId))
                .Select(wm => wm.WorkspaceId)
                .Distinct()
                .CountAsync();

            var result = new DepartmentAnalyticsDto
            {
                DepartmentId = dept.Id,
                DepartmentName = dept.Name,
                InstitutionName = uniName,
                TotalResearchers = researchers.Count,
                FacultyCount = facultyCount,
                StudentCount = studentCount,
                TotalPublications = publicationsCount,
                LaboratoriesCount = labsCount,
                ActiveProjectsCount = activeProjectsCount
            };

            return Ok(result);
        }

        // =========================================================================
        // 4. RESEARCHER STATISTICS
        // GET /api/analytics/researcher/{userId}
        // =========================================================================
        [HttpGet("researcher/{userId:int?}")]
        public async Task<IActionResult> GetResearcherAnalytics(int? userId)
        {
            var targetUserId = userId ?? GetCurrentUserId();
            if (targetUserId <= 0) return Unauthorized();

            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == targetUserId);

            if (user == null)
            {
                return NotFound(new { message = $"Researcher with ID {targetUserId} not found." });
            }

            // Publications
            var publications = await _context.Publications
                .Where(p => p.OwnerId == targetUserId)
                .OrderByDescending(p => p.PublicationYear)
                .ToListAsync();

            var yearlyTimeline = publications
                .GroupBy(p => p.PublicationYear)
                .OrderBy(g => g.Key)
                .Select(g => new YearlyTrendDto { Year = g.Key, Count = g.Count() })
                .ToList();

            // Active workspaces
            var activeWorkspacesCount = await _context.WorkspaceMembers
                .CountAsync(wm => wm.UserId == targetUserId);

            // Connections / Collaborators
            var collaboratorsCount = await _context.UserConnections
                .CountAsync(c => c.Status == "Accepted" && (c.RequesterId == targetUserId || c.TargetId == targetUserId));

            // Tasks assigned to researcher
            var tasks = await _context.WorkspaceTasks
                .Where(t => t.AssignedToId == targetUserId)
                .ToListAsync();

            var totalTasks = tasks.Count;
            var completedTasks = tasks.Count(t => t.Status == "Done" || t.Status == "Completed");
            var taskCompletionRate = totalTasks > 0 ? Math.Round((double)completedTasks / totalTasks * 100, 1) : 0.0;

            // Velocity: Tasks completed in last 30 days
            var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
            var recentCompletedVelocity = tasks.Count(t => (t.Status == "Done" || t.Status == "Completed") && t.CreatedAt >= thirtyDaysAgo);

            var result = new ResearcherAnalyticsDto
            {
                UserId = user.Id,
                FullName = user.FullName,
                Role = user.Role,
                Institution = user.Profile?.University,
                Department = user.Profile?.Department,
                Bio = user.Profile?.Bio,
                Skills = user.Profile?.Skills,
                Interests = user.Profile?.Interests,
                TotalPublications = publications.Count,
                ActiveProjectsCount = activeWorkspacesCount,
                CollaboratorsCount = collaboratorsCount,
                TotalAssignedTasks = totalTasks,
                CompletedTasksCount = completedTasks,
                TaskCompletionRate = taskCompletionRate,
                TaskVelocity30Days = recentCompletedVelocity,
                PublicationsTimeline = yearlyTimeline
            };

            return Ok(result);
        }

        // =========================================================================
        // 5. TEAM & WORKSPACE ANALYTICS
        // GET /api/analytics/team/{workspaceId}
        // =========================================================================
        [HttpGet("team/{workspaceId}")]
        public async Task<IActionResult> GetWorkspaceTeamAnalytics(int workspaceId)
        {
            var currentUserId = GetCurrentUserId();
            var currentUserRole = GetCurrentUserRole();

            var workspace = await _context.Workspaces
                .FirstOrDefaultAsync(w => w.Id == workspaceId);

            if (workspace == null)
            {
                return NotFound(new { message = $"Workspace with ID {workspaceId} not found." });
            }

            var members = await _context.WorkspaceMembers
                .Include(m => m.User)
                .Where(m => m.WorkspaceId == workspaceId)
                .ToListAsync();

            // Security Gate: User must be a member of this workspace (or Admin/Moderator)
            var isMember = members.Any(m => m.UserId == currentUserId);
            var isAdmin = currentUserRole == "Admin" || currentUserRole == "Moderator";

            if (!isMember && !isAdmin)
            {
                return Forbid();
            }

            var tasks = await _context.WorkspaceTasks
                .Include(t => t.Assignee)
                .Where(t => t.WorkspaceId == workspaceId)
                .ToListAsync();

            var totalTasks = tasks.Count;
            var completedTasks = tasks.Count(t => t.Status == "Done" || t.Status == "Completed");
            var inProgressTasks = tasks.Count(t => t.Status == "InProgress");
            var pendingTasks = tasks.Count(t => t.Status == "Todo" || t.Status == "To Do");

            var completionRate = totalTasks > 0 ? Math.Round((double)completedTasks / totalTasks * 100, 1) : 0.0;

            // Milestone tasks
            var milestoneCount = tasks.Count(t => t.IsMilestone);

            // Member contribution metrics
            var memberContributions = new List<TeamMemberContributionDto>();
            foreach (var member in members)
            {
                if (member.User == null) continue;

                var memberTasks = tasks.Where(t => t.AssignedToId == member.UserId).ToList();
                var memberDone = memberTasks.Count(t => t.Status == "Done" || t.Status == "Completed");
                var memberTaskCount = memberTasks.Count;
                var memberRate = memberTaskCount > 0 ? Math.Round((double)memberDone / memberTaskCount * 100, 1) : 0.0;
                var overallContrib = completedTasks > 0 ? Math.Round((double)memberDone / completedTasks * 100, 1) : 0.0;

                memberContributions.Add(new TeamMemberContributionDto
                {
                    UserId = member.UserId,
                    FullName = member.User.FullName,
                    RoleInWorkspace = member.Role,
                    AssignedTasksCount = memberTaskCount,
                    CompletedTasksCount = memberDone,
                    TaskCompletionRate = memberRate,
                    ContributionPercentage = overallContrib
                });
            }

            // Recent activity
            var recentTasks = tasks
                .OrderByDescending(t => t.CreatedAt)
                .Take(5)
                .Select(t => new WorkspaceRecentTaskDto
                {
                    TaskId = t.Id,
                    Title = t.Title,
                    Status = t.Status,
                    DueDate = t.DueDate,
                    AssigneeName = t.Assignee?.FullName
                })
                .ToList();

            var leadMember = members.FirstOrDefault(m => m.Role == "Admin")?.User?.FullName ?? "Team Lead";

            var result = new WorkspaceTeamAnalyticsDto
            {
                WorkspaceId = workspace.Id,
                WorkspaceName = workspace.Name,
                Description = workspace.Description,
                OwnerName = leadMember,
                TotalMembersCount = members.Count,
                TotalTasksCount = totalTasks,
                CompletedTasksCount = completedTasks,
                InProgressTasksCount = inProgressTasks,
                PendingTasksCount = pendingTasks,
                TaskCompletionRate = completionRate,
                MilestoneTasksCount = milestoneCount,
                MemberContributions = memberContributions,
                RecentTasks = recentTasks
            };

            return Ok(result);
        }

        // =========================================================================
        // 6. ON-DEMAND RECALCULATION & SNAPSHOT CACHING
        // POST /api/analytics/recalculate
        // =========================================================================
        [HttpPost("recalculate")]
        public async Task<IActionResult> RecalculateAnalytics()
        {
            var userRole = GetCurrentUserRole();
            if (userRole != "Admin" && userRole != "Moderator" && userRole != "Faculty" && userRole != "Supervisor")
            {
                return Forbid();
            }

            var universities = await _context.Universities.ToListAsync();
            var snapshotsCreated = 0;

            foreach (var uni in universities)
            {
                var uniName = uni.Name.Trim();
                var affiliatedUsers = await _context.Users
                    .Include(u => u.Profile)
                    .Where(u => u.Profile != null && u.Profile.University != null &&
                                u.Profile.University.ToLower().Contains(uniName.ToLower()))
                    .ToListAsync();

                var userIds = affiliatedUsers.Select(u => u.Id).ToList();

                var totalPubs = await _context.Publications.CountAsync(p => userIds.Contains(p.OwnerId));
                var totalProjects = await _context.WorkspaceMembers
                    .Where(wm => userIds.Contains(wm.UserId))
                    .Select(wm => wm.WorkspaceId)
                    .Distinct()
                    .CountAsync();

                var activeCollabs = await _context.UserConnections
                    .CountAsync(c => c.Status == "Accepted" && (userIds.Contains(c.RequesterId) || userIds.Contains(c.TargetId)));

                var snapshot = new ResearchAnalyticsSnapshot
                {
                    ScopeType = "Institution",
                    ScopeId = uni.Id,
                    ScopeName = uni.Name,
                    TotalPublications = totalPubs,
                    TotalProjects = totalProjects,
                    ActiveCollaborations = activeCollabs,
                    LastCalculated = DateTime.UtcNow
                };

                _context.ResearchAnalyticsSnapshots.Add(snapshot);
                snapshotsCreated++;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Analytics recalculated successfully.",
                snapshotsGenerated = snapshotsCreated,
                timestamp = DateTime.UtcNow
            });
        }
    }

    // =========================================================================
    // ANALYTICS DATA TRANSFER OBJECTS (DTOs)
    // =========================================================================

    public class GlobalAnalyticsSummaryDto
    {
        public int TotalResearchers { get; set; }
        public int TotalPublications { get; set; }
        public int TotalWorkspaces { get; set; }
        public int TotalOpenProjects { get; set; }
        public int TotalLaboratories { get; set; }
        public int TotalUniversities { get; set; }
        public int TotalCollaborations { get; set; }
        public List<TagFrequencyDto> TopResearchAreas { get; set; } = new List<TagFrequencyDto>();
        public List<ResearchAnalyticsSnapshot> RecentSnapshots { get; set; } = new List<ResearchAnalyticsSnapshot>();
    }

    public class TagFrequencyDto
    {
        public string Tag { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class YearlyTrendDto
    {
        public int Year { get; set; }
        public int Count { get; set; }
    }

    public class DepartmentStatDto
    {
        public int DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public int ResearchersCount { get; set; }
        public int PublicationsCount { get; set; }
        public int LaboratoriesCount { get; set; }
    }

    public class CrossInstitutionCollabDto
    {
        public string TargetInstitution { get; set; } = string.Empty;
        public int JointCollaboratorsCount { get; set; }
    }

    public class InstitutionalAnalyticsDto
    {
        public int InstitutionId { get; set; }
        public string InstitutionName { get; set; } = string.Empty;
        public string? Country { get; set; }
        public string? City { get; set; }
        public string? Website { get; set; }
        public int TotalResearchers { get; set; }
        public int FacultyCount { get; set; }
        public int StudentCount { get; set; }
        public int TotalPublications { get; set; }
        public int ActiveWorkspacesCount { get; set; }
        public int OpenProjectsCount { get; set; }
        public int LaboratoriesCount { get; set; }
        public List<DepartmentStatDto> Departments { get; set; } = new List<DepartmentStatDto>();
        public List<YearlyTrendDto> PublicationTrends { get; set; } = new List<YearlyTrendDto>();
        public List<CrossInstitutionCollabDto> CrossInstitutionalCollaborations { get; set; } = new List<CrossInstitutionCollabDto>();
    }

    public class DepartmentAnalyticsDto
    {
        public int DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public string InstitutionName { get; set; } = string.Empty;
        public int TotalResearchers { get; set; }
        public int FacultyCount { get; set; }
        public int StudentCount { get; set; }
        public int TotalPublications { get; set; }
        public int LaboratoriesCount { get; set; }
        public int ActiveProjectsCount { get; set; }
    }

    public class ResearcherAnalyticsDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Institution { get; set; }
        public string? Department { get; set; }
        public string? Bio { get; set; }
        public string? Skills { get; set; }
        public string? Interests { get; set; }
        public int TotalPublications { get; set; }
        public int ActiveProjectsCount { get; set; }
        public int CollaboratorsCount { get; set; }
        public int TotalAssignedTasks { get; set; }
        public int CompletedTasksCount { get; set; }
        public double TaskCompletionRate { get; set; }
        public int TaskVelocity30Days { get; set; }
        public List<YearlyTrendDto> PublicationsTimeline { get; set; } = new List<YearlyTrendDto>();
    }

    public class WorkspaceTeamAnalyticsDto
    {
        public int WorkspaceId { get; set; }
        public string WorkspaceName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string OwnerName { get; set; } = string.Empty;
        public int TotalMembersCount { get; set; }
        public int TotalTasksCount { get; set; }
        public int CompletedTasksCount { get; set; }
        public int InProgressTasksCount { get; set; }
        public int PendingTasksCount { get; set; }
        public double TaskCompletionRate { get; set; }
        public int MilestoneTasksCount { get; set; }
        public List<TeamMemberContributionDto> MemberContributions { get; set; } = new List<TeamMemberContributionDto>();
        public List<WorkspaceRecentTaskDto> RecentTasks { get; set; } = new List<WorkspaceRecentTaskDto>();
    }

    public class TeamMemberContributionDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string RoleInWorkspace { get; set; } = string.Empty;
        public int AssignedTasksCount { get; set; }
        public int CompletedTasksCount { get; set; }
        public double TaskCompletionRate { get; set; }
        public double ContributionPercentage { get; set; }
    }

    public class WorkspaceRecentTaskDto
    {
        public int TaskId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public string? AssigneeName { get; set; }
    }
}
