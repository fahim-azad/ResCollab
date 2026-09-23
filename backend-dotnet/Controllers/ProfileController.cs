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
    public class ProfileController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ProfileController(ApplicationDbContext context)
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
        public async Task<IActionResult> GetProfile()
        {
            var userId = GetUserId();
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            return Ok(new
            {
                name = user.FullName,
                role = user.Role,
                bio = user.Profile?.Bio ?? "",
                university = user.Profile?.University ?? "",
                department = user.Profile?.Department ?? "",
                country = user.Profile?.Country ?? "",
                skills = string.IsNullOrEmpty(user.Profile?.Skills) ? new string[0] : user.Profile.Skills.Split(',', System.StringSplitOptions.TrimEntries | System.StringSplitOptions.RemoveEmptyEntries),
                interests = string.IsNullOrEmpty(user.Profile?.Interests) ? new string[0] : user.Profile.Interests.Split(',', System.StringSplitOptions.TrimEntries | System.StringSplitOptions.RemoveEmptyEntries),
                publications = new object[0],
                projects = new object[0]
            });
        }

        public class UpdateProfileRequest
        {
            public string? Bio { get; set; }
            public string? University { get; set; }
            public string? Department { get; set; }
            public string? Country { get; set; }
            public string? Skills { get; set; }
            public string? Interests { get; set; }
        }

        [HttpPut]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
        {
            var userId = GetUserId();
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            if (user.Profile == null)
            {
                user.Profile = new UserProfile { UserId = user.Id };
                _context.UserProfiles.Add(user.Profile);
            }

            if (req.Bio != null) user.Profile.Bio = req.Bio;
            if (req.University != null) user.Profile.University = req.University;
            if (req.Department != null) user.Profile.Department = req.Department;
            if (req.Country != null) user.Profile.Country = req.Country;
            if (req.Skills != null) user.Profile.Skills = req.Skills;
            if (req.Interests != null) user.Profile.Interests = req.Interests;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Profile updated successfully", profile = user.Profile });
        }
    }
}