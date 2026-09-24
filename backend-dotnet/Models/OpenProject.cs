using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class OpenProject
    {
        [Key]
        public int Id { get; set; }

        [ForeignKey("Supervisor")]
        public int SupervisorId { get; set; }
        public User? Supervisor { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [MaxLength(150)]
        public string? Department { get; set; }

        public string? RequiredSkills { get; set; }

        public int MaxStudents { get; set; } = 1;

        public bool IsFunded { get; set; } = false;

        [MaxLength(50)]
        public string Status { get; set; } = "Recruiting"; // Recruiting, Closed

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
