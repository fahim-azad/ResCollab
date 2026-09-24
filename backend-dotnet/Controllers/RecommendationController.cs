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
    public class RecommendationController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public RecommendationController(ApplicationDbContext context)
        {
            _context = context;
        }

        public class SupervisorRecommendationDto
        {
            public int UserId { get; set; }
            public string FullName { get; set; } = string.Empty;
            public string? Department { get; set; }
            public string? University { get; set; }
            public List<string> MatchedInterests { get; set; } = new List<string>();
            public int MatchScore { get; set; }
            public string? Bio { get; set; }
        }

        [HttpGet("supervisors")]
        public async Task<IActionResult> GetSupervisors()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var studentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (studentUser == null || studentUser.Profile == null)
            {
                return NotFound("Student profile not found.");
            }

            var studentProfile = studentUser.Profile;

            // Fetch all supervisors that are accepting students
            var supervisors = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != userId && (u.Role == "Supervisor" || u.Role == "Faculty"))
                .Where(u => u.Profile != null && u.Profile.IsAcceptingStudents)
                .ToListAsync();

            var recommendations = new List<SupervisorRecommendationDto>();

            var studentInterests = string.IsNullOrWhiteSpace(studentProfile.Interests) 
                ? new List<string>() 
                : studentProfile.Interests.Split(',').Select(i => i.Trim().ToLower()).ToList();

            foreach (var sup in supervisors)
            {
                var supProfile = sup.Profile!;
                int score = 0;
                var matchedInterests = new List<string>();

                // Rule 1: Interests match (+10 points per keyword)
                if (!string.IsNullOrWhiteSpace(supProfile.Interests))
                {
                    var supInterests = supProfile.Interests.Split(',').Select(i => i.Trim().ToLower()).ToList();
                    foreach (var sInt in studentInterests)
                    {
                        if (supInterests.Contains(sInt) && !string.IsNullOrWhiteSpace(sInt))
                        {
                            score += 10;
                            matchedInterests.Add(sInt);
                        }
                    }
                }

                // Rule 2: Department match (+5 points)
                if (!string.IsNullOrWhiteSpace(studentProfile.Department) && 
                    studentProfile.Department.Equals(supProfile.Department, StringComparison.OrdinalIgnoreCase))
                {
                    score += 5;
                }

                // Rule 3: University match (+2 points)
                if (!string.IsNullOrWhiteSpace(studentProfile.University) && 
                    studentProfile.University.Equals(supProfile.University, StringComparison.OrdinalIgnoreCase))
                {
                    score += 2;
                }

                recommendations.Add(new SupervisorRecommendationDto
                {
                    UserId = sup.Id,
                    FullName = sup.FullName,
                    Department = supProfile.Department,
                    University = supProfile.University,
                    MatchedInterests = matchedInterests,
                    MatchScore = score,
                    Bio = supProfile.Bio
                });
            }

            // Sort by highest score first
            var sortedRecommendations = recommendations.OrderByDescending(r => r.MatchScore).ToList();
            
            // Filter to only those with Score > 0 for better relevance
            var filtered = sortedRecommendations.Where(r => r.MatchScore > 0).ToList();

            // If empty (e.g. blank student profile or zero matches), return up to 10 fallback supervisors
            if (!filtered.Any())
            {
                filtered = sortedRecommendations.Take(10).ToList();
            }

            return Ok(filtered);
        }

        
    }
}
