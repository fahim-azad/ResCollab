using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // User-configured or system-default weights for AI recommendation engine
    public class RecommendationPreference
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }

        // Weight distribution (Total normalized to 1.0 or percentage 0 - 100)
        public double InterestWeight { get; set; } = 0.35;

        public double SkillWeight { get; set; } = 0.30;

        public double InstitutionWeight { get; set; } = 0.15;

        public double ActivityWeight { get; set; } = 0.20;

        // Preferred target recommendation categories (comma-separated: "Supervisors,Teammates,Papers,Projects")
        [MaxLength(500)]
        public string EnabledCategories { get; set; } = "Supervisors,Teammates,Researchers,Publications,Projects";

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // Persisted or cached AI recommendations generated for a user
    public class UserRecommendationRecord
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }

        // Category: "Supervisor", "Teammate", "Researcher", "Publication", "Project", "Topic"
        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty;

        // Target Entity ID (e.g. Recommended UserId, PublicationId, OpenProjectId)
        public int TargetEntityId { get; set; }

        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Subtitle { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        // Relevance score normalized from 0 to 100
        public int MatchScore { get; set; }

        // Comma-separated tags or matched keyword tokens
        [MaxLength(500)]
        public string? MatchedTags { get; set; }

        // Human-readable reason for recommendation, e.g., "Matched 3 shared research interests: AI, NLP, Healthcare"
        [MaxLength(500)]
        public string? RecommendationReason { get; set; }

        // User interaction status: "Active", "Dismissed", "Saved", "Accepted"
        [MaxLength(50)]
        public string Status { get; set; } = "Active";

        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // Represents skill gap analysis for a researcher aspiring toward specific projects or domains
    public class SkillGapAnalysisResult
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }

        // Target domain or project title evaluated against
        [Required]
        [MaxLength(200)]
        public string TargetDomain { get; set; } = string.Empty;

        public int? TargetProjectId { get; set; }

        // Comma-separated list of skills the user already possesses
        [MaxLength(1000)]
        public string CurrentSkills { get; set; } = string.Empty;

        // Comma-separated list of identified missing or recommended skills
        [MaxLength(1000)]
        public string MissingSkills { get; set; } = string.Empty;

        // Percentage readiness score (0 to 100)
        public int ReadinessScore { get; set; }

        // Recommended action / learning resource or suggested teammates
        [MaxLength(1000)]
        public string? RecommendedAction { get; set; }

        public DateTime AnalyzedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
