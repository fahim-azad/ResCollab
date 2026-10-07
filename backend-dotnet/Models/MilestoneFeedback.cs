using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class MilestoneFeedback
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [ForeignKey("Milestone")]
        public int WorkspaceTaskId { get; set; }
        public WorkspaceTask? Milestone { get; set; }

        [Required]
        [ForeignKey("GivenBy")]
        public int GivenById { get; set; }
        public User? GivenBy { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? StatusChange { get; set; } // Null if no status change, otherwise stores the new status e.g., "InProgress", "Done"

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
