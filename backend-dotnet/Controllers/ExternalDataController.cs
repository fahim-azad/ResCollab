using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResCollab.Api.Models;
using ResCollab.Api.Services;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [Route("api/external-data")]
    [Route("api/ingestion")]
    [ApiController]
    [Authorize]
    public class ExternalDataController : ControllerBase
    {
        private readonly IExternalCollectionService _collectionService;

        public ExternalDataController(IExternalCollectionService collectionService)
        {
            _collectionService = collectionService;
        }

        private string GetCurrentUserRole()
        {
            return User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
        }

        private bool IsAdminOrStaff()
        {
            var role = GetCurrentUserRole();
            return role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                   role.Equals("Moderator", StringComparison.OrdinalIgnoreCase) ||
                   role.Equals("InstitutionalAdmin", StringComparison.OrdinalIgnoreCase);
        }

        // =========================================================================
        // 1. CONFIGURED REPOSITORIES & SOURCES
        // GET /api/external-data/sources
        // =========================================================================
        [HttpGet("sources")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSources()
        {
            var sources = await _collectionService.GetConfiguredSourcesAsync();
            return Ok(sources);
        }

        [HttpGet("sources/{id:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSourceById(int id)
        {
            var source = await _collectionService.GetSourceByIdAsync(id);
            if (source == null)
            {
                return NotFound(new { message = $"External source with ID {id} was not found." });
            }
            return Ok(source);
        }

        [HttpGet("sources/status")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSourcesStatus()
        {
            var summaries = await _collectionService.GetSourcesStatusAsync();
            return Ok(summaries);
        }

        // =========================================================================
        // 2. UPDATE SOURCE CONFIG (ADMIN ONLY)
        // PUT /api/external-data/sources/{id}
        // =========================================================================
        [HttpPut("sources/{id:int}")]
        public async Task<IActionResult> UpdateSourceConfig(int id, [FromBody] ExternalDataSource updated)
        {
            if (!IsAdminOrStaff())
            {
                return Forbid();
            }

            try
            {
                var result = await _collectionService.UpdateSourceConfigAsync(id, updated);
                return Ok(result);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = $"External source with ID {id} not found." });
            }
        }

        // =========================================================================
        // 3. TRIGGER COLLECTION RUN
        // POST /api/external-data/harvest
        // POST /api/external-data/trigger
        // =========================================================================
        [HttpPost("harvest")]
        [HttpPost("trigger")]
        public async Task<IActionResult> TriggerHarvest([FromBody] TriggerIngestionDto req)
        {
            if (string.IsNullOrWhiteSpace(req.SourceKey))
            {
                return BadRequest(new { message = "SourceKey is required (e.g., 'ARXIV', 'CROSSREF', 'OPENALEX')." });
            }

            try
            {
                var jobLog = await _collectionService.RunCollectionJobAsync(
                    req.SourceKey,
                    req.QueryKeyword,
                    req.MaxRecords > 0 ? req.MaxRecords : 30);

                return Ok(jobLog);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Data collection encountered an unexpected error.", error = ex.Message });
            }
        }

        // =========================================================================
        // 4. INGESTION JOB LOGS & AUDIT
        // GET /api/external-data/jobs?sourceId=1&limit=20
        // =========================================================================
        [HttpGet("jobs")]
        public async Task<IActionResult> GetJobLogs([FromQuery] int? sourceId = null, [FromQuery] int limit = 20)
        {
            var logs = await _collectionService.GetJobLogsAsync(sourceId, limit);
            return Ok(logs);
        }

        [HttpGet("jobs/{id:int}")]
        public async Task<IActionResult> GetJobLogById(int id)
        {
            var job = await _collectionService.GetJobLogByIdAsync(id);
            if (job == null)
            {
                return NotFound(new { message = $"Job log with ID {id} was not found." });
            }
            return Ok(job);
        }

        // =========================================================================
        // 5. SEARCH & RETRIEVE INGESTED RESEARCH RECORDS
        // GET /api/external-data/records?sourceKey=ARXIV&status=Normalized&search=transformer&page=1&pageSize=20
        // =========================================================================
        [HttpGet("records")]
        [AllowAnonymous]
        public async Task<IActionResult> GetIngestedRecords(
            [FromQuery] string? sourceKey = null,
            [FromQuery] string? status = null,
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _collectionService.GetIngestedRecordsAsync(sourceKey, status, search, page, pageSize);
            return Ok(result);
        }
    }
}
