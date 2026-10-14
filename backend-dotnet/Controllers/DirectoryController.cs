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
    public class DirectoryController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DirectoryController(ApplicationDbContext context)
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
        // RESEARCHER DIRECTORY
        // =============================================

        // GET /api/directory/researchers?institution=X&department=Y&search=Z
        [HttpGet("researchers")]
        public async Task<IActionResult> GetResearchers(
            [FromQuery] string? institution,
            [FromQuery] string? department,
            [FromQuery] string? search,
            [FromQuery] string? researchInterests)
        {
            // Join Users + UserProfiles + CollaboratorProfiles
            var query = _context.Users
                .Include(u => u.Profile)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(u => u.FullName.Contains(search) ||
                    (u.Profile != null && u.Profile.Department != null && u.Profile.Department.Contains(search)));

            if (!string.IsNullOrWhiteSpace(department))
                query = query.Where(u => u.Profile != null && u.Profile.Department != null &&
                    u.Profile.Department.Contains(department));

            var userIds = await query.Select(u => u.Id).ToListAsync();

            // Now get collaborator profiles for enriched data
            var profiles = await _context.CollaboratorProfiles
                .Include(cp => cp.User)
                .Where(cp => cp.Visibility == "Public" && userIds.Contains(cp.UserId))
                .AsQueryable()
                .Apply(institution, department, researchInterests)
                .OrderBy(cp => cp.User!.FullName)
                .Select(cp => new {
                    cp.UserId,
                    UserName = cp.User!.FullName,
                    cp.Institution,
                    cp.Department,
                    cp.Country,
                    cp.ResearchInterests,
                    cp.ExpertiseAreas,
                    cp.IsOpenToCollaboration
                })
                .ToListAsync();

            return Ok(profiles);
        }

        // GET /api/directory/researchers/{userId}
        [HttpGet("researchers/{userId}")]
        public async Task<IActionResult> GetResearcher(int userId)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound("Researcher not found.");

            var collabProfile = await _context.CollaboratorProfiles
                .FirstOrDefaultAsync(cp => cp.UserId == userId);

            var labMemberships = await _context.LaboratoryMembers
                .Include(lm => lm.Laboratory)
                .Where(lm => lm.UserId == userId && lm.Laboratory!.Visibility == "Public")
                .Select(lm => new {
                    lm.LaboratoryId,
                    LaboratoryName = lm.Laboratory!.Name,
                    lm.Role
                })
                .ToListAsync();

            return Ok(new {
                userId,
                UserName = user.FullName,
                Email = user.Email,
                Profile = user.Profile != null ? new {
                    user.Profile.Bio,
                    user.Profile.Department,
                    user.Profile.University,
                    user.Profile.Skills,
                    user.Profile.Interests
                } : null,
                CollaboratorProfile = collabProfile != null ? new {
                    collabProfile.Institution,
                    collabProfile.Country,
                    collabProfile.ResearchInterests,
                    collabProfile.ExpertiseAreas,
                    collabProfile.IsOpenToCollaboration
                } : null,
                Laboratories = labMemberships
            });
        }

        // =============================================
        // LABORATORY DIRECTORY
        // =============================================

        // GET /api/directory/laboratories?institution=X&search=Y
        [HttpGet("laboratories")]
        public async Task<IActionResult> GetLaboratories(
            [FromQuery] string? institution,
            [FromQuery] string? search,
            [FromQuery] string? researchFocus)
        {
            var query = _context.Laboratories
                .Include(l => l.Head)
                .Where(l => l.Visibility == "Public" && l.Status == "Active");

            if (!string.IsNullOrWhiteSpace(institution))
                query = query.Where(l => l.Institution != null && l.Institution.Contains(institution));

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(l => l.Name.Contains(search) ||
                    (l.Description != null && l.Description.Contains(search)));

            if (!string.IsNullOrWhiteSpace(researchFocus))
                query = query.Where(l => l.ResearchFocus != null && l.ResearchFocus.Contains(researchFocus));

            var labs = await query
                .OrderBy(l => l.Name)
                .Select(l => new {
                    l.Id,
                    l.Name,
                    l.Description,
                    l.ResearchFocus,
                    l.Institution,
                    l.Department,
                    l.Location,
                    l.Website,
                    l.Status,
                    HeadName = l.Head != null ? l.Head.FullName : null,
                    MemberCount = l.Members.Count
                })
                .ToListAsync();

            return Ok(labs);
        }

        // GET /api/directory/laboratories/{id}
        [HttpGet("laboratories/{id}")]
        public async Task<IActionResult> GetLaboratory(int id)
        {
            var lab = await _context.Laboratories
                .Include(l => l.Head)
                .Include(l => l.Members).ThenInclude(m => m.User)
                .FirstOrDefaultAsync(l => l.Id == id);

            if (lab == null) return NotFound("Laboratory not found.");

            var requestingUserId = GetUserId();
            if (lab.Visibility == "Private" && lab.HeadUserId != requestingUserId)
                return Forbid();

            return Ok(new {
                lab.Id,
                lab.Name,
                lab.Description,
                lab.ResearchFocus,
                lab.Institution,
                lab.Department,
                lab.Location,
                lab.Website,
                lab.Visibility,
                lab.Status,
                lab.CreatedAt,
                HeadName = lab.Head?.FullName,
                Members = lab.Members.Select(m => new {
                    m.UserId,
                    UserName = m.User?.FullName,
                    m.Role,
                    m.JoinedAt
                })
            });
        }

        public class CreateLaboratoryRequest
        {
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string? ResearchFocus { get; set; }
            public string? Institution { get; set; }
            public string? Department { get; set; }
            public string? Website { get; set; }
            public string? Location { get; set; }
            public string Visibility { get; set; } = "Public";
        }

        // POST /api/directory/laboratories
        [HttpPost("laboratories")]
        public async Task<IActionResult> CreateLaboratory([FromBody] CreateLaboratoryRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest("Laboratory name is required.");

            var userId = GetUserId();
            var lab = new Laboratory
            {
                Name = req.Name,
                Description = req.Description,
                ResearchFocus = req.ResearchFocus,
                Institution = req.Institution,
                Department = req.Department,
                Website = req.Website,
                Location = req.Location,
                Visibility = req.Visibility,
                HeadUserId = userId,
                Status = "Active"
            };

            _context.Laboratories.Add(lab);
            await _context.SaveChangesAsync();

            // Auto-add creator as Principal Investigator member
            var member = new LaboratoryMember
            {
                LaboratoryId = lab.Id,
                UserId = userId,
                Role = "Principal Investigator"
            };
            _context.LaboratoryMembers.Add(member);
            await _context.SaveChangesAsync();

            return StatusCode(201, lab);
        }

        // PUT /api/directory/laboratories/{id}
        [HttpPut("laboratories/{id}")]
        public async Task<IActionResult> UpdateLaboratory(int id, [FromBody] CreateLaboratoryRequest req)
        {
            var userId = GetUserId();
            var lab = await _context.Laboratories.FindAsync(id);
            if (lab == null) return NotFound("Laboratory not found.");
            if (lab.HeadUserId != userId) return Forbid();

            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest("Laboratory name is required.");

            lab.Name = req.Name;
            lab.Description = req.Description;
            lab.ResearchFocus = req.ResearchFocus;
            lab.Institution = req.Institution;
            lab.Department = req.Department;
            lab.Website = req.Website;
            lab.Location = req.Location;
            lab.Visibility = req.Visibility;
            lab.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(lab);
        }

        // DELETE /api/directory/laboratories/{id}
        [HttpDelete("laboratories/{id}")]
        public async Task<IActionResult> DeleteLaboratory(int id)
        {
            var userId = GetUserId();
            var lab = await _context.Laboratories.FindAsync(id);
            if (lab == null) return NotFound("Laboratory not found.");
            if (lab.HeadUserId != userId) return Forbid();

            lab.Status = "Inactive";
            lab.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Laboratory deactivated." });
        }

        // =============================================
        // LABORATORY MEMBER ENDPOINTS
        // =============================================

        // GET /api/directory/laboratories/{id}/members
        [HttpGet("laboratories/{id}/members")]
        public async Task<IActionResult> GetMembers(int id)
        {
            var lab = await _context.Laboratories.FindAsync(id);
            if (lab == null) return NotFound("Laboratory not found.");

            var members = await _context.LaboratoryMembers
                .Include(m => m.User)
                .Where(m => m.LaboratoryId == id)
                .Select(m => new {
                    m.Id,
                    m.UserId,
                    UserName = m.User!.FullName,
                    m.Role,
                    m.JoinedAt
                })
                .ToListAsync();

            return Ok(members);
        }

        public class AddMemberRequest
        {
            public int UserId { get; set; }
            public string Role { get; set; } = "Researcher";
        }

        // POST /api/directory/laboratories/{id}/members
        [HttpPost("laboratories/{id}/members")]
        public async Task<IActionResult> AddMember(int id, [FromBody] AddMemberRequest req)
        {
            var userId = GetUserId();
            var lab = await _context.Laboratories.FindAsync(id);
            if (lab == null) return NotFound("Laboratory not found.");
            if (lab.HeadUserId != userId) return Forbid();

            var userExists = await _context.Users.AnyAsync(u => u.Id == req.UserId);
            if (!userExists) return NotFound("User not found.");

            var already = await _context.LaboratoryMembers
                .AnyAsync(m => m.LaboratoryId == id && m.UserId == req.UserId);
            if (already) return BadRequest("User is already a member of this laboratory.");

            var member = new LaboratoryMember
            {
                LaboratoryId = id,
                UserId = req.UserId,
                Role = req.Role
            };
            _context.LaboratoryMembers.Add(member);
            await _context.SaveChangesAsync();
            return StatusCode(201, member);
        }

        // DELETE /api/directory/laboratories/{id}/members/{memberId}
        [HttpDelete("laboratories/{id}/members/{memberId}")]
        public async Task<IActionResult> RemoveMember(int id, int memberId)
        {
            var userId = GetUserId();
            var lab = await _context.Laboratories.FindAsync(id);
            if (lab == null) return NotFound("Laboratory not found.");
            if (lab.HeadUserId != userId) return Forbid();

            var member = await _context.LaboratoryMembers
                .FirstOrDefaultAsync(m => m.LaboratoryId == id && m.UserId == memberId);
            if (member == null) return NotFound("Member not found.");

            _context.LaboratoryMembers.Remove(member);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Member removed." });
        }
    }

    // Extension helper for filtering collaborator profiles
    public static class CollaboratorProfileQueryExtensions
    {
        public static IQueryable<CollaboratorProfile> Apply(
            this IQueryable<CollaboratorProfile> query,
            string? institution,
            string? department,
            string? researchInterests)
        {
            if (!string.IsNullOrWhiteSpace(institution))
                query = query.Where(cp => cp.Institution != null && cp.Institution.Contains(institution));

            if (!string.IsNullOrWhiteSpace(department))
                query = query.Where(cp => cp.Department != null && cp.Department.Contains(department));

            if (!string.IsNullOrWhiteSpace(researchInterests))
                query = query.Where(cp => cp.ResearchInterests != null && cp.ResearchInterests.Contains(researchInterests));

            return query;
        }
    }
}
