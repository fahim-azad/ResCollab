using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ResCollab.Api.Models
{
    public class UserProfile
    {
        [Key]
        public int Id { get; set; }

        [ForeignKey("User")]
        public int UserId { get; set; }
        
        [JsonIgnore]
        public User? User { get; set; }

        public string? Bio { get; set; }
        
        [MaxLength(150)]
        public string? University { get; set; }
        
        [MaxLength(150)]
        public string? Department { get; set; }
        
        [MaxLength(100)]
        public string? Country { get; set; }

        public string? Skills { get; set; }
        
        public string? Interests { get; set; }

        public bool IsAcceptingStudents { get; set; } = true;
    }
}