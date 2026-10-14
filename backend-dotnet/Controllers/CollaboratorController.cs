using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CollaboratorController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CollaboratorController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        // =============================================
        // COLLABORATOR PROFILE ENDPOINTS
        // =============================================

        // GET /api/collaborator/discover?institution=X&country=Y&expertise=Z&openOnly=true
        [HttpGet("discover")]
        public async Task<IActionResult> DiscoverCollaborators(
            [FromQuery] string? institution,
            [FromQuery] string? country,
            [FromQuery] string? expertise,
            [FromQuery] bool openOnly = false)
        {
            var query = _context.CollaboratorProfiles
                .Include(cp => cp.User)
                .Where(cp => cp.Visibility == "Public");

            if (!string.IsNullOrWhiteSpace(institution))
                query = query.Where(cp => cp.Institution != null && cp.Institution.Contains(institution));

            if (!string.IsNullOrWhiteSpace(country))
                query = query.Where(cp => cp.Country != null && cp.Country.Contains(country));

            if (!string.IsNullOrWhiteSpace(expertise))
                query = query.Where(cp => 
                    (cp.ExpertiseAreas != null && cp.ExpertiseAreas.Contains(expertise)) ||
                    (cp.ResearchInterests != null && cp.ResearchInterests.Contains(expertise)));

            if (openOnly)
                query = query.Where(cp => cp.IsOpenToCollaboration);

            var results = await query
                .OrderBy(cp => cp.User!.FullName)
                .Select(cp => new {
                    cp.Id,
                    cp.UserId,
                    UserName = cp.User!.FullName,
                    cp.Institution,
                    cp.Department,
                    cp.Country,
                    cp.ResearchInterests,
                    cp.ExpertiseAreas,
                    cp.IsOpenToCollaboration,
                    cp.Visibility
                })
                .ToListAsync();

            return Ok(results);
        }

        // GET /api/collaborator/profile/me
        [HttpGet("profile/me")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = GetUserId();
            var profile = await _context.CollaboratorProfiles
                .FirstOrDefaultAsync(cp => cp.UserId == userId);

            if (profile == null) return NotFound("Collaborator profile not found.");
            return Ok(profile);
        }

        // GET /api/collaborator/profile/{userId}
        [HttpGet("profile/{userId}")]
        public async Task<IActionResult> GetProfile(int userId)
        {
            var profile = await _context.CollaboratorProfiles
                .Include(cp => cp.User)
                .FirstOrDefaultAsync(cp => cp.UserId == userId);

            if (profile == null) return NotFound("Collaborator profile not found.");

            // Respect visibility
            var requestingUserId = GetUserId();
            if (profile.Visibility == "Private" && profile.UserId != requestingUserId)
                return Forbid();

            return Ok(new {
                profile.Id,
                profile.UserId,
                UserName = profile.User!.FullName,
                profile.Institution,
                profile.Department,
                profile.Country,
                profile.ResearchInterests,
                profile.ExpertiseAreas,
                profile.IsOpenToCollaboration,
                profile.Visibility,
                profile.CreatedAt
            });
        }

        public class UpsertCollaboratorProfileRequest
        {
            public string? Institution { get; set; }
            public string? Department { get; set; }
            public string? Country { get; set; }
            public string? ResearchInterests { get; set; }
            public string? ExpertiseAreas { get; set; }
            public bool IsOpenToCollaboration { get; set; } = true;
            public string Visibility { get; set; } = "Public";
        }

        // POST /api/collaborator/profile  (create or update)
        [HttpPost("profile")]
        public async Task<IActionResult> UpsertProfile([FromBody] UpsertCollaboratorProfileRequest req)
        {
            var userId = GetUserId();
            var existing = await _context.CollaboratorProfiles
                .FirstOrDefaultAsync(cp => cp.UserId == userId);

            if (existing == null)
            {
                var profile = new CollaboratorProfile
                {
                    UserId = userId,
                    Institution = req.Institution,
                    Department = req.Department,
                    Country = req.Country,
                    ResearchInterests = req.ResearchInterests,
                    ExpertiseAreas = req.ExpertiseAreas,
                    IsOpenToCollaboration = req.IsOpenToCollaboration,
                    Visibility = req.Visibility
                };
                _context.CollaboratorProfiles.Add(profile);
                await _context.SaveChangesAsync();
                return StatusCode(201, profile);
            }

            existing.Institution = req.Institution;
            existing.Department = req.Department;
            existing.Country = req.Country;
            existing.ResearchInterests = req.ResearchInterests;
            existing.ExpertiseAreas = req.ExpertiseAreas;
            existing.IsOpenToCollaboration = req.IsOpenToCollaboration;
            existing.Visibility = req.Visibility;
            existing.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // =============================================
        // COLLABORATION OPPORTUNITY ENDPOINTS
        // =============================================

        // GET /api/collaborator/opportunities?researchArea=X&crossInstitution=true
        [HttpGet("opportunities")]
        public async Task<IActionResult> GetOpportunities(
            [FromQuery] string? researchArea,
            [FromQuery] bool? crossInstitution,
            [FromQuery] string? status)
        {
            var query = _context.CollaborationOpportunities
                .Include(co => co.PostedBy)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(researchArea))
                query = query.Where(co => co.ResearchArea != null && co.ResearchArea.Contains(researchArea));

            if (crossInstitution.HasValue)
                query = query.Where(co => co.IsCrossInstitution == crossInstitution.Value);

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(co => co.Status == status);
            else
                query = query.Where(co => co.Status == "Open");

            var results = await query
                .OrderByDescending(co => co.CreatedAt)
                .Select(co => new {
                    co.Id,
                    co.Title,
                    co.Description,
                    co.RequiredExpertise,
                    co.ResearchArea,
                    co.Status,
                    co.IsCrossInstitution,
                    co.Deadline,
                    co.CreatedAt,
                    co.PostedById,
                    PostedByName = co.PostedBy != null ? co.PostedBy.FullName : null
                })
                .ToListAsync();

            return Ok(results);
        }

        // GET /api/collaborator/opportunities/{id}
        [HttpGet("opportunities/{id}")]
        public async Task<IActionResult> GetOpportunity(int id)
        {
            var opp = await _context.CollaborationOpportunities
                .Include(co => co.PostedBy)
                .FirstOrDefaultAsync(co => co.Id == id);

            if (opp == null) return NotFound("Opportunity not found.");

            return Ok(new {
                opp.Id,
                opp.Title,
                opp.Description,
                opp.RequiredExpertise,
                opp.ResearchArea,
                opp.Status,
                opp.IsCrossInstitution,
                opp.Deadline,
                opp.CreatedAt,
                opp.PostedById,
                PostedByName = opp.PostedBy?.FullName
            });
        }

        public class CreateOpportunityRequest
        {
            public string Title { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string? RequiredExpertise { get; set; }
            public string? ResearchArea { get; set; }
            public bool IsCrossInstitution { get; set; } = true;
            public DateTime? Deadline { get; set; }
        }

        // POST /api/collaborator/opportunities
        [HttpPost("opportunities")]
        public async Task<IActionResult> CreateOpportunity([FromBody] CreateOpportunityRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Title))
                return BadRequest("Title is required.");

            var userId = GetUserId();
            var opp = new CollaborationOpportunity
            {
                PostedById = userId,
                Title = req.Title,
                Description = req.Description,
                RequiredExpertise = req.RequiredExpertise,
                ResearchArea = req.ResearchArea,
                IsCrossInstitution = req.IsCrossInstitution,
                Deadline = req.Deadline,
                Status = "Open"
            };

            _context.CollaborationOpportunities.Add(opp);
            await _context.SaveChangesAsync();
            return StatusCode(201, opp);
        }

        // PUT /api/collaborator/opportunities/{id}
        [HttpPut("opportunities/{id}")]
        public async Task<IActionResult> UpdateOpportunity(int id, [FromBody] CreateOpportunityRequest req)
        {
            var userId = GetUserId();
            var opp = await _context.CollaborationOpportunities
                .FirstOrDefaultAsync(co => co.Id == id);

            if (opp == null) return NotFound("Opportunity not found.");
            if (opp.PostedById != userId) return Forbid();

            opp.Title = req.Title;
            opp.Description = req.Description;
            opp.RequiredExpertise = req.RequiredExpertise;
            opp.ResearchArea = req.ResearchArea;
            opp.IsCrossInstitution = req.IsCrossInstitution;
            opp.Deadline = req.Deadline;
            await _context.SaveChangesAsync();
            return Ok(opp);
        }

        // DELETE /api/collaborator/opportunities/{id}
        [HttpDelete("opportunities/{id}")]
        public async Task<IActionResult> DeleteOpportunity(int id)
        {
            var userId = GetUserId();
            var opp = await _context.CollaborationOpportunities
                .FirstOrDefaultAsync(co => co.Id == id);

            if (opp == null) return NotFound("Opportunity not found.");
            if (opp.PostedById != userId) return Forbid();

            _context.CollaborationOpportunities.Remove(opp);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Opportunity deleted." });
        }

        // PATCH /api/collaborator/opportunities/{id}/status
        [HttpPatch("opportunities/{id}/status")]
        public async Task<IActionResult> UpdateOpportunityStatus(int id, [FromBody] string status)
        {
            var userId = GetUserId();
            var opp = await _context.CollaborationOpportunities
                .FirstOrDefaultAsync(co => co.Id == id);

            if (opp == null) return NotFound("Opportunity not found.");
            if (opp.PostedById != userId) return Forbid();

            var validStatuses = new[] { "Open", "Closed", "InProgress" };
            if (!validStatuses.Contains(status))
                return BadRequest("Invalid status. Must be Open, Closed, or InProgress.");

            opp.Status = status;
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Status updated to {status}." });
        }
    }
}
