using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class UserFollow
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [ForeignKey("Follower")]
        public int FollowerId { get; set; }
        public User? Follower { get; set; }

        [Required]
        [ForeignKey("Followed")]
        public int FollowedId { get; set; }
        public User? Followed { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
