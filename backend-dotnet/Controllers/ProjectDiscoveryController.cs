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
    public class ProjectDiscoveryController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ProjectDiscoveryController(ApplicationDbContext context)
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
        // DISCOVERY: Browse visible projects & ideas
        // =============================================

        // GET /api/projectdiscovery?itemType=OpenProject&researchArea=X&search=Y
        [HttpGet]
        public async Task<IActionResult> DiscoverProjects(
            [FromQuery] string? itemType,
            [FromQuery] string? search,
            [FromQuery] string? researchArea,
            [FromQuery] int? laboratoryId)
        {
            var listingQuery = _context.ProjectDirectoryListings
                .Include(pdl => pdl.Laboratory)
                .Where(pdl => pdl.Visibility == "Public");

            if (!string.IsNullOrWhiteSpace(itemType))
                listingQuery = listingQuery.Where(pdl => pdl.ItemType == itemType);

            if (laboratoryId.HasValue)
                listingQuery = listingQuery.Where(pdl => pdl.LaboratoryId == laboratoryId.Value);

            var listings = await listingQuery.ToListAsync();
            var results = new System.Collections.Generic.List<object>();

            foreach (var listing in listings)
            {
                if (listing.ItemType == "OpenProject")
                {
                    var project = await _context.OpenProjects
                        .Include(p => p.Supervisor)
                        .FirstOrDefaultAsync(p => p.Id == listing.ItemId && p.Status == "Recruiting");

                    if (project == null) continue;

                    if (!string.IsNullOrWhiteSpace(search) &&
                        !project.Title.Contains(search, StringComparison.OrdinalIgnoreCase) &&
                        !(project.Description?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false))
                        continue;

                    results.Add(new {
                        listing.Id,
                        listing.ItemType,
                        listing.ItemId,
                        listing.Visibility,
                        listing.LaboratoryId,
                        LaboratoryName = listing.Laboratory?.Name,
                        Item = new {
                            project.Id,
                            project.Title,
                            project.Description,
                            project.Department,
                            project.RequiredSkills,
                            project.MaxStudents,
                            project.IsFunded,
                            project.Status,
                            project.CreatedAt,
                            SupervisorName = project.Supervisor?.FullName
                        }
                    });
                }
                else if (listing.ItemType == "ResearchIdea")
                {
                    var idea = await _context.ResearchIdeas
                        .Include(i => i.Creator)
                        .FirstOrDefaultAsync(i => i.Id == listing.ItemId && i.Status != "Closed");

                    if (idea == null) continue;

                    if (!string.IsNullOrWhiteSpace(search) &&
                        !idea.Title.Contains(search, StringComparison.OrdinalIgnoreCase) &&
                        !(idea.Description?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false))
                        continue;

                    if (!string.IsNullOrWhiteSpace(researchArea) &&
                        !(idea.ResearchArea?.Contains(researchArea, StringComparison.OrdinalIgnoreCase) ?? false))
                        continue;

                    results.Add(new {
                        listing.Id,
                        listing.ItemType,
                        listing.ItemId,
                        listing.Visibility,
                        listing.LaboratoryId,
                        LaboratoryName = listing.Laboratory?.Name,
                        Item = new {
                            idea.Id,
                            idea.Title,
                            idea.Description,
                            idea.ResearchArea,
                            idea.RequiredSkills,
                            idea.RequiredTeamSize,
                            idea.ExpectedOutcome,
                            idea.Status,
                            idea.CreatedAt,
                            CreatorName = idea.Creator?.FullName
                        }
                    });
                }
            }

            return Ok(results);
        }

        // GET /api/projectdiscovery/listing/{id}
        [HttpGet("listing/{id}")]
        public async Task<IActionResult> GetListing(int id)
        {
            var listing = await _context.ProjectDirectoryListings
                .Include(pdl => pdl.Laboratory)
                .FirstOrDefaultAsync(pdl => pdl.Id == id);

            if (listing == null) return NotFound("Listing not found.");
            return Ok(listing);
        }

        // GET /api/projectdiscovery/my-listings
        [HttpGet("my-listings")]
        public async Task<IActionResult> GetMyListings()
        {
            var userId = GetUserId();
            var allListings = await _context.ProjectDirectoryListings
                .Include(pdl => pdl.Laboratory)
                .ToListAsync();

            var results = new System.Collections.Generic.List<object>();
            foreach (var listing in allListings)
            {
                if (listing.ItemType == "OpenProject")
                {
                    var project = await _context.OpenProjects.FirstOrDefaultAsync(p => p.Id == listing.ItemId && p.SupervisorId == userId);
                    if (project != null)
                    {
                        results.Add(new {
                            listing.Id,
                            listing.ItemType,
                            listing.ItemId,
                            listing.Visibility,
                            listing.LaboratoryId,
                            LaboratoryName = listing.Laboratory?.Name,
                            Title = project.Title,
                            Description = project.Description,
                            Department = project.Department,
                            Status = project.Status,
                            CreatedAt = listing.CreatedAt
                        });
                    }
                }
                else if (listing.ItemType == "ResearchIdea")
                {
                    var idea = await _context.ResearchIdeas.FirstOrDefaultAsync(i => i.Id == listing.ItemId && i.CreatorId == userId);
                    if (idea != null)
                    {
                        results.Add(new {
                            listing.Id,
                            listing.ItemType,
                            listing.ItemId,
                            listing.Visibility,
                            listing.LaboratoryId,
                            LaboratoryName = listing.Laboratory?.Name,
                            Title = idea.Title,
                            Description = idea.Description,
                            ResearchArea = idea.ResearchArea,
                            Status = idea.Status,
                            CreatedAt = listing.CreatedAt
                        });
                    }
                }
            }
            return Ok(results);
        }

        // GET /api/projectdiscovery/unlisted-items
        [HttpGet("unlisted-items")]
        public async Task<IActionResult> GetUnlistedItems()
        {
            var userId = GetUserId();
            var existingListings = await _context.ProjectDirectoryListings.ToListAsync();

            var listedProjectIds = existingListings.Where(l => l.ItemType == "OpenProject").Select(l => l.ItemId).ToHashSet();
            var listedIdeaIds = existingListings.Where(l => l.ItemType == "ResearchIdea").Select(l => l.ItemId).ToHashSet();

            var unlistedProjects = await _context.OpenProjects
                .Where(p => p.SupervisorId == userId && !listedProjectIds.Contains(p.Id))
                .Select(p => new {
                    ItemType = "OpenProject",
                    ItemId = p.Id,
                    Title = p.Title,
                    Department = p.Department
                })
                .ToListAsync();

            var unlistedIdeas = await _context.ResearchIdeas
                .Where(i => i.CreatorId == userId && !listedIdeaIds.Contains(i.Id))
                .Select(i => new {
                    ItemType = "ResearchIdea",
                    ItemId = i.Id,
                    Title = i.Title,
                    ResearchArea = i.ResearchArea
                })
                .ToListAsync();

            return Ok(new {
                Projects = unlistedProjects,
                Ideas = unlistedIdeas
            });
        }

        // =============================================
        // MANAGE VISIBILITY LISTINGS
        // =============================================

        public class CreateListingRequest
        {
            public string ItemType { get; set; } = string.Empty; // "OpenProject" or "ResearchIdea"
            public int ItemId { get; set; }
            public string Visibility { get; set; } = "Public";
            public int? LaboratoryId { get; set; }
        }

        // POST /api/projectdiscovery/listing
        [HttpPost("listing")]
        public async Task<IActionResult> CreateListing([FromBody] CreateListingRequest req)
        {
            var validTypes = new[] { "OpenProject", "ResearchIdea" };
            if (!validTypes.Contains(req.ItemType))
                return BadRequest("ItemType must be 'OpenProject' or 'ResearchIdea'.");

            var userId = GetUserId();

            // Validate ownership
            if (req.ItemType == "OpenProject")
            {
                var proj = await _context.OpenProjects.FirstOrDefaultAsync(p => p.Id == req.ItemId);
                if (proj == null) return NotFound("Project not found.");
                if (proj.SupervisorId != userId) return Forbid();
            }
            else
            {
                var idea = await _context.ResearchIdeas.FirstOrDefaultAsync(i => i.Id == req.ItemId);
                if (idea == null) return NotFound("Research idea not found.");
                if (idea.CreatorId != userId) return Forbid();
            }

            // Check for duplicate
            var existing = await _context.ProjectDirectoryListings
                .FirstOrDefaultAsync(pdl => pdl.ItemType == req.ItemType && pdl.ItemId == req.ItemId);
            if (existing != null)
                return BadRequest("A listing for this item already exists. Use PUT to update it.");

            // Validate lab if provided
            if (req.LaboratoryId.HasValue)
            {
                var labExists = await _context.Laboratories.AnyAsync(l => l.Id == req.LaboratoryId.Value);
                if (!labExists) return NotFound("Laboratory not found.");
            }

            var listing = new ProjectDirectoryListing
            {
                ItemType = req.ItemType,
                ItemId = req.ItemId,
                Visibility = req.Visibility,
                LaboratoryId = req.LaboratoryId
            };

            _context.ProjectDirectoryListings.Add(listing);
            await _context.SaveChangesAsync();
            return StatusCode(201, listing);
        }

        public class UpdateListingRequest
        {
            public string Visibility { get; set; } = "Public";
            public int? LaboratoryId { get; set; }
        }

        // PUT /api/projectdiscovery/listing/{id}
        [HttpPut("listing/{id}")]
        public async Task<IActionResult> UpdateListing(int id, [FromBody] UpdateListingRequest req)
        {
            var listing = await _context.ProjectDirectoryListings.FindAsync(id);
            if (listing == null) return NotFound("Listing not found.");

            var userId = GetUserId();

            // Validate ownership
            if (listing.ItemType == "OpenProject")
            {
                var proj = await _context.OpenProjects.FirstOrDefaultAsync(p => p.Id == listing.ItemId);
                if (proj == null || proj.SupervisorId != userId) return Forbid();
            }
            else
            {
                var idea = await _context.ResearchIdeas.FirstOrDefaultAsync(i => i.Id == listing.ItemId);
                if (idea == null || idea.CreatorId != userId) return Forbid();
            }

            listing.Visibility = req.Visibility;
            listing.LaboratoryId = req.LaboratoryId;
            listing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(listing);
        }

        // DELETE /api/projectdiscovery/listing/{id}
        [HttpDelete("listing/{id}")]
        public async Task<IActionResult> DeleteListing(int id)
        {
            var listing = await _context.ProjectDirectoryListings.FindAsync(id);
            if (listing == null) return NotFound("Listing not found.");

            var userId = GetUserId();

            if (listing.ItemType == "OpenProject")
            {
                var proj = await _context.OpenProjects.FirstOrDefaultAsync(p => p.Id == listing.ItemId);
                if (proj == null || proj.SupervisorId != userId) return Forbid();
            }
            else
            {
                var idea = await _context.ResearchIdeas.FirstOrDefaultAsync(i => i.Id == listing.ItemId);
                if (idea == null || idea.CreatorId != userId) return Forbid();
            }

            _context.ProjectDirectoryListings.Remove(listing);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Listing removed from directory." });
        }
    }
}
