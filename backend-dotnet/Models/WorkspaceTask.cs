using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class WorkspaceTask
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [ForeignKey("Workspace")]
        public int WorkspaceId { get; set; }
        public Workspace? Workspace { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Todo"; // Todo, InProgress, Done

        [ForeignKey("Assignee")]
        public int? AssignedToId { get; set; }
        public User? Assignee { get; set; }

        public DateTime? DueDate { get; set; }

        public bool IsMilestone { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
