using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents a user-submitted flag against inappropriate content or users
    public class ReportSubmission
    {
        [Key]
        public int Id { get; set; }

        public int ReporterId { get; set; }

        // "User", "CommunityPost", "CommunityComment", "OpenProject", "ResearchIdea", "Publication"
        [Required]
        [MaxLength(50)]
        public string TargetType { get; set; } = string.Empty;

        public int TargetId { get; set; }

        // Person responsible for the reported content (can be null for system-collected records)
        public int? ReportedUserId { get; set; }

        // "Plagiarism", "Harassment", "Spam", "Misinformation", "CopyrightViolation", "Other"
        [Required]
        [MaxLength(100)]
        public string Reason { get; set; } = string.Empty;

        [Required]
        [MaxLength(2000)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? EvidenceUrl { get; set; }

        // "Pending", "UnderReview", "Resolved", "Dismissed"
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending";

        public int? ModeratorId { get; set; }

        [MaxLength(2000)]
        public string? ResolutionNote { get; set; }

        // "None", "ContentRemoved", "WarningIssued", "AccountSuspended"
        [MaxLength(100)]
        public string? ActionTaken { get; set; }

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ResolvedAt { get; set; }

        // Navigation
        [ForeignKey("ReporterId")]
        public User? Reporter { get; set; }

        [ForeignKey("ReportedUserId")]
        public User? ReportedUser { get; set; }

        [ForeignKey("ModeratorId")]
        public User? Moderator { get; set; }

        public ICollection<ModerationAuditLog> AuditLogs { get; set; } = new List<ModerationAuditLog>();
    }

    // Immutable audit trail for every action taken by a moderator
    public class ModerationAuditLog
    {
        [Key]
        public int Id { get; set; }

        public int ReportId { get; set; }

        public int ModeratorId { get; set; }

        [Required]
        [MaxLength(50)]
        public string PreviousStatus { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string NewStatus { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string ActionDetails { get; set; } = string.Empty;

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ReportId")]
        public ReportSubmission? Report { get; set; }

        [ForeignKey("ModeratorId")]
        public User? Moderator { get; set; }
    }

    // DTOs for Reporting & Moderation
    public class CreateReportDto
    {
        [Required]
        [MaxLength(50)]
        public string TargetType { get; set; } = string.Empty;

        [Required]
        public int TargetId { get; set; }

        public int? ReportedUserId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Reason { get; set; } = string.Empty;

        [Required]
        [MaxLength(2000)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? EvidenceUrl { get; set; }
    }

    public class ModerationDecisionDto
    {
        // "UnderReview", "Resolved", "Dismissed"
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Resolved";

        [MaxLength(2000)]
        public string? ResolutionNote { get; set; }

        // "None", "ContentRemoved", "WarningIssued", "AccountSuspended"
        [MaxLength(100)]
        public string? ActionTaken { get; set; } = "None";
    }

    public class ReportSummaryDto
    {
        public int Id { get; set; }
        public string TargetType { get; set; } = string.Empty;
        public int TargetId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string ReporterName { get; set; } = string.Empty;
        public string? ReportedUserName { get; set; }
        public string? ModeratorName { get; set; }
        public string? ActionTaken { get; set; }
        public DateTime SubmittedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }
}
