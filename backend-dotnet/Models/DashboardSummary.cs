using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Stores user-specific layout customization and widget visibility
    public class DashboardWidgetPreference
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }

        // "Workspaces", "Deadlines", "Recommendations", "Community", "Bookmarks"
        [Required]
        [MaxLength(100)]
        public string WidgetKey { get; set; } = string.Empty;

        public bool IsVisible { get; set; } = true;

        public int DisplayOrder { get; set; } = 0;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // Captures user activity events for the personal activity feed
    public class PersonalizedActivityLog
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }

        // "ProjectJoined", "TaskCompleted", "PaperBookmarked", "PostCreated", "ConnectionAccepted"
        [Required]
        [MaxLength(100)]
        public string ActivityType { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        public string? TargetUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // Aggregate DTOs for the Personalized Dashboard API
    public class PersonalizedDashboardDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Institution { get; set; }
        public string? Department { get; set; }
        public int ProfileCompletionPercentage { get; set; }

        // Metrics Summary
        public DashboardMetricsDto Metrics { get; set; } = new DashboardMetricsDto();

        // Active Workspaces & Tasks
        public List<WorkspaceSummaryItemDto> ActiveWorkspaces { get; set; } = new List<WorkspaceSummaryItemDto>();

        // Imminent Deadlines
        public List<UpcomingDeadlineDto> UpcomingDeadlines { get; set; } = new List<UpcomingDeadlineDto>();

        // AI Recommendations Preview
        public List<UserRecommendationRecord> TopRecommendations { get; set; } = new List<UserRecommendationRecord>();

        // Recent Community Discussions
        public List<CommunityPostSummaryDto> RecentDiscussions { get; set; } = new List<CommunityPostSummaryDto>();

        // Recent Audit Activity Log
        public List<PersonalizedActivityLog> RecentActivities { get; set; } = new List<PersonalizedActivityLog>();
    }

    public class DashboardMetricsDto
    {
        public int ActiveProjectsCount { get; set; }
        public int PendingTasksCount { get; set; }
        public int UpcomingDeadlinesCount { get; set; }
        public int SavedResourcesCount { get; set; }
        public int UnreadNotificationsCount { get; set; }
        public int NetworkConnectionsCount { get; set; }
    }

    public class UpcomingDeadlineDto
    {
        public string Title { get; set; } = string.Empty;
        public string DeadlineType { get; set; } = "Task"; // "Task", "CallForPapers", "Registration"
        public DateTime DeadlineDate { get; set; }
        public int DaysRemaining { get; set; }
        public string? ContextTitle { get; set; } // Workspace or Conference Name
        public string? ActionUrl { get; set; }
        public bool IsUrgent { get; set; } // <= 7 days
    }

    public class WorkspaceSummaryItemDto
    {
        public int WorkspaceId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? RoleInWorkspace { get; set; }
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public double ProgressPercentage { get; set; }
        public string? NextPendingTask { get; set; }
    }

    public class CommunityPostSummaryDto
    {
        public int PostId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string AuthorName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int ReactionsCount { get; set; }
        public int CommentsCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
