using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class ProjectApplication
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [ForeignKey("Project")]
        public int ProjectId { get; set; }
        public OpenProject? Project { get; set; }

        [Required]
        [ForeignKey("Applicant")]
        public int ApplicantId { get; set; }
        public User? Applicant { get; set; }

        [Required]
        [MaxLength(1000)]
        public string CoverLetter { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Accepted, Rejected

        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    }
}
