using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ResCollab.Api.Models
{
    public class Workspace
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        // Optional link to the original OpenProject from which this team was formed
        public int? OpenProjectId { get; set; }
        
        [ForeignKey("OpenProjectId")]
        public OpenProject? OpenProject { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [JsonIgnore]
        public ICollection<WorkspaceMember>? Members { get; set; }
    }
}
