using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

using Microsoft.AspNetCore.SignalR;
using ResCollab.Api.Hubs;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatController(ApplicationDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
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

            var participantRows = await _context.ConversationParticipants
                .Where(cp => cp.UserId == userId)
                .Include(cp => cp.Conversation)
                    .ThenInclude(c => c!.Participants)
                        .ThenInclude(p => p.User)
                .OrderByDescending(cp => cp.Conversation!.UpdatedAt)
                .ToListAsync();

            var convIds = participantRows.Select(cp => cp.ConversationId).ToList();

            var lastMessages = await _context.ChatMessages
                .Include(m => m.Sender)
                .Where(m => convIds.Contains(m.ConversationId) && !m.IsDeleted)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync();

            var lastMessageMap = lastMessages
                .GroupBy(m => m.ConversationId)
                .ToDictionary(g => g.Key, g => g.First());

            var conversations = participantRows.Select(cp => {
                var c = cp.Conversation!;
                lastMessageMap.TryGetValue(c.Id, out var lastMsg);

                var unreadCount = _context.ChatMessages
                    .Count(m => m.ConversationId == c.Id && !m.IsDeleted && m.SenderId != userId && (cp.LastReadAt == null || m.CreatedAt > cp.LastReadAt));

                return new {
                    c.Id,
                    c.Type,
                    c.Name,
                    c.WorkspaceId,
                    c.Status,
                    c.UpdatedAt,
                    cp.LastReadAt,
                    UnreadCount = unreadCount,
                    LastMessage = lastMsg != null ? new {
                        lastMsg.Id,
                        lastMsg.Content,
                        lastMsg.MessageType,
                        lastMsg.CreatedAt,
                        lastMsg.SenderId,
                        SenderName = lastMsg.Sender?.FullName
                    } : null,
                    Participants = c.Participants.Select(p => new {
                        p.UserId,
                        UserName = p.User != null ? p.User.FullName : null,
                        p.LastReadAt,
                        p.JoinedAt
                    })
                };
            }).ToList();

            return Ok(conversations);
        }

        // GET /api/chat/contacts - Return researchers & colleagues for starting new chats
        [HttpGet("contacts")]
        public async Task<IActionResult> GetContacts([FromQuery] string? search)
        {
            var userId = GetUserId();
            var query = _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != userId)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var lower = search.ToLower();
                query = query.Where(u => u.FullName.ToLower().Contains(lower) || 
                                         u.Email.ToLower().Contains(lower) ||
                                         (u.Profile != null && u.Profile.Department != null && u.Profile.Department.ToLower().Contains(lower)) ||
                                         (u.Profile != null && u.Profile.University != null && u.Profile.University.ToLower().Contains(lower)));
            }

            var users = await query
                .OrderBy(u => u.FullName)
                .Take(50)
                .Select(u => new {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.Role,
                    Department = u.Profile != null ? u.Profile.Department : null,
                    University = u.Profile != null ? u.Profile.University : null
                })
                .ToListAsync();

            var directConvIds = await _context.ConversationParticipants
                .Where(cp => cp.UserId == userId && cp.Conversation!.Type == "Direct")
                .Select(cp => cp.ConversationId)
                .ToListAsync();

            var otherParticipants = await _context.ConversationParticipants
                .Where(cp => directConvIds.Contains(cp.ConversationId) && cp.UserId != userId)
                .Select(cp => new { cp.ConversationId, cp.UserId })
                .ToListAsync();

            var directMap = otherParticipants.ToDictionary(p => p.UserId, p => p.ConversationId);

            var result = users.Select(u => new {
                u.Id,
                u.FullName,
                u.Email,
                u.Role,
                u.Department,
                u.University,
                DirectConversationId = directMap.TryGetValue(u.Id, out int convId) ? (int?)convId : null
            });

            return Ok(result);
        }

        // GET /api/chat/workspaces - Return workspaces the current user belongs to
        [HttpGet("workspaces")]
        public async Task<IActionResult> GetUserWorkspaces()
        {
            var userId = GetUserId();
            var workspaces = await _context.WorkspaceMembers
                .Where(wm => wm.UserId == userId)
                .Include(wm => wm.Workspace)
                .Select(wm => new {
                    wm.Workspace!.Id,
                    wm.Workspace!.Name,
                    wm.Workspace!.Description
                })
                .ToListAsync();

            return Ok(workspaces);
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
        public async Task<IActionResult> StartDirectConversation([FromBody] System.Text.Json.JsonElement body)
        {
            var userId = GetUserId();
            int targetUserId = 0;
            if (body.ValueKind == System.Text.Json.JsonValueKind.Number)
            {
                targetUserId = body.GetInt32();
            }
            else if (body.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                if (body.TryGetProperty("targetUserId", out var prop) || body.TryGetProperty("TargetUserId", out prop) || body.TryGetProperty("userId", out prop))
                {
                    targetUserId = prop.GetInt32();
                }
            }

            if (targetUserId <= 0) return BadRequest("Valid targetUserId is required.");
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

        // PATCH /api/chat/conversations/{id}/unarchive
        [HttpPatch("conversations/{id}/unarchive")]
        public async Task<IActionResult> UnarchiveConversation(int id)
        {
            var userId = GetUserId();
            if (!await IsParticipant(id, userId)) return Forbid();

            var conv = await _context.Conversations.FindAsync(id);
            if (conv == null) return NotFound("Conversation not found.");

            conv.Status = "Active";
            conv.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Conversation unarchived." });
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

        // GET /api/chat/unread-count  - Total unread messages across all conversations
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetTotalUnreadCount()
        {
            var userId = GetUserId();

            var participants = await _context.ConversationParticipants
                .Where(cp => cp.UserId == userId)
                .ToListAsync();

            int total = 0;
            foreach (var p in participants)
            {
                var count = await _context.ChatMessages
                    .CountAsync(m =>
                        m.ConversationId == p.ConversationId &&
                        !m.IsDeleted &&
                        m.SenderId != userId &&
                        (p.LastReadAt == null || m.CreatedAt > p.LastReadAt));
                total += count;
            }

            return Ok(new { unreadCount = total });
        }

        // GET /api/chat/conversations/{id}/unread-count  - Unread count for one conversation
        [HttpGet("conversations/{id}/unread-count")]
        public async Task<IActionResult> GetConversationUnreadCount(int id)
        {
            var userId = GetUserId();
            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == userId);

            if (participant == null) return Forbid();

            var count = await _context.ChatMessages
                .CountAsync(m =>
                    m.ConversationId == id &&
                    !m.IsDeleted &&
                    m.SenderId != userId &&
                    (participant.LastReadAt == null || m.CreatedAt > participant.LastReadAt));

            return Ok(new { conversationId = id, unreadCount = count });
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

            var sender = await _context.Users.FindAsync(userId);
            var senderName = sender?.FullName ?? "User";

            var messageDto = new {
                message.Id,
                message.ConversationId,
                message.SenderId,
                SenderName = senderName,
                message.Content,
                message.MessageType,
                message.CreatedAt,
                message.EditedAt,
                message.IsDeleted
            };

            // Broadcast real-time message to conversation group
            await _hubContext.Clients.Group($"conversation_{id}").SendAsync("ReceiveMessage", messageDto);

            // Notify participants' personal notification groups
            var convWithParticipants = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (convWithParticipants != null)
            {
                foreach (var p in convWithParticipants.Participants)
                {
                    await _hubContext.Clients.Group($"user_{p.UserId}").SendAsync("ConversationUpdated", new {
                        ConversationId = id,
                        LastMessage = messageDto
                    });
                }
            }

            return StatusCode(201, messageDto);
        }

        // PUT /api/chat/conversations/{conversationId}/messages/{messageId}
        [HttpPut("conversations/{conversationId}/messages/{messageId}")]
        public async Task<IActionResult> EditMessage(int conversationId, int messageId, [FromBody] System.Text.Json.JsonElement body)
        {
            var userId = GetUserId();
            var message = await _context.ChatMessages
                .FirstOrDefaultAsync(m => m.Id == messageId && m.ConversationId == conversationId);

            if (message == null) return NotFound("Message not found.");
            if (message.SenderId != userId) return Forbid();
            if (message.IsDeleted) return BadRequest("Cannot edit a deleted message.");

            string newContent = "";
            if (body.ValueKind == System.Text.Json.JsonValueKind.String)
            {
                newContent = body.GetString() ?? "";
            }
            else if (body.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                if (body.TryGetProperty("newContent", out var nc)) newContent = nc.GetString() ?? "";
                else if (body.TryGetProperty("content", out var c)) newContent = c.GetString() ?? "";
                else if (body.TryGetProperty("Content", out var C)) newContent = C.GetString() ?? "";
            }

            if (string.IsNullOrWhiteSpace(newContent)) return BadRequest("Content cannot be empty.");

            message.Content = newContent;
            message.EditedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Broadcast real-time message edit to conversation group
            await _hubContext.Clients.Group($"conversation_{conversationId}").SendAsync("MessageEdited", new {
                message.Id,
                message.ConversationId,
                message.Content,
                message.EditedAt
            });

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

            // Broadcast real-time message deletion to conversation group
            await _hubContext.Clients.Group($"conversation_{conversationId}").SendAsync("MessageDeleted", new {
                MessageId = messageId,
                ConversationId = conversationId
            });

            return Ok(new { message = "Message deleted." });
        }

        // =============================================
        // PARTICIPANT MANAGEMENT (Team chats only)
        // =============================================

        // POST /api/chat/conversations/{id}/participants
        [HttpPost("conversations/{id}/participants")]
        public async Task<IActionResult> AddParticipant(int id, [FromBody] System.Text.Json.JsonElement body)
        {
            var userId = GetUserId();
            var conv = await _context.Conversations.FindAsync(id);
            if (conv == null) return NotFound("Conversation not found.");
            if (conv.Type != "Team") return BadRequest("Can only add participants to Team conversations.");
            if (!await IsParticipant(id, userId)) return Forbid();

            int newUserId = 0;
            if (body.ValueKind == System.Text.Json.JsonValueKind.Number)
            {
                newUserId = body.GetInt32();
            }
            else if (body.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                if (body.TryGetProperty("newUserId", out var prop) || body.TryGetProperty("userId", out prop) || body.TryGetProperty("UserId", out prop))
                {
                    newUserId = prop.GetInt32();
                }
            }

            if (newUserId <= 0) return BadRequest("Valid user id is required.");

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

        // =============================================
        // SEARCH
        // =============================================

        // GET /api/chat/search?q=hello  - Search messages across all user's conversations
        [HttpGet("search")]
        public async Task<IActionResult> SearchMessages([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
                return BadRequest("Search query must be at least 2 characters.");

            var userId = GetUserId();

            // Get conversation IDs the user belongs to
            var conversationIds = await _context.ConversationParticipants
                .Where(cp => cp.UserId == userId)
                .Select(cp => cp.ConversationId)
                .ToListAsync();

            var results = await _context.ChatMessages
                .Include(m => m.Sender)
                .Where(m =>
                    conversationIds.Contains(m.ConversationId) &&
                    !m.IsDeleted &&
                    m.Content.Contains(q))
                .OrderByDescending(m => m.CreatedAt)
                .Take(50)
                .Select(m => new {
                    m.Id,
                    m.ConversationId,
                    m.SenderId,
                    SenderName = m.Sender != null ? m.Sender.FullName : null,
                    m.Content,
                    m.MessageType,
                    m.CreatedAt
                })
                .ToListAsync();

            return Ok(results);
        }
    }
}
