using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class Bookmark
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [ForeignKey("User")]
        public int UserId { get; set; }
        public User? User { get; set; }

        [Required]
        [MaxLength(100)]
        public string ItemType { get; set; } = string.Empty; // e.g., "ResearchResource", "ResearchIdea", "OpenProject", "UserProfile"

        [Required]
        public int ItemId { get; set; } // ID of the referenced item

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
