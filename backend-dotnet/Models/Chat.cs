using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResCollab.Api.Models
{
    // Represents a chat conversation - either Direct (1-to-1) or Team (group)
    public class Conversation
    {
        [Key]
        public int Id { get; set; }

        // "Direct" for one-to-one, "Team" for group/workspace chat
        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = "Direct";

        // Display name (used for Team chats)
        [MaxLength(200)]
        public string? Name { get; set; }

        // Optional: link to a workspace for team chats
        public int? WorkspaceId { get; set; }

        // "Active", "Archived"
        [MaxLength(50)]
        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("WorkspaceId")]
        public Workspace? Workspace { get; set; }

        public ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
        public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
    }

    // Tracks which users are in which conversations + their read state
    public class ConversationParticipant
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ConversationId { get; set; }

        [Required]
        public int UserId { get; set; }

        // Used to calculate unread message count
        public DateTime? LastReadAt { get; set; }

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ConversationId")]
        public Conversation? Conversation { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // Represents a single chat message within a conversation
    public class ChatMessage
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ConversationId { get; set; }

        [Required]
        public int SenderId { get; set; }

        [Required]
        [MaxLength(4000)]
        public string Content { get; set; } = string.Empty;

        // "Text", "File", "System"
        [MaxLength(50)]
        public string MessageType { get; set; } = "Text";

        // Soft delete support
        public bool IsDeleted { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? EditedAt { get; set; }

        // Navigation
        [ForeignKey("ConversationId")]
        public Conversation? Conversation { get; set; }

        [ForeignKey("SenderId")]
        public User? Sender { get; set; }
    }
}
