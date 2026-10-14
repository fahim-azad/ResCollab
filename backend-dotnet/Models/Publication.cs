using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents a researcher's publication record
    public class Publication
    {
        [Key]
        public int Id { get; set; }

        // The researcher who owns this publication record
        [Required]
        public int OwnerId { get; set; }

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        // Comma-separated list of authors
        [Required]
        [MaxLength(1000)]
        public string Authors { get; set; } = string.Empty;

        // Digital Object Identifier (optional but recommended)
        [MaxLength(200)]
        public string? DOI { get; set; }

        // Journal name or Conference proceedings name
        [MaxLength(500)]
        public string? JournalOrConference { get; set; }

        [Required]
        public int PublicationYear { get; set; }

        // Abstract or summary
        [MaxLength(5000)]
        public string? Abstract { get; set; }

        // URL to the full paper or source
        [MaxLength(1000)]
        public string? SourceLink { get; set; }

        // "Journal", "Conference", "Book", "Thesis", "Preprint", "Other"
        [MaxLength(100)]
        public string PublicationType { get; set; } = "Journal";

        // Visibility: "Public", "Private"
        [MaxLength(50)]
        public string Visibility { get; set; } = "Public";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("OwnerId")]
        public User? Owner { get; set; }
    }
}
