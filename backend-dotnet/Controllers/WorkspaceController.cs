using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class WorkspaceController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public WorkspaceController(ApplicationDbContext context)
        {
            _context = context;
        }

        public class CreateWorkspaceRequest
        {
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
            public int? OpenProjectId { get; set; }
        }

        // POST /api/workspace
        [HttpPost]
        public async Task<IActionResult> CreateWorkspace([FromBody] CreateWorkspaceRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var workspace = new Workspace
            {
                Name = req.Name,
                Description = req.Description,
                OpenProjectId = req.OpenProjectId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Workspaces.Add(workspace);
            await _context.SaveChangesAsync(); // To get workspace.Id

            // Add the creator as Admin
            var member = new WorkspaceMember
            {
                WorkspaceId = workspace.Id,
                UserId = userId,
                Role = "Admin",
                JoinedAt = DateTime.UtcNow
            };

            _context.WorkspaceMembers.Add(member);
            await _context.SaveChangesAsync();

            return StatusCode(201, new { message = "Workspace created successfully", workspaceId = workspace.Id });
        }

        // GET /api/workspace
        [HttpGet]
        public async Task<IActionResult> GetMyWorkspaces()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var workspaces = await _context.WorkspaceMembers
                .Include(wm => wm.Workspace)
                .Where(wm => wm.UserId == userId)
                .Select(wm => new {
                    wm.Workspace!.Id,
                    wm.Workspace.Name,
                    wm.Workspace.Description,
                    wm.Role,
                    wm.JoinedAt,
                    wm.Workspace.CreatedAt
                })
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();

            return Ok(workspaces);
        }

        public class AddMemberRequest
        {
            public int UserId { get; set; }
            public string Role { get; set; } = "Member"; // Admin or Member
        }

        // POST /api/workspace/{id}/members
        [HttpPost("{id}/members")]
        public async Task<IActionResult> AddMember(int id, [FromBody] AddMemberRequest req)
        {
            var currentUserIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(currentUserIdStr, out int currentUserId)) return Unauthorized();

            // Check if current user is an Admin of this workspace
            var adminCheck = await _context.WorkspaceMembers
                .FirstOrDefaultAsync(wm => wm.WorkspaceId == id && wm.UserId == currentUserId && wm.Role == "Admin");
            
            if (adminCheck == null) return Forbid(); // Not authorized to add members

            // Check if user to add exists
            var userToAdd = await _context.Users.FindAsync(req.UserId);
            if (userToAdd == null) return NotFound("User to add not found");

            // Check if already a member
            var existingMember = await _context.WorkspaceMembers
                .FirstOrDefaultAsync(wm => wm.WorkspaceId == id && wm.UserId == req.UserId);
            
            if (existingMember != null) return BadRequest("User is already a member of this workspace.");

            var newMember = new WorkspaceMember
            {
                WorkspaceId = id,
                UserId = req.UserId,
                Role = req.Role,
                JoinedAt = DateTime.UtcNow
            };

            _context.WorkspaceMembers.Add(newMember);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Member added successfully" });
        }

        // GET /api/workspace/{id}/members
        [HttpGet("{id}/members")]
        public async Task<IActionResult> GetWorkspaceMembers(int id)
        {
            var currentUserIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(currentUserIdStr, out int currentUserId)) return Unauthorized();

            // Check if current user is part of workspace
            var membership = await _context.WorkspaceMembers
                .FirstOrDefaultAsync(wm => wm.WorkspaceId == id && wm.UserId == currentUserId);
            
            if (membership == null) return Forbid();

            var members = await _context.WorkspaceMembers
                .Include(wm => wm.User)
                .Where(wm => wm.WorkspaceId == id)
                .Select(wm => new {
                    wm.UserId,
                    UserName = wm.User!.FullName,
                    UserEmail = wm.User.Email,
                    wm.Role,
                    wm.JoinedAt
                })
                .ToListAsync();

            return Ok(members);
        }
    }
}
