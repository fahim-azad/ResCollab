using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    public class WorkspaceFile
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [ForeignKey("Workspace")]
        public int WorkspaceId { get; set; }
        public Workspace? Workspace { get; set; }

        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public string FileUrl { get; set; } = string.Empty;

        public long FileSizeBytes { get; set; }

        [ForeignKey("UploadedBy")]
        public int? UploadedById { get; set; }
        public User? UploadedBy { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
