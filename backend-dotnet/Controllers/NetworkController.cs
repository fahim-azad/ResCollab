using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Hubs;
using ResCollab.Api.Models;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NetworkController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public NetworkController(ApplicationDbContext context, IHubContext<ChatHub> hubContext)
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

        private async Task SendRealtimeNotification(Notification notification)
        {
            try
            {
                await _hubContext.Clients.Group($"user_{notification.UserId}").SendAsync("ReceiveNotification", new
                {
                    id = notification.Id,
                    userId = notification.UserId,
                    title = notification.Title,
                    message = notification.Message,
                    type = notification.Type,
                    relatedEntityId = notification.RelatedEntityId,
                    isRead = notification.IsRead,
                    createdAt = notification.CreatedAt
                });
            }
            catch
            {
                // SignalR failure should not block HTTP response
            }
        }

        // --- FOLLOW API ---

        [HttpPost("follow/{targetUserId}")]
        public async Task<IActionResult> Follow(int targetUserId)
        {
            var userId = GetUserId();
            if (userId == targetUserId) return BadRequest("Cannot follow yourself.");

            var targetUser = await _context.Users.FindAsync(targetUserId);
            if (targetUser == null) return NotFound("Target user not found.");

            var exists = await _context.UserFollows.AnyAsync(f => f.FollowerId == userId && f.FollowedId == targetUserId);
            if (exists) return BadRequest("Already following this user.");

            var follow = new UserFollow { FollowerId = userId, FollowedId = targetUserId };
            _context.UserFollows.Add(follow);

            // Generate notification for followed user
            var sender = await _context.Users.FindAsync(userId);
            var senderName = sender?.FullName ?? "A researcher";

            var notification = new Notification
            {
                UserId = targetUserId,
                Title = "New Follower",
                Message = $"{senderName} started following your research profile.",
                Type = "Follow",
                RelatedEntityId = userId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
            _context.Notifications.Add(notification);

            await _context.SaveChangesAsync();

            await SendRealtimeNotification(notification);

            return Ok(new { message = "Followed successfully" });
        }

        [HttpDelete("follow/{targetUserId}")]
        public async Task<IActionResult> Unfollow(int targetUserId)
        {
            var userId = GetUserId();
            var follow = await _context.UserFollows.FirstOrDefaultAsync(f => f.FollowerId == userId && f.FollowedId == targetUserId);
            if (follow == null) return NotFound("Not following this user.");

            _context.UserFollows.Remove(follow);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Unfollowed successfully" });
        }

        [HttpGet("following")]
        public async Task<IActionResult> GetFollowing()
        {
            var userId = GetUserId();
            var following = await _context.UserFollows
                .Where(f => f.FollowerId == userId)
                .Select(f => new { f.FollowedId, FollowedName = f.Followed!.FullName, f.CreatedAt })
                .ToListAsync();
            return Ok(following);
        }

        [HttpGet("followers")]
        public async Task<IActionResult> GetFollowers()
        {
            var userId = GetUserId();
            var followers = await _context.UserFollows
                .Where(f => f.FollowedId == userId)
                .Select(f => new { f.FollowerId, FollowerName = f.Follower!.FullName, f.CreatedAt })
                .ToListAsync();
            return Ok(followers);
        }

        // --- CONNECTION API ---

        [HttpPost("connect/{targetUserId}")]
        public async Task<IActionResult> SendConnectionRequest(int targetUserId)
        {
            var userId = GetUserId();
            if (userId == targetUserId) return BadRequest("Cannot connect with yourself.");

            var targetUser = await _context.Users.FindAsync(targetUserId);
            if (targetUser == null) return NotFound("Target user not found.");

            var existing = await _context.UserConnections
                .FirstOrDefaultAsync(c => 
                    (c.RequesterId == userId && c.TargetId == targetUserId) || 
                    (c.RequesterId == targetUserId && c.TargetId == userId));

            if (existing != null) return BadRequest($"Connection already exists with status: {existing.Status}");

            var connection = new UserConnection { RequesterId = userId, TargetId = targetUserId, Status = "Pending" };
            _context.UserConnections.Add(connection);

            // Generate notification for target user
            var sender = await _context.Users.FindAsync(userId);
            var senderName = sender?.FullName ?? "A researcher";

            var notification = new Notification
            {
                UserId = targetUserId,
                Title = "New Connection Request",
                Message = $"{senderName} sent you a connection request.",
                Type = "Connection",
                RelatedEntityId = userId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
            _context.Notifications.Add(notification);

            await _context.SaveChangesAsync();

            await SendRealtimeNotification(notification);

            return Ok(new { message = "Connection request sent" });
        }

        [HttpPut("connect/{requesterId}/accept")]
        public async Task<IActionResult> AcceptConnection(int requesterId)
        {
            var userId = GetUserId();
            var connection = await _context.UserConnections
                .FirstOrDefaultAsync(c => c.RequesterId == requesterId && c.TargetId == userId && c.Status == "Pending");

            if (connection == null) return NotFound("Pending connection request not found.");

            connection.Status = "Accepted";
            connection.UpdatedAt = System.DateTime.UtcNow;

            // Generate notification for requester that request was accepted
            var currentUser = await _context.Users.FindAsync(userId);
            var currentUserName = currentUser?.FullName ?? "A researcher";

            var notification = new Notification
            {
                UserId = requesterId,
                Title = "Connection Accepted",
                Message = $"{currentUserName} accepted your connection request.",
                Type = "Connection",
                RelatedEntityId = userId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
            _context.Notifications.Add(notification);

            await _context.SaveChangesAsync();

            await SendRealtimeNotification(notification);

            return Ok(new { message = "Connection accepted" });
        }

        [HttpPut("connect/{requesterId}/reject")]
        public async Task<IActionResult> RejectConnection(int requesterId)
        {
            var userId = GetUserId();
            var connection = await _context.UserConnections
                .FirstOrDefaultAsync(c => c.RequesterId == requesterId && c.TargetId == userId && c.Status == "Pending");

            if (connection == null) return NotFound("Pending connection request not found.");

            connection.Status = "Rejected";
            connection.UpdatedAt = System.DateTime.UtcNow;

            // Generate notification for requester that request was declined
            var currentUser = await _context.Users.FindAsync(userId);
            var currentUserName = currentUser?.FullName ?? "A researcher";

            var notification = new Notification
            {
                UserId = requesterId,
                Title = "Connection Declined",
                Message = $"{currentUserName} declined your connection request.",
                Type = "Connection",
                RelatedEntityId = userId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
            _context.Notifications.Add(notification);

            await _context.SaveChangesAsync();

            await SendRealtimeNotification(notification);

            return Ok(new { message = "Connection rejected" });
        }

        [HttpDelete("connect/{targetUserId}")]
        public async Task<IActionResult> RemoveConnection(int targetUserId)
        {
            var userId = GetUserId();
            var connection = await _context.UserConnections
                .FirstOrDefaultAsync(c => 
                    (c.RequesterId == userId && c.TargetId == targetUserId) || 
                    (c.RequesterId == targetUserId && c.TargetId == userId));

            if (connection == null) return NotFound("Connection not found.");

            _context.UserConnections.Remove(connection);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Connection removed" });
        }

        [HttpGet("connections")]
        public async Task<IActionResult> GetConnections()
        {
            var userId = GetUserId();
            var connections = await _context.UserConnections
                .Include(c => c.Requester)
                .Include(c => c.Target)
                .Where(c => c.RequesterId == userId || c.TargetId == userId)
                .Select(c => new {
                    c.Id,
                    c.RequesterId,
                    RequesterName = c.Requester!.FullName,
                    c.TargetId,
                    TargetName = c.Target!.FullName,
                    c.Status,
                    c.CreatedAt,
                    IsRequester = c.RequesterId == userId
                })
                .ToListAsync();
            return Ok(connections);
        }
    }
}
