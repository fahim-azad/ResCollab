using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents a research laboratory at an institution
    public class Laboratory
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(300)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        public string? ResearchFocus { get; set; }

        [MaxLength(200)]
        public string? Institution { get; set; }

        [MaxLength(200)]
        public string? Department { get; set; }

        // Principal Investigator / Lab Head
        public int? HeadUserId { get; set; }

        [MaxLength(500)]
        public string? Website { get; set; }

        [MaxLength(500)]
        public string? Location { get; set; }

        // Visibility: "Public", "Institution", "Private"
        [MaxLength(50)]
        public string Visibility { get; set; } = "Public";

        // "Active", "Inactive"
        [MaxLength(50)]
        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("HeadUserId")]
        public User? Head { get; set; }

        public ICollection<LaboratoryMember> Members { get; set; } = new List<LaboratoryMember>();
    }

    // Represents a researcher's membership in a laboratory
    public class LaboratoryMember
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int LaboratoryId { get; set; }

        [Required]
        public int UserId { get; set; }

        // "Principal Investigator", "Researcher", "PostDoc", "Student", "Collaborator"
        [MaxLength(100)]
        public string Role { get; set; } = "Researcher";

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("LaboratoryId")]
        public Laboratory? Laboratory { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // Controls whether a project/idea is listed in the public research directory
    public class ProjectDirectoryListing
    {
        [Key]
        public int Id { get; set; }

        // "OpenProject" or "ResearchIdea"
        [Required]
        [MaxLength(50)]
        public string ItemType { get; set; } = string.Empty;

        [Required]
        public int ItemId { get; set; }

        // Visibility: "Public", "Institution", "Connections", "Private"
        [MaxLength(50)]
        public string Visibility { get; set; } = "Public";

        // Optional: link to a laboratory
        public int? LaboratoryId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("LaboratoryId")]
        public Laboratory? Laboratory { get; set; }
    }
}
