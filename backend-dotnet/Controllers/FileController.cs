using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using ResCollab.Api.Services;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace ResCollab.Api.Controllers
{
    [Route("api/workspaces/{workspaceId}/files")]
    [ApiController]
    [Authorize]
    public class FileController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWorkspaceAccessService _accessService;

        public FileController(ApplicationDbContext context, IWorkspaceAccessService accessService)
        {
            _context = context;
            _accessService = accessService;
        }

        [HttpGet]
        public async Task<IActionResult> GetFiles(int workspaceId)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            var files = await _context.WorkspaceFiles
                .Include(f => f.UploadedBy)
                .Where(f => f.WorkspaceId == workspaceId)
                .OrderByDescending(f => f.UploadedAt)
                .Select(f => new {
                    f.Id,
                    f.FileName,
                    f.FileUrl,
                    f.FileSizeBytes,
                    f.UploadedAt,
                    UploadedByName = f.UploadedBy != null ? f.UploadedBy.FullName : "Unknown"
                })
                .ToListAsync();

            return Ok(files);
        }

        [HttpPost]
        public async Task<IActionResult> UploadFile(int workspaceId, IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("File is empty");

            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            if (!await _accessService.IsMemberAsync(workspaceId, userId)) return Forbid();

            // Simulate file storage path (e.g. AWS S3 or Local Uploads)
            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
            var fileUrl = $"/uploads/{workspaceId}/{fileName}"; 
            
            // Mocking the physical file write to disk. 
            // In a real application, this is where we'd write to an object store or local disk.

            var workspaceFile = new WorkspaceFile
            {
                WorkspaceId = workspaceId,
                FileName = file.FileName,
                FileUrl = fileUrl,
                FileSizeBytes = file.Length,
                UploadedById = userId,
                UploadedAt = DateTime.UtcNow
            };

            _context.WorkspaceFiles.Add(workspaceFile);
            await _context.SaveChangesAsync();

            return StatusCode(201, workspaceFile);
        }
    }
}
