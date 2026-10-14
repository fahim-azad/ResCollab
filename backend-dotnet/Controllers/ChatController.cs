using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ChatController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        // Helper: check if requesting user is a participant of a conversation
        private async Task<bool> IsParticipant(int conversationId, int userId)
        {
            return await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId);
        }

        // =============================================
        // CONVERSATION ENDPOINTS
        // =============================================

        // GET /api/chat/conversations
        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var userId = GetUserId();

            var conversations = await _context.ConversationParticipants
                .Where(cp => cp.UserId == userId)
                .Include(cp => cp.Conversation)
                    .ThenInclude(c => c.Participants)
                        .ThenInclude(p => p.User)
                .OrderByDescending(cp => cp.Conversation.UpdatedAt)
                .Select(cp => new {
                    cp.Conversation!.Id,
                    cp.Conversation!.Type,
                    cp.Conversation!.Name,
                    cp.Conversation!.WorkspaceId,
                    cp.Conversation!.Status,
                    cp.Conversation!.UpdatedAt,
                    cp.LastReadAt,
                    Participants = cp.Conversation!.Participants.Select(p => new {
                        p.UserId,
                        UserName = p.User != null ? p.User.FullName : null
                    })
                })
                .ToListAsync();

            return Ok(conversations);
        }

        // GET /api/chat/conversations/{id}
        [HttpGet("conversations/{id}")]
        public async Task<IActionResult> GetConversation(int id)
        {
            var userId = GetUserId();
            if (!await IsParticipant(id, userId)) return Forbid();

            var conv = await _context.Conversations
                .Include(c => c.Participants).ThenInclude(p => p.User)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (conv == null) return NotFound("Conversation not found.");

            return Ok(new {
                conv.Id,
                conv.Type,
                conv.Name,
                conv.WorkspaceId,
                conv.Status,
                conv.CreatedAt,
                Participants = conv.Participants.Select(p => new {
                    p.UserId,
                    UserName = p.User?.FullName,
                    p.LastReadAt,
                    p.JoinedAt
                })
            });
        }

        // POST /api/chat/conversations/direct  - Start or retrieve a 1-to-1 conversation
        [HttpPost("conversations/direct")]
        public async Task<IActionResult> StartDirectConversation([FromBody] int targetUserId)
        {
            var userId = GetUserId();
            if (userId == targetUserId) return BadRequest("Cannot start a conversation with yourself.");

            var targetExists = await _context.Users.AnyAsync(u => u.Id == targetUserId);
            if (!targetExists) return NotFound("Target user not found.");

            // Check if a Direct conversation already exists between these two users
            var existing = await _context.Conversations
                .Where(c => c.Type == "Direct")
                .Where(c => c.Participants.Any(p => p.UserId == userId))
                .Where(c => c.Participants.Any(p => p.UserId == targetUserId))
                .FirstOrDefaultAsync();

            if (existing != null) return Ok(new { existing.Id, existing.Type, existing.Name, existing.Status, message = "Existing conversation returned." });

            // Create new direct conversation
            var conv = new Conversation { Type = "Direct", Status = "Active" };
            _context.Conversations.Add(conv);
            await _context.SaveChangesAsync();

            _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = conv.Id, UserId = userId });
            _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = conv.Id, UserId = targetUserId });
            await _context.SaveChangesAsync();

            return StatusCode(201, new { conv.Id, conv.Type, conv.Status });
        }

        public class CreateTeamConversationRequest
        {
            public string Name { get; set; } = string.Empty;
            public System.Collections.Generic.List<int> ParticipantIds { get; set; } = new();
            public int? WorkspaceId { get; set; }
        }

        // POST /api/chat/conversations/team  - Create a team/group conversation
        [HttpPost("conversations/team")]
        public async Task<IActionResult> CreateTeamConversation([FromBody] CreateTeamConversationRequest req)
        {
            var userId = GetUserId();
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest("Team conversation name is required.");

            var conv = new Conversation
            {
                Type = "Team",
                Name = req.Name,
                WorkspaceId = req.WorkspaceId,
                Status = "Active"
            };
            _context.Conversations.Add(conv);
            await _context.SaveChangesAsync();

            // Add creator as participant
            var participantIds = req.ParticipantIds.Distinct().ToList();
            if (!participantIds.Contains(userId)) participantIds.Add(userId);

            foreach (var pid in participantIds)
            {
                var userExists = await _context.Users.AnyAsync(u => u.Id == pid);
                if (userExists)
                    _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = conv.Id, UserId = pid });
            }
            await _context.SaveChangesAsync();

            return StatusCode(201, new { conv.Id, conv.Type, conv.Name, conv.WorkspaceId, conv.Status });
        }

        // PATCH /api/chat/conversations/{id}/archive
        [HttpPatch("conversations/{id}/archive")]
        public async Task<IActionResult> ArchiveConversation(int id)
        {
            var userId = GetUserId();
            if (!await IsParticipant(id, userId)) return Forbid();

            var conv = await _context.Conversations.FindAsync(id);
            if (conv == null) return NotFound("Conversation not found.");

            conv.Status = "Archived";
            conv.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Conversation archived." });
        }

        // POST /api/chat/conversations/{id}/read  - Mark conversation as read
        [HttpPost("conversations/{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = GetUserId();
            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == userId);

            if (participant == null) return Forbid();

            participant.LastReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Conversation marked as read." });
        }

        // =============================================
        // MESSAGE ENDPOINTS
        // =============================================

        // GET /api/chat/conversations/{id}/messages?page=1&pageSize=30
        [HttpGet("conversations/{id}/messages")]
        public async Task<IActionResult> GetMessages(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 30)
        {
            var userId = GetUserId();
            if (!await IsParticipant(id, userId)) return Forbid();

            var messages = await _context.ChatMessages
                .Include(m => m.Sender)
                .Where(m => m.ConversationId == id && !m.IsDeleted)
                .OrderByDescending(m => m.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(m => new {
                    m.Id,
                    m.ConversationId,
                    m.SenderId,
                    SenderName = m.Sender != null ? m.Sender.FullName : null,
                    m.Content,
                    m.MessageType,
                    m.CreatedAt,
                    m.EditedAt,
                    m.IsDeleted
                })
                .ToListAsync();

            return Ok(messages.OrderBy(m => m.CreatedAt));
        }

        public class SendMessageRequest
        {
            public string Content { get; set; } = string.Empty;
            public string MessageType { get; set; } = "Text";
        }

        // POST /api/chat/conversations/{id}/messages
        [HttpPost("conversations/{id}/messages")]
        public async Task<IActionResult> SendMessage(int id, [FromBody] SendMessageRequest req)
        {
            var userId = GetUserId();
            if (!await IsParticipant(id, userId)) return Forbid();

            if (string.IsNullOrWhiteSpace(req.Content))
                return BadRequest("Message content cannot be empty.");

            var message = new ChatMessage
            {
                ConversationId = id,
                SenderId = userId,
                Content = req.Content,
                MessageType = req.MessageType,
                IsDeleted = false
            };

            _context.ChatMessages.Add(message);

            // Bump conversation UpdatedAt for sorting
            var conv = await _context.Conversations.FindAsync(id);
            if (conv != null) conv.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return StatusCode(201, new {
                message.Id,
                message.ConversationId,
                message.SenderId,
                message.Content,
                message.MessageType,
                message.CreatedAt
            });
        }

        // PUT /api/chat/conversations/{conversationId}/messages/{messageId}
        [HttpPut("conversations/{conversationId}/messages/{messageId}")]
        public async Task<IActionResult> EditMessage(int conversationId, int messageId, [FromBody] string newContent)
        {
            var userId = GetUserId();
            var message = await _context.ChatMessages
                .FirstOrDefaultAsync(m => m.Id == messageId && m.ConversationId == conversationId);

            if (message == null) return NotFound("Message not found.");
            if (message.SenderId != userId) return Forbid();
            if (message.IsDeleted) return BadRequest("Cannot edit a deleted message.");
            if (string.IsNullOrWhiteSpace(newContent)) return BadRequest("Content cannot be empty.");

            message.Content = newContent;
            message.EditedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(message);
        }

        // DELETE /api/chat/conversations/{conversationId}/messages/{messageId}
        [HttpDelete("conversations/{conversationId}/messages/{messageId}")]
        public async Task<IActionResult> DeleteMessage(int conversationId, int messageId)
        {
            var userId = GetUserId();
            var message = await _context.ChatMessages
                .FirstOrDefaultAsync(m => m.Id == messageId && m.ConversationId == conversationId);

            if (message == null) return NotFound("Message not found.");
            if (message.SenderId != userId) return Forbid();

            // Soft delete
            message.IsDeleted = true;
            message.Content = "[Message deleted]";
            message.EditedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Message deleted." });
        }

        // =============================================
        // PARTICIPANT MANAGEMENT (Team chats only)
        // =============================================

        // POST /api/chat/conversations/{id}/participants
        [HttpPost("conversations/{id}/participants")]
        public async Task<IActionResult> AddParticipant(int id, [FromBody] int newUserId)
        {
            var userId = GetUserId();
            var conv = await _context.Conversations.FindAsync(id);
            if (conv == null) return NotFound("Conversation not found.");
            if (conv.Type != "Team") return BadRequest("Can only add participants to Team conversations.");
            if (!await IsParticipant(id, userId)) return Forbid();

            var userExists = await _context.Users.AnyAsync(u => u.Id == newUserId);
            if (!userExists) return NotFound("User not found.");

            var already = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == id && cp.UserId == newUserId);
            if (already) return BadRequest("User is already in this conversation.");

            _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = id, UserId = newUserId });
            await _context.SaveChangesAsync();
            return StatusCode(201, new { message = "Participant added." });
        }

        // DELETE /api/chat/conversations/{id}/participants/{participantUserId}
        [HttpDelete("conversations/{id}/participants/{participantUserId}")]
        public async Task<IActionResult> RemoveParticipant(int id, int participantUserId)
        {
            var userId = GetUserId();
            // Allow self-removal or removal if you are in the conversation
            if (userId != participantUserId && !await IsParticipant(id, userId)) return Forbid();

            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == participantUserId);
            if (participant == null) return NotFound("Participant not found.");

            _context.ConversationParticipants.Remove(participant);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Participant removed." });
        }
    }
}
