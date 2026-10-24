using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents a research community discussion post or announcement
    public class CommunityPost
    {
        [Key]
        public int Id { get; set; }

        public int AuthorId { get; set; }

        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(5000)]
        public string Content { get; set; } = string.Empty;

        // "General", "ResearchInquiry", "PaperDiscussion", "ConferenceUpdate", "CollaborationCall"
        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = "General";

        [MaxLength(500)]
        public string? Tags { get; set; }

        [MaxLength(1000)]
        public string? AttachmentUrl { get; set; }

        [MaxLength(50)]
        public string? AttachmentType { get; set; } // "Link", "PDF", "Image"

        public int ReactionsCount { get; set; } = 0;

        public int CommentsCount { get; set; } = 0;

        public int SharesCount { get; set; } = 0;

        public bool IsPinned { get; set; } = false;

        // "Public", "Institution", "ConnectionsOnly"
        [MaxLength(50)]
        public string Visibility { get; set; } = "Public";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("AuthorId")]
        public User? Author { get; set; }

        public ICollection<CommunityComment> Comments { get; set; } = new List<CommunityComment>();
        public ICollection<PostReaction> Reactions { get; set; } = new List<PostReaction>();
        public ICollection<PostShare> Shares { get; set; } = new List<PostShare>();
    }

    // Represents a comment or threaded reply in a discussion
    public class CommunityComment
    {
        [Key]
        public int Id { get; set; }

        public int PostId { get; set; }

        public int AuthorId { get; set; }

        // Null for top-level comment; populated for 1-level nested replies
        public int? ParentCommentId { get; set; }

        [Required]
        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        public int LikesCount { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("PostId")]
        public CommunityPost? Post { get; set; }

        [ForeignKey("AuthorId")]
        public User? Author { get; set; }

        [ForeignKey("ParentCommentId")]
        public CommunityComment? ParentComment { get; set; }

        public ICollection<CommunityComment> Replies { get; set; } = new List<CommunityComment>();
    }

    // Captures academic reactions to community posts
    public class PostReaction
    {
        [Key]
        public int Id { get; set; }

        public int PostId { get; set; }

        public int UserId { get; set; }

        // "Like", "Insightful", "Curious", "Celebrate", "Support"
        [Required]
        [MaxLength(50)]
        public string ReactionType { get; set; } = "Like";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("PostId")]
        public CommunityPost? Post { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // Tracks shares of community posts
    public class PostShare
    {
        [Key]
        public int Id { get; set; }

        public int PostId { get; set; }

        public int UserId { get; set; }

        [MaxLength(500)]
        public string? ShareNote { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("PostId")]
        public CommunityPost? Post { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
