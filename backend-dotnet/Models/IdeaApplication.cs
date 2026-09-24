using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class IdeaApplication
    {
        [Key]
        public int Id { get; set; }

        [ForeignKey("Idea")]
        public int IdeaId { get; set; }
        public ResearchIdea? Idea { get; set; }

        [ForeignKey("Applicant")]
        public int ApplicantId { get; set; }
        public User? Applicant { get; set; }

        [MaxLength(1000)]
        public string? Message { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Accepted, Rejected

        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    }
}
