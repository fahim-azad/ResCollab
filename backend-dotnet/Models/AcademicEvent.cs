using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents an academic event, conference, seminar, workshop, competition, or call for papers
    public class AcademicEvent
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        public string Organizer { get; set; } = string.Empty;

        // "Conference", "Seminar", "Workshop", "CallForPapers", "Competition", "Symposium"
        [Required]
        [MaxLength(100)]
        public string EventType { get; set; } = "Conference";

        [Required]
        [MaxLength(4000)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string FieldOfStudy { get; set; } = "General";

        [MaxLength(300)]
        public string? Location { get; set; }

        public bool IsVirtual { get; set; } = false;

        public DateTime? StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        public DateTime? SubmissionDeadline { get; set; }

        public DateTime? RegistrationDeadline { get; set; }

        [MaxLength(1000)]
        public string? WebsiteUrl { get; set; }

        [MaxLength(1000)]
        public string? RegistrationUrl { get; set; }

        // "Manual Submission", "WikiCFP", "EasyChair", etc.
        [MaxLength(200)]
        public string Source { get; set; } = "Manual Submission";

        // "Upcoming", "Ongoing", "Completed", "Cancelled"
        [MaxLength(50)]
        public string Status { get; set; } = "Upcoming";

        public int? PostedById { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("PostedById")]
        public User? PostedBy { get; set; }

        public ICollection<EventBookmark> Bookmarks { get; set; } = new List<EventBookmark>();
    }

    // Allows users to bookmark events and track impending submission deadlines
    public class EventBookmark
    {
        [Key]
        public int Id { get; set; }

        public int EventId { get; set; }

        public int UserId { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("EventId")]
        public AcademicEvent? Event { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
