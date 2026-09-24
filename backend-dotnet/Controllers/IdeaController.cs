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
    public class IdeaController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public IdeaController(ApplicationDbContext context)
        {
            _context = context;
        }

        public class CreateIdeaRequest
        {
            public string Title { get; set; } = string.Empty;
            public string Description { get; set; } = string.Empty;
            public string? ResearchArea { get; set; }
            public string? RequiredSkills { get; set; }
            public string? ExpectedOutcome { get; set; }
            public int RequiredTeamSize { get; set; } = 1;
        }

        // POST /api/idea
        [HttpPost]
        public async Task<IActionResult> CreateIdea([FromBody] CreateIdeaRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var idea = new ResearchIdea
            {
                CreatorId = userId,
                Title = req.Title,
                Description = req.Description,
                ResearchArea = req.ResearchArea,
                RequiredSkills = req.RequiredSkills,
                ExpectedOutcome = req.ExpectedOutcome,
                RequiredTeamSize = req.RequiredTeamSize,
                Status = "Open",
                CreatedAt = DateTime.UtcNow
            };

            _context.ResearchIdeas.Add(idea);
            await _context.SaveChangesAsync();

            return StatusCode(201, idea);
        }

        // GET /api/idea
        [HttpGet]
        public async Task<IActionResult> GetIdeas([FromQuery] string? status = "Open")
        {
            var query = _context.ResearchIdeas
                .Include(i => i.Creator)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(i => i.Status == status);
            }

            var ideas = await query
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => new {
                    i.Id,
                    i.Title,
                    i.ResearchArea,
                    i.RequiredSkills,
                    i.RequiredTeamSize,
                    i.Status,
                    i.CreatedAt,
                    CreatorName = i.Creator != null ? i.Creator.FullName : "Unknown"
                })
                .ToListAsync();

            return Ok(ideas);
        }

        // GET /api/idea/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetIdeaDetails(int id)
        {
            var idea = await _context.ResearchIdeas
                .Include(i => i.Creator)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (idea == null) return NotFound("Idea not found");

            return Ok(new {
                idea.Id,
                idea.Title,
                idea.Description,
                idea.ResearchArea,
                idea.RequiredSkills,
                idea.ExpectedOutcome,
                idea.RequiredTeamSize,
                idea.Status,
                idea.CreatedAt,
                CreatorId = idea.CreatorId,
                CreatorName = idea.Creator != null ? idea.Creator.FullName : "Unknown"
            });
        }

        public class ApplyIdeaRequest
        {
            public string? Message { get; set; }
        }

        // POST /api/idea/{id}/apply
        [HttpPost("{id}/apply")]
        public async Task<IActionResult> ApplyToIdea(int id, [FromBody] ApplyIdeaRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var idea = await _context.ResearchIdeas.FindAsync(id);
            if (idea == null) return NotFound("Idea not found");

            if (idea.CreatorId == userId) return BadRequest("You cannot apply to your own idea");

            var existingApp = await _context.IdeaApplications.FirstOrDefaultAsync(a => a.IdeaId == id && a.ApplicantId == userId);
            if (existingApp != null) return BadRequest("You have already applied to this idea");

            var application = new IdeaApplication
            {
                IdeaId = id,
                ApplicantId = userId,
                Message = req.Message,
                Status = "Pending",
                AppliedAt = DateTime.UtcNow
            };

            _context.IdeaApplications.Add(application);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Application submitted successfully" });
        }

        public class UpdateApplicationStatusRequest
        {
            public string Status { get; set; } = string.Empty; // Accepted or Rejected
        }

        // PUT /api/idea/applications/{appId}/status
        [HttpPut("applications/{appId}/status")]
        public async Task<IActionResult> UpdateApplicationStatus(int appId, [FromBody] UpdateApplicationStatusRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var app = await _context.IdeaApplications
                .Include(a => a.Idea)
                .FirstOrDefaultAsync(a => a.Id == appId);

            if (app == null) return NotFound("Application not found");
            if (app.Idea!.CreatorId != userId) return Forbid(); // Using 403 Forbidden instead of string for Forbid()

            if (req.Status != "Accepted" && req.Status != "Rejected")
                return BadRequest("Invalid status. Must be Accepted or Rejected.");

            app.Status = req.Status;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Application {req.Status}" });
        }
    }
}
