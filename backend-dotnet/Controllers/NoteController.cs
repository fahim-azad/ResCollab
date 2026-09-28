using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using ResCollab.Api.Services;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System;

namespace ResCollab.Api.Controllers
{
    [Route("api/workspaces/{workspaceId}/notes")]
    [ApiController]
    [Authorize]
    public class NoteController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWorkspaceAccessService _accessService;

        public NoteController(ApplicationDbContext context, IWorkspaceAccessService accessService)
        {
            _context = context;
            _accessService = accessService;
        }

        [HttpGet]
        public async Task<IActionResult> GetNotes(int workspaceId)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            var notes = await _context.WorkspaceNotes
                .Include(n => n.CreatedBy)
                .Where(n => n.WorkspaceId == workspaceId)
                .OrderByDescending(n => n.UpdatedAt)
                .Select(n => new {
                    n.Id,
                    n.Title,
                    n.Content,
                    n.CreatedAt,
                    n.UpdatedAt,
                    CreatedByName = n.CreatedBy != null ? n.CreatedBy.FullName : "Unknown"
                })
                .ToListAsync();

            return Ok(notes);
        }

        public class CreateNoteRequest
        {
            public string Title { get; set; } = string.Empty;
            public string Content { get; set; } = string.Empty;
        }

        [HttpPost]
        public async Task<IActionResult> CreateNote(int workspaceId, [FromBody] CreateNoteRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            var note = new WorkspaceNote
            {
                WorkspaceId = workspaceId,
                Title = req.Title,
                Content = req.Content,
                CreatedById = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.WorkspaceNotes.Add(note);
            await _context.SaveChangesAsync();

            return StatusCode(201, note);
        }
        
        [HttpPatch("{noteId}")]
        public async Task<IActionResult> UpdateNote(int workspaceId, int noteId, [FromBody] CreateNoteRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            var note = await _context.WorkspaceNotes.FirstOrDefaultAsync(n => n.Id == noteId && n.WorkspaceId == workspaceId);
            if (note == null) return NotFound();

            note.Title = req.Title;
            note.Content = req.Content;
            note.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(note);
        }
    }
}
