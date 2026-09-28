using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using ResCollab.Api.Services;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System;

namespace ResCollab.Api.Controllers
{
    [Route("api/workspaces/{workspaceId}/tasks")]
    [ApiController]
    [Authorize]
    public class TaskController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWorkspaceAccessService _accessService;

        public TaskController(ApplicationDbContext context, IWorkspaceAccessService accessService)
        {
            _context = context;
            _accessService = accessService;
        }

        [HttpGet]
        public async Task<IActionResult> GetTasks(int workspaceId)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            // Validate that the user is a member of this workspace
            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            var tasks = await _context.WorkspaceTasks
                .Include(t => t.Assignee)
                .Where(t => t.WorkspaceId == workspaceId)
                .OrderBy(t => t.DueDate ?? DateTime.MaxValue)
                .Select(t => new {
                    t.Id,
                    t.Title,
                    t.Description,
                    t.Status,
                    t.IsMilestone,
                    t.DueDate,
                    t.CreatedAt,
                    t.AssignedToId,
                    AssigneeName = t.Assignee != null ? t.Assignee.FullName : null
                })
                .ToListAsync();

            return Ok(tasks);
        }

        public class CreateTaskRequest
        {
            public string Title { get; set; } = string.Empty;
            public string? Description { get; set; }
            public int? AssignedToId { get; set; }
            public DateTime? DueDate { get; set; }
            public bool IsMilestone { get; set; } = false;
        }

        [HttpPost]
        public async Task<IActionResult> CreateTask(int workspaceId, [FromBody] CreateTaskRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            // Validate access
            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            var task = new WorkspaceTask
            {
                WorkspaceId = workspaceId,
                Title = req.Title,
                Description = req.Description,
                AssignedToId = req.AssignedToId,
                DueDate = req.DueDate,
                IsMilestone = req.IsMilestone,
                Status = "Todo",
                CreatedAt = DateTime.UtcNow
            };

            _context.WorkspaceTasks.Add(task);
            await _context.SaveChangesAsync();

            return StatusCode(201, task);
        }

        public class UpdateTaskRequest
        {
            public string? Status { get; set; }
        }

        [HttpPatch("{taskId}")]
        public async Task<IActionResult> UpdateTaskStatus(int workspaceId, int taskId, [FromBody] UpdateTaskRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            // Validate access
            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            var task = await _context.WorkspaceTasks.FirstOrDefaultAsync(t => t.Id == taskId && t.WorkspaceId == workspaceId);
            if (task == null) return NotFound("Task not found");

            if (!string.IsNullOrEmpty(req.Status))
            {
                task.Status = req.Status;
            }

            await _context.SaveChangesAsync();
            return Ok(task);
        }
    }
}
