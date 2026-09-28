using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class WorkspaceMember
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int WorkspaceId { get; set; }
        
        [ForeignKey("WorkspaceId")]
        public Workspace? Workspace { get; set; }

        [Required]
        public int UserId { get; set; }
        
        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = "Member"; // Admin, Member

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
