using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ResCollab.Api.Models
{
    public class ResearchResource
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = string.Empty; // "Paper", "Dataset", "Code"

        public string? Description { get; set; }

        public string? Url { get; set; }

        public DateTime PublishedDate { get; set; } = DateTime.UtcNow;

        public ICollection<ResourceTag> Tags { get; set; } = new List<ResourceTag>();
    }

    public class ResourceTag
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        public int ResearchResourceId { get; set; }
        public ResearchResource? ResearchResource { get; set; }
    }
}