using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using ResCollab.Api.Services;
using System.Collections.Generic;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SearchController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        private readonly IResearchConnector _connector;

        public SearchController(ApplicationDbContext context, IResearchConnector connector)
        {
            _context = context;
            _connector = connector;
        }

        [HttpGet]
        public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] string? filter)
        {
            var results = new List<SearchResultDto>();

            // 1. Query Local Database
            var dbQuery = _context.ResearchResources
                .Include(r => r.Tags)
                .AsQueryable();

            if (!string.IsNullOrEmpty(q))
            {
                var lowerQ = q.ToLower();
                dbQuery = dbQuery.Where(r => 
                    r.Title.ToLower().Contains(lowerQ) || 
                    (r.Description != null && r.Description.ToLower().Contains(lowerQ)) ||
                    r.Tags.Any(t => t.Name.ToLower().Contains(lowerQ))
                );
            }

            if (!string.IsNullOrEmpty(filter) && filter != "All")
            {
                var lowerFilter = filter.ToLower();
                // We map frontend filters "Papers" to "Paper"
                var dbTypeFilter = lowerFilter.TrimEnd('s');
                dbQuery = dbQuery.Where(r => r.Type.ToLower() == dbTypeFilter);
            }

            var dbItems = await dbQuery.OrderByDescending(r => r.PublishedDate).Take(10).ToListAsync();

            // Map DB items to DTO
            foreach (var item in dbItems)
            {
                var dto = new SearchResultDto
                {
                    Id = item.Id.ToString(),
                    Title = item.Title,
                    Type = item.Type,
                    Description = item.Description ?? "",
                    Url = item.Url ?? "",
                    PublishedDate = item.PublishedDate,
                    Source = "Local"
                };
                dto.Tags.AddRange(item.Tags.Select(t => t.Name));
                results.Add(dto);
            }

            // 2. Query External API (Crossref)
            if (!string.IsNullOrEmpty(q) && (string.IsNullOrEmpty(filter) || filter == "All" || filter == "Papers"))
            {
                var externalResults = await _connector.SearchAsync(q, 10);
                results.AddRange(externalResults);
            }

            // Return unified result
            return Ok(results);
        }
    }
}