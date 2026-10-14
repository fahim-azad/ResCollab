using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents a research grant, scholarship, or funding opportunity
    public class FundingOpportunity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        // Organization or body offering the funding
        [Required]
        [MaxLength(300)]
        public string Provider { get; set; } = string.Empty;

        [MaxLength(5000)]
        public string? Description { get; set; }

        // Who can apply (e.g., "PhD students", "Faculty at accredited institutions")
        [MaxLength(2000)]
        public string? Eligibility { get; set; }

        // What applicants need to submit
        [MaxLength(2000)]
        public string? Requirements { get; set; }

        // Funding amount or range (e.g., "Up to $50,000")
        [MaxLength(200)]
        public string? FundingAmount { get; set; }

        // "Grant", "Scholarship", "Fellowship", "Award", "Contract", "Other"
        [MaxLength(100)]
        public string FundingType { get; set; } = "Grant";

        [MaxLength(300)]
        public string? ResearchArea { get; set; }

        // Link to external application portal
        [MaxLength(1000)]
        public string? ApplicationUrl { get; set; }

        // Additional application instructions/info
        [MaxLength(3000)]
        public string? ApplicationInfo { get; set; }

        public DateTime? Deadline { get; set; }

        // "Open", "Closed", "Upcoming"
        [MaxLength(50)]
        public string Status { get; set; } = "Open";

        // Optional: user who posted/added this opportunity
        public int? PostedById { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("PostedById")]
        public User? PostedBy { get; set; }
    }
}
