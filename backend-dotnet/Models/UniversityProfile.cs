using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents a university institution on the platform
    public class University
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(300)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Country { get; set; }

        [MaxLength(200)]
        public string? City { get; set; }

        [MaxLength(500)]
        public string? Website { get; set; }

        [MaxLength(2000)]
        public string? Description { get; set; }

        [MaxLength(500)]
        public string? LogoUrl { get; set; }

        // "Active", "Inactive"
        [MaxLength(50)]
        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<Department> Departments { get; set; } = new List<Department>();
    }

    // Represents a department within a university
    public class Department
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UniversityId { get; set; }

        [Required]
        [MaxLength(300)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [MaxLength(200)]
        public string? HeadOfDepartment { get; set; }

        [MaxLength(500)]
        public string? Website { get; set; }

        // Visibility: "Public", "Private"
        [MaxLength(50)]
        public string Visibility { get; set; } = "Public";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UniversityId")]
        public University? University { get; set; }
    }
}
