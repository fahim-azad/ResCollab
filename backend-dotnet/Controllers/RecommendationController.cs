using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResCollab.Api.Models;
using ResCollab.Api.Services;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RecommendationController : ControllerBase
    {
        private readonly IAiMatchingService _matchingService;

        public RecommendationController(IAiMatchingService matchingService)
        {
            _matchingService = matchingService;
        }

        private int GetCurrentUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        // =========================================================================
        // 1. ALL RECOMMENDATIONS (UNIFIED HUB)
        // GET /api/recommendation/all?forceRefresh=false
        // =========================================================================
        [HttpGet("all")]
        public async Task<IActionResult> GetAllRecommendations([FromQuery] bool forceRefresh = false)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var result = await _matchingService.GetAllRecommendationsAsync(userId, forceRefresh);
            return Ok(result);
        }

        // =========================================================================
        // 2. SUPERVISOR RECOMMENDATIONS
        // GET /api/recommendation/supervisors
        // =========================================================================
        [HttpGet("supervisors")]
        public async Task<IActionResult> GetSupervisors()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var supervisors = await _matchingService.GetSupervisorRecommendationsAsync(userId);
            return Ok(supervisors);
        }

        // =========================================================================
        // 3. TEAMMATE RECOMMENDATIONS
        // GET /api/recommendation/teammates
        // =========================================================================
        [HttpGet("teammates")]
        public async Task<IActionResult> GetTeammates()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var teammates = await _matchingService.GetTeammateRecommendationsAsync(userId);
            return Ok(teammates);
        }

        // =========================================================================
        // 4. RESEARCHER / COLLABORATOR RECOMMENDATIONS
        // GET /api/recommendation/researchers
        // =========================================================================
        [HttpGet("researchers")]
        public async Task<IActionResult> GetResearchers()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var researchers = await _matchingService.GetResearcherRecommendationsAsync(userId);
            return Ok(researchers);
        }

        // =========================================================================
        // 5. PUBLICATION & PAPER RECOMMENDATIONS
        // GET /api/recommendation/papers
        // =========================================================================
        [HttpGet("papers")]
        public async Task<IActionResult> GetPapers()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var papers = await _matchingService.GetPaperRecommendationsAsync(userId);
            return Ok(papers);
        }

        // =========================================================================
        // 6. OPEN PROJECT RECOMMENDATIONS
        // GET /api/recommendation/projects
        // =========================================================================
        [HttpGet("projects")]
        public async Task<IActionResult> GetProjects()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var projects = await _matchingService.GetProjectRecommendationsAsync(userId);
            return Ok(projects);
        }

        // =========================================================================
        // 7. SKILL GAP ANALYSIS
        // GET /api/recommendation/skill-gap?targetDomain=AI&targetProjectId=1
        // =========================================================================
        [HttpGet("skill-gap")]
        public async Task<IActionResult> GetSkillGapAnalysis(
            [FromQuery] string? targetDomain = null,
            [FromQuery] int? targetProjectId = null)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var analysis = await _matchingService.AnalyzeSkillGapAsync(userId, targetDomain, targetProjectId);
            return Ok(analysis);
        }

        // =========================================================================
        // 8. USER RECOMMENDATION PREFERENCES
        // GET /api/recommendation/preferences
        // PUT /api/recommendation/preferences
        // =========================================================================
        [HttpGet("preferences")]
        public async Task<IActionResult> GetPreferences()
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var prefs = await _matchingService.GetUserPreferencesAsync(userId);
            return Ok(prefs);
        }

        [HttpPut("preferences")]
        public async Task<IActionResult> UpdatePreferences([FromBody] RecommendationPreference updated)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var saved = await _matchingService.UpdateUserPreferencesAsync(userId, updated);
            return Ok(saved);
        }

        // =========================================================================
        // 9. DISMISS RECOMMENDATION
        // POST /api/recommendation/{id}/dismiss
        // =========================================================================
        [HttpPost("{id}/dismiss")]
        public async Task<IActionResult> DismissRecommendation(int id)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return Unauthorized();

            var success = await _matchingService.DismissRecommendationAsync(userId, id);
            return Ok(new { success, message = "Recommendation dismissed." });
        }
    }
}
