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
using ResCollab.Api.Services;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IAiMatchingService _aiMatchingService;

        public DashboardController(ApplicationDbContext context, IAiMatchingService aiMatchingService)
        {
            _context = context;
            _aiMatchingService = aiMatchingService;
        }

        private int GetCurrentUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        // =========================================================================
        // 1. GET FULL PERSONALIZED DASHBOARD SUMMARY
        // GET /api/dashboard/summary
        // GET /api/dashboard
        // =========================================================================
        [HttpGet]
        [HttpGet("summary")]
        public async Task<IActionResult> GetDashboardSummary()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "User profile not found." });
            }

            var nowUtc = DateTime.UtcNow;

            // 1. Calculate Profile Completion Percentage
            var profile = user.Profile;
            int completionScore = 0;
            if (!string.IsNullOrWhiteSpace(user.FullName)) completionScore += 20;
            if (!string.IsNullOrWhiteSpace(profile?.Bio)) completionScore += 20;
            if (!string.IsNullOrWhiteSpace(profile?.University)) completionScore += 20;
            if (!string.IsNullOrWhiteSpace(profile?.Department)) completionScore += 20;
            if (!string.IsNullOrWhiteSpace(profile?.Interests) || !string.IsNullOrWhiteSpace(profile?.Skills)) completionScore += 20;

            // 2. Metrics Calculation
            // Workspaces joined
            var workspaceMemberships = await _context.WorkspaceMembers
                .Where(wm => wm.UserId == userId)
                .Include(wm => wm.Workspace)
                .ToListAsync();

            var workspaceIds = workspaceMemberships.Select(wm => wm.WorkspaceId).ToList();

            // Open projects supervised by user
            var supervisedProjectsCount = await _context.OpenProjects
                .CountAsync(p => p.SupervisorId == userId);

            var activeProjectsCount = workspaceMemberships.Count + supervisedProjectsCount;

            // Pending tasks assigned to user or in user's workspaces
            var pendingTasksQuery = _context.WorkspaceTasks
                .Where(t => (t.AssignedToId == userId || (workspaceIds.Contains(t.WorkspaceId) && t.AssignedToId == null)) &&
                            t.Status != "Done");

            var pendingTasksCount = await pendingTasksQuery.CountAsync();

            // Bookmarks count (General Bookmarks + Event Bookmarks)
            var generalBookmarksCount = await _context.Bookmarks
                .CountAsync(b => b.UserId == userId);

            var eventBookmarks = await _context.EventBookmarks
                .Where(eb => eb.UserId == userId)
                .Include(eb => eb.Event)
                .ToListAsync();

            var savedResourcesCount = generalBookmarksCount + eventBookmarks.Count;

            // Unread notifications
            var unreadNotificationsCount = await _context.Notifications
                .CountAsync(n => n.UserId == userId && !n.IsRead);

            // Network connections (Accepted)
            var networkConnectionsCount = await _context.UserConnections
                .CountAsync(c => (c.RequesterId == userId || c.TargetId == userId) && c.Status == "Accepted");

            // Imminent Deadlines Count (< 30 days)
            var maxDeadlineDate = nowUtc.AddDays(30);

            var imminentTasksCount = await _context.WorkspaceTasks
                .CountAsync(t => (t.AssignedToId == userId || workspaceIds.Contains(t.WorkspaceId)) &&
                                 t.Status != "Done" &&
                                 t.DueDate.HasValue &&
                                 t.DueDate.Value >= nowUtc &&
                                 t.DueDate.Value <= maxDeadlineDate);

            var imminentEventsCount = eventBookmarks
                .Count(eb => eb.Event != null &&
                             eb.Event.SubmissionDeadline.HasValue &&
                             eb.Event.SubmissionDeadline.Value >= nowUtc &&
                             eb.Event.SubmissionDeadline.Value <= maxDeadlineDate);

            var totalUpcomingDeadlinesCount = imminentTasksCount + imminentEventsCount;

            var metrics = new DashboardMetricsDto
            {
                ActiveProjectsCount = activeProjectsCount,
                PendingTasksCount = pendingTasksCount,
                UpcomingDeadlinesCount = totalUpcomingDeadlinesCount,
                SavedResourcesCount = savedResourcesCount,
                UnreadNotificationsCount = unreadNotificationsCount,
                NetworkConnectionsCount = networkConnectionsCount
            };

            // 3. Active Workspaces Summary
            var activeWorkspaces = new List<WorkspaceSummaryItemDto>();
            foreach (var wm in workspaceMemberships)
            {
                if (wm.Workspace == null) continue;

                var tasks = await _context.WorkspaceTasks
                    .Where(t => t.WorkspaceId == wm.WorkspaceId)
                    .ToListAsync();

                var totalTasks = tasks.Count;
                var completedTasks = tasks.Count(t => t.Status == "Done");
                var progress = totalTasks > 0 ? Math.Round((completedTasks * 100.0) / totalTasks, 1) : 0;

                var nextTask = tasks
                    .Where(t => t.Status != "Done")
                    .OrderBy(t => t.DueDate ?? DateTime.MaxValue)
                    .ThenBy(t => t.CreatedAt)
                    .FirstOrDefault();

                activeWorkspaces.Add(new WorkspaceSummaryItemDto
                {
                    WorkspaceId = wm.WorkspaceId,
                    Title = wm.Workspace.Name,
                    RoleInWorkspace = wm.Role,
                    TotalTasks = totalTasks,
                    CompletedTasks = completedTasks,
                    ProgressPercentage = progress,
                    NextPendingTask = nextTask?.Title
                });
            }

            // 4. Imminent Deadlines Timeline
            var deadlines = new List<UpcomingDeadlineDto>();

            // Task deadlines
            var imminentTasks = await _context.WorkspaceTasks
                .Include(t => t.Workspace)
                .Where(t => (t.AssignedToId == userId || workspaceIds.Contains(t.WorkspaceId)) &&
                            t.Status != "Done" &&
                            t.DueDate.HasValue &&
                            t.DueDate.Value >= nowUtc &&
                            t.DueDate.Value <= maxDeadlineDate)
                .OrderBy(t => t.DueDate!.Value)
                .Take(5)
                .ToListAsync();

            foreach (var task in imminentTasks)
            {
                var daysRemaining = (int)Math.Ceiling((task.DueDate!.Value - nowUtc).TotalDays);
                deadlines.Add(new UpcomingDeadlineDto
                {
                    Title = task.Title,
                    DeadlineType = task.IsMilestone ? "Milestone" : "Task",
                    DeadlineDate = task.DueDate.Value,
                    DaysRemaining = daysRemaining,
                    ContextTitle = task.Workspace?.Name ?? "Workspace Task",
                    ActionUrl = $"/workspace/{task.WorkspaceId}",
                    IsUrgent = daysRemaining <= 7
                });
            }

            // Academic Event Deadlines from Bookmarks
            foreach (var eb in eventBookmarks)
            {
                if (eb.Event == null || !eb.Event.SubmissionDeadline.HasValue) continue;
                if (eb.Event.SubmissionDeadline.Value < nowUtc || eb.Event.SubmissionDeadline.Value > maxDeadlineDate) continue;

                var daysRemaining = (int)Math.Ceiling((eb.Event.SubmissionDeadline.Value - nowUtc).TotalDays);
                deadlines.Add(new UpcomingDeadlineDto
                {
                    Title = eb.Event.Title,
                    DeadlineType = eb.Event.EventType == "CallForPapers" ? "CallForPapers" : "Conference",
                    DeadlineDate = eb.Event.SubmissionDeadline.Value,
                    DaysRemaining = daysRemaining,
                    ContextTitle = eb.Event.Organizer,
                    ActionUrl = $"/events/{eb.EventId}",
                    IsUrgent = daysRemaining <= 7
                });
            }

            deadlines = deadlines.OrderBy(d => d.DeadlineDate).Take(6).ToList();

            // 4b. Project Summaries (Supervised Projects & User Applications) [T-029.4]
            var supervisedProjects = await _context.OpenProjects
                .Where(p => p.SupervisorId == userId)
                .Include(p => p.Applications)
                .OrderByDescending(p => p.CreatedAt)
                .Take(5)
                .Select(p => new ProjectSummaryDto
                {
                    ProjectId = p.Id,
                    Title = p.Title,
                    Description = p.Description,
                    Department = p.Department,
                    Role = "Supervisor",
                    Status = p.Status,
                    ApplicantsCount = p.Applications != null ? p.Applications.Count : 0,
                    MaxPositions = p.MaxStudents,
                    IsFunded = p.IsFunded,
                    SupervisorName = user.FullName,
                    RequiredSkills = p.RequiredSkills,
                    CreatedOrAppliedAt = p.CreatedAt
                })
                .ToListAsync();

            var appliedProjects = await _context.ProjectApplications
                .Where(a => a.ApplicantId == userId)
                .Include(a => a.Project)
                    .ThenInclude(p => p!.Supervisor)
                .OrderByDescending(a => a.AppliedAt)
                .Take(5)
                .Select(a => new ProjectSummaryDto
                {
                    ProjectId = a.ProjectId,
                    Title = a.Project != null ? a.Project.Title : "Research Project",
                    Description = a.Project != null ? a.Project.Description : a.CoverLetter,
                    Department = a.Project != null ? a.Project.Department : null,
                    Role = "Applicant",
                    Status = a.Status,
                    ApplicantsCount = 0,
                    MaxPositions = a.Project != null ? a.Project.MaxStudents : 1,
                    IsFunded = a.Project != null && a.Project.IsFunded,
                    SupervisorName = a.Project != null && a.Project.Supervisor != null ? a.Project.Supervisor.FullName : "Project Lead",
                    RequiredSkills = a.Project != null ? a.Project.RequiredSkills : null,
                    CreatedOrAppliedAt = a.AppliedAt
                })
                .ToListAsync();

            var combinedProjects = supervisedProjects.Concat(appliedProjects)
                .OrderByDescending(p => p.CreatedOrAppliedAt)
                .Take(6)
                .ToList();

            // 5. AI Recommendations Preview & Meta Summary [T-029.4]
            var allActiveRecs = await _context.UserRecommendationRecords
                .Where(r => r.UserId == userId && r.Status == "Active")
                .OrderByDescending(r => r.MatchScore)
                .ToListAsync();

            if (!allActiveRecs.Any())
            {
                // Trigger AI matching service to generate initial recommendations
                try
                {
                    var aiResult = await _aiMatchingService.GetAllRecommendationsAsync(userId);
                    allActiveRecs = await _context.UserRecommendationRecords
                        .Where(r => r.UserId == userId && r.Status == "Active")
                        .OrderByDescending(r => r.MatchScore)
                        .ToListAsync();
                }
                catch
                {
                    // Graceful fallback to empty recommendations list if AI matching is cold
                }
            }

            var recSummary = new RecommendationMetaSummaryDto
            {
                TotalActiveCount = allActiveRecs.Count,
                HighConfidenceCount = allActiveRecs.Count(r => r.MatchScore >= 85),
                SupervisorsCount = allActiveRecs.Count(r => r.Category.Equals("Supervisor", StringComparison.OrdinalIgnoreCase)),
                TeammatesCount = allActiveRecs.Count(r => r.Category.Equals("Teammate", StringComparison.OrdinalIgnoreCase) || r.Category.Equals("Researcher", StringComparison.OrdinalIgnoreCase)),
                ProjectsCount = allActiveRecs.Count(r => r.Category.Equals("Project", StringComparison.OrdinalIgnoreCase)),
                PublicationsCount = allActiveRecs.Count(r => r.Category.Equals("Publication", StringComparison.OrdinalIgnoreCase))
            };

            var topRecs = allActiveRecs.Take(6).ToList();

            // 5b. Recent Notifications & Alerts [T-029.4]
            var recentNotifs = await _context.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(6)
                .Select(n => new NotificationSummaryDto
                {
                    NotificationId = n.Id,
                    Title = n.Title,
                    Message = n.Message,
                    Type = n.Type,
                    RelatedEntityId = n.RelatedEntityId,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                    ActionUrl = n.Type == "Connection" ? "/network" :
                                n.Type == "Project" ? "/projects" :
                                n.Type == "Workspace" ? "/workspaces" :
                                n.Type == "Idea" ? "/ideas" : "/notifications"
                })
                .ToListAsync();

            // 6. Recent Community Discussions
            var recentPosts = await _context.CommunityPosts
                .Include(p => p.Author)
                .OrderByDescending(p => p.CreatedAt)
                .Take(4)
                .Select(p => new CommunityPostSummaryDto
                {
                    PostId = p.Id,
                    Title = p.Title,
                    AuthorName = p.Author != null ? p.Author.FullName : "Researcher",
                    Category = p.Category,
                    ReactionsCount = p.ReactionsCount,
                    CommentsCount = p.CommentsCount,
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            // 7. Recent Personalized Activity Log
            var activities = await _context.PersonalizedActivityLogs
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .Take(6)
                .ToListAsync();

            if (!activities.Any())
            {
                // Auto-seed initial onboarding activities so new users have a welcoming timeline
                var initialActivities = new List<PersonalizedActivityLog>
                {
                    new PersonalizedActivityLog
                    {
                        UserId = userId,
                        ActivityType = "ProfileActivated",
                        Title = "Joined ResCollab Research Network",
                        Description = $"Welcome {user.FullName}! Your researcher account has been activated.",
                        TargetUrl = "/profile",
                        CreatedAt = user.Profile != null ? nowUtc.AddHours(-1) : nowUtc
                    }
                };

                if (workspaceMemberships.Any())
                {
                    var firstWorkspace = workspaceMemberships.First();
                    initialActivities.Add(new PersonalizedActivityLog
                    {
                        UserId = userId,
                        ActivityType = "ProjectJoined",
                        Title = $"Joined Workspace: {firstWorkspace.Workspace?.Name ?? "Research Workspace"}",
                        Description = $"Collaborating as {firstWorkspace.Role}.",
                        TargetUrl = $"/workspace/{firstWorkspace.WorkspaceId}",
                        CreatedAt = nowUtc.AddMinutes(-30)
                    });
                }

                _context.PersonalizedActivityLogs.AddRange(initialActivities);
                await _context.SaveChangesAsync();
                activities = initialActivities;
            }

            var dashboardDto = new PersonalizedDashboardDto
            {
                UserId = userId,
                FullName = user.FullName,
                Role = user.Role,
                Institution = profile?.University,
                Department = profile?.Department,
                ProfileCompletionPercentage = completionScore,
                Metrics = metrics,
                ActiveWorkspaces = activeWorkspaces,
                ProjectSummaries = combinedProjects,
                UpcomingDeadlines = deadlines,
                TopRecommendations = topRecs,
                RecommendationSummary = recSummary,
                RecentNotifications = recentNotifs,
                RecentDiscussions = recentPosts,
                RecentActivities = activities
            };

            return Ok(dashboardDto);
        }

        // =========================================================================
        // 2. GET DASHBOARD METRICS ONLY (FOR QUICK BADGE/COUNTER REFRESH)
        // GET /api/dashboard/metrics
        // =========================================================================
        [HttpGet("metrics")]
        public async Task<IActionResult> GetDashboardMetrics()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var nowUtc = DateTime.UtcNow;
            var maxDeadlineDate = nowUtc.AddDays(30);

            var workspaceMemberships = await _context.WorkspaceMembers
                .Where(wm => wm.UserId == userId)
                .Select(wm => wm.WorkspaceId)
                .ToListAsync();

            var supervisedCount = await _context.OpenProjects
                .CountAsync(p => p.SupervisorId == userId);

            var pendingTasksCount = await _context.WorkspaceTasks
                .CountAsync(t => (t.AssignedToId == userId || (workspaceMemberships.Contains(t.WorkspaceId) && t.AssignedToId == null)) &&
                                 t.Status != "Done");

            var generalBookmarks = await _context.Bookmarks
                .CountAsync(b => b.UserId == userId);

            var eventBookmarks = await _context.EventBookmarks
                .Where(eb => eb.UserId == userId)
                .Include(eb => eb.Event)
                .ToListAsync();

            var imminentTasksCount = await _context.WorkspaceTasks
                .CountAsync(t => (t.AssignedToId == userId || workspaceMemberships.Contains(t.WorkspaceId)) &&
                                 t.Status != "Done" &&
                                 t.DueDate.HasValue &&
                                 t.DueDate.Value >= nowUtc &&
                                 t.DueDate.Value <= maxDeadlineDate);

            var imminentEventsCount = eventBookmarks
                .Count(eb => eb.Event != null &&
                             eb.Event.SubmissionDeadline.HasValue &&
                             eb.Event.SubmissionDeadline.Value >= nowUtc &&
                             eb.Event.SubmissionDeadline.Value <= maxDeadlineDate);

            var metrics = new DashboardMetricsDto
            {
                ActiveProjectsCount = workspaceMemberships.Count + supervisedCount,
                PendingTasksCount = pendingTasksCount,
                UpcomingDeadlinesCount = imminentTasksCount + imminentEventsCount,
                SavedResourcesCount = generalBookmarks + eventBookmarks.Count,
                UnreadNotificationsCount = await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead),
                NetworkConnectionsCount = await _context.UserConnections.CountAsync(c => (c.RequesterId == userId || c.TargetId == userId) && c.Status == "Accepted")
            };

            return Ok(metrics);
        }

        // =========================================================================
        // 3. GET IMMINENT DEADLINES
        // GET /api/dashboard/deadlines?days=30
        // =========================================================================
        [HttpGet("deadlines")]
        public async Task<IActionResult> GetDeadlines([FromQuery] int days = 30)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var nowUtc = DateTime.UtcNow;
            var maxDeadlineDate = nowUtc.AddDays(Math.Max(1, days));

            var workspaceMemberships = await _context.WorkspaceMembers
                .Where(wm => wm.UserId == userId)
                .Select(wm => wm.WorkspaceId)
                .ToListAsync();

            var deadlines = new List<UpcomingDeadlineDto>();

            // Tasks
            var tasks = await _context.WorkspaceTasks
                .Include(t => t.Workspace)
                .Where(t => (t.AssignedToId == userId || workspaceMemberships.Contains(t.WorkspaceId)) &&
                            t.Status != "Done" &&
                            t.DueDate.HasValue &&
                            t.DueDate.Value >= nowUtc &&
                            t.DueDate.Value <= maxDeadlineDate)
                .OrderBy(t => t.DueDate!.Value)
                .ToListAsync();

            foreach (var task in tasks)
            {
                var daysRemaining = (int)Math.Ceiling((task.DueDate!.Value - nowUtc).TotalDays);
                deadlines.Add(new UpcomingDeadlineDto
                {
                    Title = task.Title,
                    DeadlineType = task.IsMilestone ? "Milestone" : "Task",
                    DeadlineDate = task.DueDate.Value,
                    DaysRemaining = daysRemaining,
                    ContextTitle = task.Workspace?.Name ?? "Workspace Task",
                    ActionUrl = $"/workspace/{task.WorkspaceId}",
                    IsUrgent = daysRemaining <= 7
                });
            }

            // Events
            var eventBookmarks = await _context.EventBookmarks
                .Include(eb => eb.Event)
                .Where(eb => eb.UserId == userId)
                .ToListAsync();

            foreach (var eb in eventBookmarks)
            {
                if (eb.Event == null || !eb.Event.SubmissionDeadline.HasValue) continue;
                if (eb.Event.SubmissionDeadline.Value < nowUtc || eb.Event.SubmissionDeadline.Value > maxDeadlineDate) continue;

                var daysRemaining = (int)Math.Ceiling((eb.Event.SubmissionDeadline.Value - nowUtc).TotalDays);
                deadlines.Add(new UpcomingDeadlineDto
                {
                    Title = eb.Event.Title,
                    DeadlineType = eb.Event.EventType == "CallForPapers" ? "CallForPapers" : "Conference",
                    DeadlineDate = eb.Event.SubmissionDeadline.Value,
                    DaysRemaining = daysRemaining,
                    ContextTitle = eb.Event.Organizer,
                    ActionUrl = $"/events/{eb.EventId}",
                    IsUrgent = daysRemaining <= 7
                });
            }

            return Ok(deadlines.OrderBy(d => d.DeadlineDate).ToList());
        }

        // =========================================================================
        // 4. GET & UPDATE WIDGET PREFERENCES
        // GET /api/dashboard/preferences
        // PUT /api/dashboard/preferences
        // =========================================================================
        [HttpGet("preferences")]
        public async Task<IActionResult> GetWidgetPreferences()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var prefs = await _context.DashboardWidgetPreferences
                .Where(p => p.UserId == userId)
                .OrderBy(p => p.DisplayOrder)
                .ToListAsync();

            if (!prefs.Any())
            {
                // Default widget list
                var defaults = new List<DashboardWidgetPreference>
                {
                    new DashboardWidgetPreference { UserId = userId, WidgetKey = "Workspaces", IsVisible = true, DisplayOrder = 1 },
                    new DashboardWidgetPreference { UserId = userId, WidgetKey = "Projects", IsVisible = true, DisplayOrder = 2 },
                    new DashboardWidgetPreference { UserId = userId, WidgetKey = "Deadlines", IsVisible = true, DisplayOrder = 3 },
                    new DashboardWidgetPreference { UserId = userId, WidgetKey = "Recommendations", IsVisible = true, DisplayOrder = 4 },
                    new DashboardWidgetPreference { UserId = userId, WidgetKey = "Notifications", IsVisible = true, DisplayOrder = 5 },
                    new DashboardWidgetPreference { UserId = userId, WidgetKey = "Community", IsVisible = true, DisplayOrder = 6 },
                    new DashboardWidgetPreference { UserId = userId, WidgetKey = "Bookmarks", IsVisible = true, DisplayOrder = 7 },
                    new DashboardWidgetPreference { UserId = userId, WidgetKey = "ActivityLog", IsVisible = true, DisplayOrder = 8 }
                };

                _context.DashboardWidgetPreferences.AddRange(defaults);
                await _context.SaveChangesAsync();
                return Ok(defaults);
            }

            return Ok(prefs);
        }

        [HttpPut("preferences")]
        public async Task<IActionResult> UpdateWidgetPreferences([FromBody] UpdateWidgetPreferencesRequest req)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            if (req.Preferences == null || !req.Preferences.Any())
            {
                return BadRequest(new { message = "Preferences list cannot be empty." });
            }

            var existing = await _context.DashboardWidgetPreferences
                .Where(p => p.UserId == userId)
                .ToListAsync();

            foreach (var item in req.Preferences)
            {
                var pref = existing.FirstOrDefault(e => e.WidgetKey.Equals(item.WidgetKey, StringComparison.OrdinalIgnoreCase));
                if (pref != null)
                {
                    pref.IsVisible = item.IsVisible;
                    pref.DisplayOrder = item.DisplayOrder;
                    pref.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _context.DashboardWidgetPreferences.Add(new DashboardWidgetPreference
                    {
                        UserId = userId,
                        WidgetKey = item.WidgetKey,
                        IsVisible = item.IsVisible,
                        DisplayOrder = item.DisplayOrder,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();

            var updated = await _context.DashboardWidgetPreferences
                .Where(p => p.UserId == userId)
                .OrderBy(p => p.DisplayOrder)
                .ToListAsync();

            return Ok(updated);
        }

        // =========================================================================
        // 5. GET & LOG PERSONAL ACTIVITIES
        // GET /api/dashboard/activities
        // POST /api/dashboard/activity
        // =========================================================================
        [HttpGet("activities")]
        public async Task<IActionResult> GetActivities([FromQuery] int limit = 15)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var activities = await _context.PersonalizedActivityLogs
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .Take(Math.Max(1, Math.Min(50, limit)))
                .ToListAsync();

            return Ok(activities);
        }

        [HttpPost("activity")]
        public async Task<IActionResult> LogActivity([FromBody] LogActivityRequest req)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Title))
            {
                return BadRequest(new { message = "Activity title is required." });
            }

            var log = new PersonalizedActivityLog
            {
                UserId = userId,
                ActivityType = string.IsNullOrWhiteSpace(req.ActivityType) ? "CustomAction" : req.ActivityType.Trim(),
                Title = req.Title.Trim(),
                Description = req.Description?.Trim(),
                TargetUrl = req.TargetUrl?.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _context.PersonalizedActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            return StatusCode(201, log);
        }

        // =========================================================================
        // 6. DEDICATED PROJECT, RECOMMENDATION & NOTIFICATION ENDPOINTS [T-029.4]
        // =========================================================================

        [HttpGet("projects")]
        public async Task<IActionResult> GetProjectSummaries()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            var userName = user?.FullName ?? "Researcher";

            var supervisedProjects = await _context.OpenProjects
                .Where(p => p.SupervisorId == userId)
                .Include(p => p.Applications)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new ProjectSummaryDto
                {
                    ProjectId = p.Id,
                    Title = p.Title,
                    Description = p.Description,
                    Department = p.Department,
                    Role = "Supervisor",
                    Status = p.Status,
                    ApplicantsCount = p.Applications != null ? p.Applications.Count : 0,
                    MaxPositions = p.MaxStudents,
                    IsFunded = p.IsFunded,
                    SupervisorName = userName,
                    RequiredSkills = p.RequiredSkills,
                    CreatedOrAppliedAt = p.CreatedAt
                })
                .ToListAsync();

            var appliedProjects = await _context.ProjectApplications
                .Where(a => a.ApplicantId == userId)
                .Include(a => a.Project)
                    .ThenInclude(p => p!.Supervisor)
                .OrderByDescending(a => a.AppliedAt)
                .Select(a => new ProjectSummaryDto
                {
                    ProjectId = a.ProjectId,
                    Title = a.Project != null ? a.Project.Title : "Research Project",
                    Description = a.Project != null ? a.Project.Description : a.CoverLetter,
                    Department = a.Project != null ? a.Project.Department : null,
                    Role = "Applicant",
                    Status = a.Status,
                    ApplicantsCount = 0,
                    MaxPositions = a.Project != null ? a.Project.MaxStudents : 1,
                    IsFunded = a.Project != null && a.Project.IsFunded,
                    SupervisorName = a.Project != null && a.Project.Supervisor != null ? a.Project.Supervisor.FullName : "Project Lead",
                    RequiredSkills = a.Project != null ? a.Project.RequiredSkills : null,
                    CreatedOrAppliedAt = a.AppliedAt
                })
                .ToListAsync();

            var combined = supervisedProjects.Concat(appliedProjects)
                .OrderByDescending(p => p.CreatedOrAppliedAt)
                .ToList();

            return Ok(combined);
        }

        [HttpGet("recommendations")]
        public async Task<IActionResult> GetRecommendationSummaries()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var activeRecs = await _context.UserRecommendationRecords
                .Where(r => r.UserId == userId && r.Status == "Active")
                .OrderByDescending(r => r.MatchScore)
                .ToListAsync();

            if (!activeRecs.Any())
            {
                try
                {
                    await _aiMatchingService.GetAllRecommendationsAsync(userId);
                    activeRecs = await _context.UserRecommendationRecords
                        .Where(r => r.UserId == userId && r.Status == "Active")
                        .OrderByDescending(r => r.MatchScore)
                        .ToListAsync();
                }
                catch { }
            }

            var summary = new RecommendationMetaSummaryDto
            {
                TotalActiveCount = activeRecs.Count,
                HighConfidenceCount = activeRecs.Count(r => r.MatchScore >= 85),
                SupervisorsCount = activeRecs.Count(r => r.Category.Equals("Supervisor", StringComparison.OrdinalIgnoreCase)),
                TeammatesCount = activeRecs.Count(r => r.Category.Equals("Teammate", StringComparison.OrdinalIgnoreCase) || r.Category.Equals("Researcher", StringComparison.OrdinalIgnoreCase)),
                ProjectsCount = activeRecs.Count(r => r.Category.Equals("Project", StringComparison.OrdinalIgnoreCase)),
                PublicationsCount = activeRecs.Count(r => r.Category.Equals("Publication", StringComparison.OrdinalIgnoreCase))
            };

            return Ok(new
            {
                Summary = summary,
                Recommendations = activeRecs
            });
        }

        [HttpPost("recommendations/{id}/dismiss")]
        public async Task<IActionResult> DismissRecommendation(int id)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var rec = await _context.UserRecommendationRecords
                .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

            if (rec == null)
            {
                return NotFound(new { message = "Recommendation not found." });
            }

            rec.Status = "Dismissed";
            await _context.SaveChangesAsync();

            return Ok(new { message = "Recommendation dismissed successfully." });
        }

        [HttpPost("recommendations/{id}/accept")]
        public async Task<IActionResult> AcceptRecommendation(int id)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var rec = await _context.UserRecommendationRecords
                .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

            if (rec == null)
            {
                return NotFound(new { message = "Recommendation not found." });
            }

            rec.Status = "Accepted";

            // Log activity
            _context.PersonalizedActivityLogs.Add(new PersonalizedActivityLog
            {
                UserId = userId,
                ActivityType = "RecommendationAccepted",
                Title = $"Connected with recommendation: {rec.Title}",
                Description = $"Accepted {rec.Category} recommendation with {rec.MatchScore}% relevance match.",
                TargetUrl = rec.Category == "Supervisor" || rec.Category == "Teammate" ? $"/profile/{rec.TargetEntityId}" : "/recommendations",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new { message = "Recommendation accepted successfully." });
        }

        [HttpGet("notifications")]
        public async Task<IActionResult> GetNotificationSummaries([FromQuery] int limit = 10)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var notifs = await _context.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(Math.Max(1, Math.Min(30, limit)))
                .Select(n => new NotificationSummaryDto
                {
                    NotificationId = n.Id,
                    Title = n.Title,
                    Message = n.Message,
                    Type = n.Type,
                    RelatedEntityId = n.RelatedEntityId,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                    ActionUrl = n.Type == "Connection" ? "/network" :
                                n.Type == "Project" ? "/projects" :
                                n.Type == "Workspace" ? "/workspaces" :
                                n.Type == "Idea" ? "/ideas" : "/notifications"
                })
                .ToListAsync();

            return Ok(notifs);
        }

        [HttpPost("notifications/{id}/read")]
        public async Task<IActionResult> MarkNotificationRead(int id)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var notif = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

            if (notif == null)
            {
                return NotFound(new { message = "Notification not found." });
            }

            notif.IsRead = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Notification marked as read." });
        }

        [HttpPost("notifications/read-all")]
        public async Task<IActionResult> MarkAllNotificationsRead()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var unread = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            foreach (var n in unread)
            {
                n.IsRead = true;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = $"{unread.Count} notifications marked as read." });
        }
    }

    // =========================================================================
    // DTO REQUEST MODELS
    // =========================================================================

    public class UpdateWidgetPreferencesRequest
    {
        public List<WidgetPreferenceItemDto> Preferences { get; set; } = new List<WidgetPreferenceItemDto>();
    }

    public class WidgetPreferenceItemDto
    {
        [Required]
        public string WidgetKey { get; set; } = string.Empty;
        public bool IsVisible { get; set; } = true;
        public int DisplayOrder { get; set; }
    }

    public class LogActivityRequest
    {
        public string? ActivityType { get; set; }

        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        public string? TargetUrl { get; set; }
    }
}
