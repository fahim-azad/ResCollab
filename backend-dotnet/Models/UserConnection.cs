using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class UserConnection
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [ForeignKey("Requester")]
        public int RequesterId { get; set; }
        public User? Requester { get; set; }

        [Required]
        [ForeignKey("Target")]
        public int TargetId { get; set; }
        public User? Target { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Accepted, Rejected

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? UpdatedAt { get; set; }
    }
}
