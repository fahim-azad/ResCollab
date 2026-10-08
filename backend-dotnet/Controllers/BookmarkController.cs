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
    public class BookmarkController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public BookmarkController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        [HttpGet]
        public async Task<IActionResult> GetBookmarks([FromQuery] string? itemType)
        {
            var userId = GetUserId();
            var query = _context.Bookmarks.Where(b => b.UserId == userId);
            
            if (!string.IsNullOrEmpty(itemType))
            {
                query = query.Where(b => b.ItemType == itemType);
            }

            var bookmarks = await query.OrderByDescending(b => b.CreatedAt).ToListAsync();
            
            var result = new System.Collections.Generic.List<object>();
            foreach(var b in bookmarks) {
                string title = "Unknown Item";
                string subtitle = "";
                
                if (b.ItemType == "Project") {
                    var proj = await _context.OpenProjects.FindAsync(b.ItemId);
                    if (proj != null) {
                        title = proj.Title;
                        subtitle = proj.Department ?? "General";
                    }
                } else if (b.ItemType == "Idea") {
                    var idea = await _context.ResearchIdeas.FindAsync(b.ItemId);
                    if (idea != null) {
                        title = idea.Title;
                        subtitle = idea.ResearchArea ?? "General";
                    }
                }

                result.Add(new {
                    b.Id,
                    b.ItemType,
                    b.ItemId,
                    b.CreatedAt,
                    ItemTitle = title,
                    ItemSubtitle = subtitle
                });
            }

            return Ok(result);
        }

        public class CreateBookmarkRequest
        {
            public string ItemType { get; set; } = string.Empty;
            public int ItemId { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> AddBookmark([FromBody] CreateBookmarkRequest req)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(req.ItemType)) return BadRequest("ItemType is required");

            var exists = await _context.Bookmarks
                .AnyAsync(b => b.UserId == userId && b.ItemType == req.ItemType && b.ItemId == req.ItemId);
            
            if (exists) return BadRequest("Bookmark already exists.");

            var bookmark = new Bookmark
            {
                UserId = userId,
                ItemType = req.ItemType,
                ItemId = req.ItemId,
                CreatedAt = System.DateTime.UtcNow
            };

            _context.Bookmarks.Add(bookmark);
            await _context.SaveChangesAsync();

            return StatusCode(201, bookmark);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> RemoveBookmark(int id)
        {
            var userId = GetUserId();
            var bookmark = await _context.Bookmarks.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
            
            if (bookmark == null) return NotFound("Bookmark not found");

            _context.Bookmarks.Remove(bookmark);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Bookmark removed" });
        }

        [HttpDelete("item/{itemType}/{itemId}")]
        public async Task<IActionResult> RemoveBookmarkByItem(string itemType, int itemId)
        {
            var userId = GetUserId();
            var bookmark = await _context.Bookmarks
                .FirstOrDefaultAsync(b => b.UserId == userId && b.ItemType == itemType && b.ItemId == itemId);
            
            if (bookmark == null) return NotFound("Bookmark not found");

            _context.Bookmarks.Remove(bookmark);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Bookmark removed" });
        }

        [HttpGet("check/{itemType}/{itemId}")]
        public async Task<IActionResult> CheckBookmark(string itemType, int itemId)
        {
            var userId = GetUserId();
            var exists = await _context.Bookmarks
                .AnyAsync(b => b.UserId == userId && b.ItemType == itemType && b.ItemId == itemId);
            
            return Ok(new { isBookmarked = exists });
        }
    }
}
