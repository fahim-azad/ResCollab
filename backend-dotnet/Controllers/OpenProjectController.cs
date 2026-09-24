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
    public class OpenProjectController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public OpenProjectController(ApplicationDbContext context)
        {
            _context = context;
        }

        public class CreateProjectRequest
        {
            public string Title { get; set; } = string.Empty;
            public string Description { get; set; } = string.Empty;
            public string? Department { get; set; }
            public string? RequiredSkills { get; set; }
            public int MaxStudents { get; set; } = 1;
            public bool IsFunded { get; set; } = false;
        }

        // POST /api/openproject
        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] CreateProjectRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found");

            if (user.Role != "Supervisor" && user.Role != "Faculty")
            {
                return Forbid();
            }

            var project = new OpenProject
            {
                SupervisorId = userId,
                Title = req.Title,
                Description = req.Description,
                Department = req.Department,
                RequiredSkills = req.RequiredSkills,
                MaxStudents = req.MaxStudents,
                IsFunded = req.IsFunded,
                Status = "Recruiting",
                CreatedAt = DateTime.UtcNow
            };

            _context.OpenProjects.Add(project);
            await _context.SaveChangesAsync();

            return StatusCode(201, project);
        }

        // GET /api/openproject
        [HttpGet]
        public async Task<IActionResult> GetProjects([FromQuery] bool? isFunded)
        {
            var query = _context.OpenProjects
                .Include(p => p.Supervisor)
                .Where(p => p.Status == "Recruiting")
                .AsQueryable();

            if (isFunded.HasValue)
            {
                query = query.Where(p => p.IsFunded == isFunded.Value);
            }

            var projects = await query
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new {
                    p.Id,
                    p.Title,
                    p.Department,
                    p.RequiredSkills,
                    p.MaxStudents,
                    p.IsFunded,
                    p.CreatedAt,
                    SupervisorName = p.Supervisor != null ? p.Supervisor.FullName : "Unknown"
                })
                .ToListAsync();

            return Ok(projects);
        }

        // GET /api/openproject/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProjectDetails(int id)
        {
            var project = await _context.OpenProjects
                .Include(p => p.Supervisor)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound("Project not found");

            return Ok(new {
                project.Id,
                project.Title,
                project.Description,
                project.Department,
                project.RequiredSkills,
                project.MaxStudents,
                project.IsFunded,
                project.Status,
                project.CreatedAt,
                SupervisorId = project.SupervisorId,
                SupervisorName = project.Supervisor != null ? project.Supervisor.FullName : "Unknown"
            });
        }
    }
}
