using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ResCollab.Api.Models
{
    public class ResearchIdea
    {
        [Key]
        public int Id { get; set; }

        [ForeignKey("Creator")]
        public int CreatorId { get; set; }

        public User? Creator { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [MaxLength(150)]
        public string? ResearchArea { get; set; }

        public string? RequiredSkills { get; set; }

        [MaxLength(200)]
        public string? ExpectedOutcome { get; set; }

        public int RequiredTeamSize { get; set; } = 1;

        [MaxLength(50)]
        public string Status { get; set; } = "Open"; // Open, Recruiting, Closed

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [JsonIgnore]
        public ICollection<IdeaApplication> Applications { get; set; } = new List<IdeaApplication>();
    }
}
