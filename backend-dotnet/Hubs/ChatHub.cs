using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Api.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;

        public ChatHub(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetUserId()
        {
            var userIdStr = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            if (userId > 0)
            {
                // Register user into their private user group
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            if (userId > 0)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
            }
            await base.OnDisconnectedAsync(exception);
        }

        // Join a specific conversation channel to receive real-time messages & typing alerts
        public async Task JoinConversation(int conversationId)
        {
            var userId = GetUserId();
            if (userId <= 0) return;

            var isParticipant = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId);

            if (isParticipant)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
            }
        }

        // Leave a specific conversation channel
        public async Task LeaveConversation(int conversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
        }

        // Send message directly over SignalR
        public async Task SendMessage(int conversationId, string content, string messageType = "Text")
        {
            var userId = GetUserId();
            if (userId <= 0 || string.IsNullOrWhiteSpace(content)) return;

            var isParticipant = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId);

            if (!isParticipant) return;

            var message = new ChatMessage
            {
                ConversationId = conversationId,
                SenderId = userId,
                Content = content,
                MessageType = messageType,
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.ChatMessages.Add(message);

            var conv = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == conversationId);

            if (conv != null)
            {
                conv.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            var sender = await _context.Users.FindAsync(userId);
            var senderName = sender?.FullName ?? "User";

            var messageDto = new
            {
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

            // Ensure sender is in the conversation group
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");

            // Broadcast to all participants currently joined to the conversation
            await Clients.Group($"conversation_{conversationId}").SendAsync("ReceiveMessage", messageDto);
            await Clients.Caller.SendAsync("ReceiveMessage", messageDto);

            // Notify participants' private groups to update conversation list snippets and unread indicators
            if (conv != null)
            {
                foreach (var p in conv.Participants)
                {
                    await Clients.Group($"user_{p.UserId}").SendAsync("ConversationUpdated", new
                    {
                        ConversationId = conversationId,
                        LastMessage = messageDto
                    });
                }
            }
        }

        // Send typing indicator to others in the conversation
        public async Task SendTyping(int conversationId, bool isTyping)
        {
            var userId = GetUserId();
            if (userId <= 0) return;

            var user = await _context.Users.FindAsync(userId);
            var userName = user?.FullName ?? "Someone";

            await Clients.OthersInGroup($"conversation_{conversationId}").SendAsync("UserTyping", new
            {
                ConversationId = conversationId,
                UserId = userId,
                UserName = userName,
                IsTyping = isTyping
            });
        }
    }
}
