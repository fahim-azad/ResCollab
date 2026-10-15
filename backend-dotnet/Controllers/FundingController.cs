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
    public class FundingController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public FundingController(ApplicationDbContext context)
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
        // BROWSE & DISCOVERY ENDPOINTS
        // =============================================

        // GET /api/funding?fundingType=Grant&researchArea=AI&status=Open&search=X
        [HttpGet]
        public async Task<IActionResult> GetOpportunities(
            [FromQuery] string? fundingType,
            [FromQuery] string? researchArea,
            [FromQuery] string? status,
            [FromQuery] string? search)
        {
            var query = _context.FundingOpportunities
                .Include(f => f.PostedBy)
                .AsQueryable();

            // Default to Open if no status filter given
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(f => f.Status == status);
            else
                query = query.Where(f => f.Status == "Open");

            if (!string.IsNullOrWhiteSpace(fundingType))
                query = query.Where(f => f.FundingType == fundingType);

            if (!string.IsNullOrWhiteSpace(researchArea))
                query = query.Where(f => f.ResearchArea != null && f.ResearchArea.Contains(researchArea));

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(f =>
                    f.Title.Contains(search) ||
                    f.Provider.Contains(search) ||
                    (f.Description != null && f.Description.Contains(search)));

            var results = await query
                .OrderBy(f => f.Deadline == null)         // entries with a deadline come first
                .ThenBy(f => f.Deadline)                  // soonest deadline first
                .ThenByDescending(f => f.CreatedAt)
                .Select(f => new {
                    f.Id,
                    f.Title,
                    f.Provider,
                    f.FundingType,
                    f.FundingAmount,
                    f.ResearchArea,
                    f.Deadline,
                    f.Status,
                    f.CreatedAt,
                    PostedByName = f.PostedBy != null ? f.PostedBy.FullName : null
                })
                .ToListAsync();

            return Ok(results);
        }

        // GET /api/funding/{id}  — full detail including application info
        [HttpGet("{id}")]
        public async Task<IActionResult> GetOpportunity(int id)
        {
            var opp = await _context.FundingOpportunities
                .Include(f => f.PostedBy)
                .FirstOrDefaultAsync(f => f.Id == id);

            if (opp == null) return NotFound("Funding opportunity not found.");

            return Ok(new {
                opp.Id,
                opp.Title,
                opp.Provider,
                opp.Description,
                opp.Eligibility,
                opp.Requirements,
                opp.FundingAmount,
                opp.FundingType,
                opp.ResearchArea,
                opp.ApplicationUrl,
                opp.ApplicationInfo,
                opp.Deadline,
                opp.Status,
                opp.PostedById,
                PostedByName = opp.PostedBy?.FullName,
                opp.CreatedAt,
                opp.UpdatedAt
            });
        }

        // =============================================
        // WRITE ENDPOINTS WITH VALIDATION
        // =============================================

        public class FundingOpportunityRequest
        {
            public string Title { get; set; } = string.Empty;
            public string Provider { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string? Eligibility { get; set; }
            public string? Requirements { get; set; }
            public string? FundingAmount { get; set; }
            public string FundingType { get; set; } = "Grant";
            public string? ResearchArea { get; set; }
            public string? ApplicationUrl { get; set; }
            public string? ApplicationInfo { get; set; }
            public DateTime? Deadline { get; set; }
            public string Status { get; set; } = "Open";
        }

        private string? ValidateRequest(FundingOpportunityRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Title))
                return "Title is required.";

            if (string.IsNullOrWhiteSpace(req.Provider))
                return "Provider is required.";

            var validTypes = new[] { "Grant", "Scholarship", "Fellowship", "Award", "Contract", "Other" };
            if (!validTypes.Contains(req.FundingType))
                return "Invalid funding type. Must be: Grant, Scholarship, Fellowship, Award, Contract, or Other.";

            var validStatuses = new[] { "Open", "Closed", "Upcoming" };
            if (!validStatuses.Contains(req.Status))
                return "Status must be Open, Closed, or Upcoming.";

            if (req.Deadline.HasValue && req.Deadline.Value < DateTime.UtcNow.Date && req.Status == "Open")
                return "Cannot set a past deadline on an Open opportunity.";

            return null;
        }

        // POST /api/funding
        [HttpPost]
        public async Task<IActionResult> CreateOpportunity([FromBody] FundingOpportunityRequest req)
        {
            var error = ValidateRequest(req);
            if (error != null) return BadRequest(error);

            var userId = GetUserId();
            var opp = new FundingOpportunity
            {
                Title = req.Title.Trim(),
                Provider = req.Provider.Trim(),
                Description = req.Description?.Trim(),
                Eligibility = req.Eligibility?.Trim(),
                Requirements = req.Requirements?.Trim(),
                FundingAmount = req.FundingAmount?.Trim(),
                FundingType = req.FundingType,
                ResearchArea = req.ResearchArea?.Trim(),
                ApplicationUrl = req.ApplicationUrl?.Trim(),
                ApplicationInfo = req.ApplicationInfo?.Trim(),
                Deadline = req.Deadline,
                Status = req.Status,
                PostedById = userId
            };

            _context.FundingOpportunities.Add(opp);
            await _context.SaveChangesAsync();
            return StatusCode(201, opp);
        }

        // PUT /api/funding/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateOpportunity(int id, [FromBody] FundingOpportunityRequest req)
        {
            var error = ValidateRequest(req);
            if (error != null) return BadRequest(error);

            var userId = GetUserId();
            var opp = await _context.FundingOpportunities.FindAsync(id);
            if (opp == null) return NotFound("Funding opportunity not found.");
            if (opp.PostedById != userId) return Forbid();

            opp.Title = req.Title.Trim();
            opp.Provider = req.Provider.Trim();
            opp.Description = req.Description?.Trim();
            opp.Eligibility = req.Eligibility?.Trim();
            opp.Requirements = req.Requirements?.Trim();
            opp.FundingAmount = req.FundingAmount?.Trim();
            opp.FundingType = req.FundingType;
            opp.ResearchArea = req.ResearchArea?.Trim();
            opp.ApplicationUrl = req.ApplicationUrl?.Trim();
            opp.ApplicationInfo = req.ApplicationInfo?.Trim();
            opp.Deadline = req.Deadline;
            opp.Status = req.Status;
            opp.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(opp);
        }

        // DELETE /api/funding/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOpportunity(int id)
        {
            var userId = GetUserId();
            var opp = await _context.FundingOpportunities.FindAsync(id);
            if (opp == null) return NotFound("Funding opportunity not found.");
            if (opp.PostedById != userId) return Forbid();

            _context.FundingOpportunities.Remove(opp);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Funding opportunity deleted." });
        }

        // PATCH /api/funding/{id}/status
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] string status)
        {
            var userId = GetUserId();
            var opp = await _context.FundingOpportunities.FindAsync(id);
            if (opp == null) return NotFound("Funding opportunity not found.");
            if (opp.PostedById != userId) return Forbid();

            var validStatuses = new[] { "Open", "Closed", "Upcoming" };
            if (!validStatuses.Contains(status))
                return BadRequest("Status must be Open, Closed, or Upcoming.");

            opp.Status = status;
            opp.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Status updated to {status}." });
        }

        // GET /api/funding/my  - Get all opportunities posted by the current user
        [HttpGet("my")]
        public async Task<IActionResult> GetMyOpportunities()
        {
            var userId = GetUserId();
            var opps = await _context.FundingOpportunities
                .Where(f => f.PostedById == userId)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();

            return Ok(opps);
        }
    }
}
