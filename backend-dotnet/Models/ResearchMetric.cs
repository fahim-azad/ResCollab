using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Records snapshot metrics and historical trend entries for universities, departments, and research clusters
    public class InstitutionalMetric
    {
        [Key]
        public int Id { get; set; }

        public int? InstitutionId { get; set; }

        public int? DepartmentId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = "Publications"; // "Publications", "Collaborations", "Projects", "Funding", "Milestones"

        [Required]
        [MaxLength(150)]
        public string MetricType { get; set; } = string.Empty; // "TotalPublications", "ActiveProjects", "CrossInstitutionalCount", "TaskVelocity"

        public double MetricValue { get; set; }

        [MaxLength(50)]
        public string Period { get; set; } = "AllTime"; // "AllTime", "Annual", "Quarterly", "Monthly"

        public int PeriodYear { get; set; } = DateTime.UtcNow.Year;

        public int? PeriodMonth { get; set; }

        [MaxLength(4000)]
        public string? MetadataJson { get; set; }

        public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("InstitutionId")]
        public University? Institution { get; set; }

        [ForeignKey("DepartmentId")]
        public Department? Department { get; set; }
    }

    // Cached roll-up snapshot for fast dashboard delivery
    public class ResearchAnalyticsSnapshot
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string ScopeType { get; set; } = "Institution"; // "Institution", "Department", "Team", "Researcher"

        public int ScopeId { get; set; } // Target UniversityId, DepartmentId, WorkspaceId, or UserId

        [MaxLength(200)]
        public string ScopeName { get; set; } = string.Empty;

        public int TotalPublications { get; set; }

        public int TotalProjects { get; set; }

        public int ActiveCollaborations { get; set; }

        public int CompletedTasks { get; set; }

        public int TotalTasks { get; set; }

        public double ProgressPercentage { get; set; }

        public int ExternalPartnerships { get; set; }

        public DateTime LastCalculated { get; set; } = DateTime.UtcNow;
    }

    // Tracks inter-departmental and cross-institutional collaboration edges
    public class CollaborationNetworkMetric
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string SourceInstitution { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string TargetInstitution { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? SourceDepartment { get; set; }

        [MaxLength(200)]
        public string? TargetDepartment { get; set; }

        public int JointPublicationsCount { get; set; }

        public int JointProjectsCount { get; set; }

        public int ActiveCoAuthors { get; set; }

        public DateTime LastCalculated { get; set; } = DateTime.UtcNow;
    }
}
