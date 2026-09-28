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
        public class ApplyProjectRequest
        {
            public string CoverLetter { get; set; } = string.Empty;
        }

        // POST /api/openproject/{id}/apply
        [HttpPost("{id}/apply")]
        public async Task<IActionResult> ApplyToProject(int id, [FromBody] ApplyProjectRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var project = await _context.OpenProjects.FindAsync(id);
            if (project == null) return NotFound("Project not found");

            if (project.Status != "Recruiting")
                return BadRequest("This project is not currently recruiting.");

            // Check duplicate submission
            var existingApplication = await _context.ProjectApplications
                .FirstOrDefaultAsync(a => a.ProjectId == id && a.ApplicantId == userId);

            if (existingApplication != null)
                return BadRequest("You have already applied to this project.");

            var application = new ProjectApplication
            {
                ProjectId = id,
                ApplicantId = userId,
                CoverLetter = req.CoverLetter,
                Status = "Pending",
                AppliedAt = DateTime.UtcNow
            };

            _context.ProjectApplications.Add(application);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Application submitted successfully", applicationId = application.Id });
        }

        // GET /api/openproject/{id}/applications
        [HttpGet("{id}/applications")]
        public async Task<IActionResult> GetProjectApplications(int id)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var project = await _context.OpenProjects.FindAsync(id);
            if (project == null) return NotFound("Project not found");

            if (project.SupervisorId != userId)
                return Forbid(); // Only supervisor can view applications

            var applications = await _context.ProjectApplications
                .Include(a => a.Applicant)
                .Where(a => a.ProjectId == id)
                .OrderByDescending(a => a.AppliedAt)
                .Select(a => new {
                    a.Id,
                    a.ApplicantId,
                    ApplicantName = a.Applicant != null ? a.Applicant.FullName : "Unknown",
                    ApplicantEmail = a.Applicant != null ? a.Applicant.Email : "",
                    a.CoverLetter,
                    a.Status,
                    a.AppliedAt
                })
                .ToListAsync();

            return Ok(applications);
        }

        // GET /api/openproject/my
        [HttpGet("my")]
        public async Task<IActionResult> GetMyProjects()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var projects = await _context.OpenProjects
                .Include(p => p.Supervisor)
                .Where(p => p.SupervisorId == userId)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new {
                    p.Id,
                    p.Title,
                    p.Department,
                    p.RequiredSkills,
                    p.MaxStudents,
                    p.IsFunded,
                    p.Status,
                    p.CreatedAt
                })
                .ToListAsync();

            return Ok(projects);
        }

        public class ReviewApplicationRequest
        {
            public string Status { get; set; } = string.Empty; // Accepted, Rejected
        }

        // PATCH /api/openproject/{projectId}/applications/{appId}
        [HttpPatch("{projectId}/applications/{appId}")]
        public async Task<IActionResult> ReviewApplication(int projectId, int appId, [FromBody] ReviewApplicationRequest req)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var project = await _context.OpenProjects.FindAsync(projectId);
            if (project == null) return NotFound("Project not found");
            if (project.SupervisorId != userId) return Forbid();

            var application = await _context.ProjectApplications.FirstOrDefaultAsync(a => a.Id == appId && a.ProjectId == projectId);
            if (application == null) return NotFound("Application not found");

            if (req.Status == "Accepted" || req.Status == "Rejected")
            {
                application.Status = req.Status;
                await _context.SaveChangesAsync();
                return Ok(new { message = $"Application {req.Status}" });
            }
            return BadRequest("Invalid status.");
        }
    }
}
