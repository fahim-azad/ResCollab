using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents a researcher's collaborator profile with cross-institution visibility
    public class CollaboratorProfile
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        // Institution / University Info
        [MaxLength(200)]
        public string? Institution { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        [MaxLength(100)]
        public string? Country { get; set; }

        // Research Info
        [MaxLength(500)]
        public string? ResearchInterests { get; set; }

        [MaxLength(500)]
        public string? ExpertiseAreas { get; set; }

        // Cross-institution availability
        public bool IsOpenToCollaboration { get; set; } = true;

        // Visibility: "Public", "Connections", "Institution"
        [MaxLength(50)]
        public string Visibility { get; set; } = "Public";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // Represents a cross-institution collaboration opportunity posted by a researcher
    public class CollaborationOpportunity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PostedById { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        public string? RequiredExpertise { get; set; }

        [MaxLength(200)]
        public string? ResearchArea { get; set; }

        // "Open", "Closed", "InProgress"
        [MaxLength(50)]
        public string Status { get; set; } = "Open";

        // Cross-institution flag
        public bool IsCrossInstitution { get; set; } = true;

        public DateTime? Deadline { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("PostedById")]
        public User? PostedBy { get; set; }
    }
}
