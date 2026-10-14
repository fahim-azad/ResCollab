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
    public class UniversityController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UniversityController(ApplicationDbContext context)
        {
            _context = context;
        }

        // =============================================
        // UNIVERSITY ENDPOINTS
        // =============================================

        // GET /api/university
        [HttpGet]
        public async Task<IActionResult> GetUniversities([FromQuery] string? country, [FromQuery] string? search)
        {
            var query = _context.Universities.AsQueryable();

            if (!string.IsNullOrWhiteSpace(country))
                query = query.Where(u => u.Country != null && u.Country.Contains(country));

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(u => u.Name.Contains(search));

            var result = await query
                .Where(u => u.Status == "Active")
                .OrderBy(u => u.Name)
                .Select(u => new {
                    u.Id,
                    u.Name,
                    u.Country,
                    u.City,
                    u.Website,
                    u.Description,
                    u.LogoUrl,
                    u.Status,
                    u.CreatedAt
                })
                .ToListAsync();

            return Ok(result);
        }

        // GET /api/university/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetUniversity(int id)
        {
            var university = await _context.Universities
                .Include(u => u.Departments.Where(d => d.Visibility == "Public"))
                .FirstOrDefaultAsync(u => u.Id == id);

            if (university == null) return NotFound("University not found.");

            return Ok(new {
                university.Id,
                university.Name,
                university.Country,
                university.City,
                university.Website,
                university.Description,
                university.LogoUrl,
                university.Status,
                university.CreatedAt,
                Departments = university.Departments.Select(d => new {
                    d.Id,
                    d.Name,
                    d.Description,
                    d.HeadOfDepartment,
                    d.Website,
                    d.Visibility
                })
            });
        }

        public class CreateUniversityRequest
        {
            public string Name { get; set; } = string.Empty;
            public string? Country { get; set; }
            public string? City { get; set; }
            public string? Website { get; set; }
            public string? Description { get; set; }
            public string? LogoUrl { get; set; }
        }

        // POST /api/university
        [HttpPost]
        public async Task<IActionResult> CreateUniversity([FromBody] CreateUniversityRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest("University name is required.");

            var university = new University
            {
                Name = req.Name,
                Country = req.Country,
                City = req.City,
                Website = req.Website,
                Description = req.Description,
                LogoUrl = req.LogoUrl,
                Status = "Active"
            };

            _context.Universities.Add(university);
            await _context.SaveChangesAsync();
            return StatusCode(201, university);
        }

        // PUT /api/university/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUniversity(int id, [FromBody] CreateUniversityRequest req)
        {
            var university = await _context.Universities.FindAsync(id);
            if (university == null) return NotFound("University not found.");

            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest("University name is required.");

            university.Name = req.Name;
            university.Country = req.Country;
            university.City = req.City;
            university.Website = req.Website;
            university.Description = req.Description;
            university.LogoUrl = req.LogoUrl;
            university.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(university);
        }

        // DELETE /api/university/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUniversity(int id)
        {
            var university = await _context.Universities.FindAsync(id);
            if (university == null) return NotFound("University not found.");

            // Soft delete
            university.Status = "Inactive";
            university.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "University deactivated." });
        }

        // =============================================
        // DEPARTMENT ENDPOINTS (nested under University)
        // =============================================

        // GET /api/university/{universityId}/departments
        [HttpGet("{universityId}/departments")]
        public async Task<IActionResult> GetDepartments(int universityId)
        {
            var uniExists = await _context.Universities.AnyAsync(u => u.Id == universityId);
            if (!uniExists) return NotFound("University not found.");

            var departments = await _context.Departments
                .Where(d => d.UniversityId == universityId && d.Visibility == "Public")
                .OrderBy(d => d.Name)
                .Select(d => new {
                    d.Id,
                    d.UniversityId,
                    d.Name,
                    d.Description,
                    d.HeadOfDepartment,
                    d.Website,
                    d.Visibility,
                    d.CreatedAt
                })
                .ToListAsync();

            return Ok(departments);
        }

        // GET /api/university/{universityId}/departments/{id}
        [HttpGet("{universityId}/departments/{id}")]
        public async Task<IActionResult> GetDepartment(int universityId, int id)
        {
            var dept = await _context.Departments
                .FirstOrDefaultAsync(d => d.Id == id && d.UniversityId == universityId);

            if (dept == null) return NotFound("Department not found.");
            return Ok(dept);
        }

        public class CreateDepartmentRequest
        {
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string? HeadOfDepartment { get; set; }
            public string? Website { get; set; }
            public string Visibility { get; set; } = "Public";
        }

        // POST /api/university/{universityId}/departments
        [HttpPost("{universityId}/departments")]
        public async Task<IActionResult> CreateDepartment(int universityId, [FromBody] CreateDepartmentRequest req)
        {
            var uniExists = await _context.Universities.AnyAsync(u => u.Id == universityId);
            if (!uniExists) return NotFound("University not found.");

            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest("Department name is required.");

            var duplicate = await _context.Departments
                .AnyAsync(d => d.UniversityId == universityId && d.Name == req.Name);
            if (duplicate) return BadRequest("A department with this name already exists in this university.");

            var dept = new Department
            {
                UniversityId = universityId,
                Name = req.Name,
                Description = req.Description,
                HeadOfDepartment = req.HeadOfDepartment,
                Website = req.Website,
                Visibility = req.Visibility
            };

            _context.Departments.Add(dept);
            await _context.SaveChangesAsync();
            return StatusCode(201, dept);
        }

        // PUT /api/university/{universityId}/departments/{id}
        [HttpPut("{universityId}/departments/{id}")]
        public async Task<IActionResult> UpdateDepartment(int universityId, int id, [FromBody] CreateDepartmentRequest req)
        {
            var dept = await _context.Departments
                .FirstOrDefaultAsync(d => d.Id == id && d.UniversityId == universityId);

            if (dept == null) return NotFound("Department not found.");
            if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Department name is required.");

            dept.Name = req.Name;
            dept.Description = req.Description;
            dept.HeadOfDepartment = req.HeadOfDepartment;
            dept.Website = req.Website;
            dept.Visibility = req.Visibility;
            dept.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(dept);
        }

        // DELETE /api/university/{universityId}/departments/{id}
        [HttpDelete("{universityId}/departments/{id}")]
        public async Task<IActionResult> DeleteDepartment(int universityId, int id)
        {
            var dept = await _context.Departments
                .FirstOrDefaultAsync(d => d.Id == id && d.UniversityId == universityId);

            if (dept == null) return NotFound("Department not found.");

            _context.Departments.Remove(dept);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Department deleted." });
        }
    }
}
