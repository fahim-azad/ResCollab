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

        [HttpGet("{taskId}/feedback")]
        public async Task<IActionResult> GetMilestoneFeedback(int workspaceId, int taskId)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            // Validate access
            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            // Verify task exists and belongs to workspace
            var taskExists = await _context.WorkspaceTasks.AnyAsync(t => t.Id == taskId && t.WorkspaceId == workspaceId);
            if (!taskExists) return NotFound("Task not found");

            var feedback = await _context.MilestoneFeedbacks
                .Include(f => f.GivenBy)
                .Where(f => f.WorkspaceTaskId == taskId)
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new {
                    f.Id,
                    f.WorkspaceTaskId,
                    f.GivenById,
                    GivenByName = f.GivenBy != null ? f.GivenBy.FullName : null,
                    f.Content,
                    f.StatusChange,
                    f.CreatedAt
                })
                .ToListAsync();

            return Ok(feedback);
        }

        public class CreateFeedbackRequest
        {
            public string Content { get; set; } = string.Empty;
            public string? StatusChange { get; set; }
        }

        [HttpPost("{taskId}/feedback")]
        public async Task<IActionResult> AddMilestoneFeedback(int workspaceId, int taskId, [FromBody] CreateFeedbackRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            // Validate access
            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            var task = await _context.WorkspaceTasks.FirstOrDefaultAsync(t => t.Id == taskId && t.WorkspaceId == workspaceId);
            if (task == null) return NotFound("Task not found");

            if (string.IsNullOrWhiteSpace(req.Content)) return BadRequest("Feedback content cannot be empty");

            var feedback = new MilestoneFeedback
            {
                WorkspaceTaskId = taskId,
                GivenById = userId,
                Content = req.Content,
                StatusChange = req.StatusChange,
                CreatedAt = DateTime.UtcNow
            };

            _context.MilestoneFeedbacks.Add(feedback);

            // Update status if provided
            if (!string.IsNullOrEmpty(req.StatusChange))
            {
                task.Status = req.StatusChange;
            }

            await _context.SaveChangesAsync();

            return StatusCode(201, new {
                feedback.Id,
                feedback.WorkspaceTaskId,
                feedback.GivenById,
                feedback.Content,
                feedback.StatusChange,
                feedback.CreatedAt
            });
        }
    }
}
