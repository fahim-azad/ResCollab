using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;

namespace ResCollab.Api.Services
{
    public class WorkspaceAccessService : IWorkspaceAccessService
    {
        private readonly ApplicationDbContext _context;

        public WorkspaceAccessService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> IsMemberAsync(int workspaceId, int userId)
        {
            var member = await _context.WorkspaceMembers
                .FirstOrDefaultAsync(wm => wm.WorkspaceId == workspaceId && wm.UserId == userId);
            
            return member != null;
        }

        public async Task<bool> IsAdminAsync(int workspaceId, int userId)
        {
            var member = await _context.WorkspaceMembers
                .FirstOrDefaultAsync(wm => wm.WorkspaceId == workspaceId && wm.UserId == userId && wm.Role == "Admin");
            
            return member != null;
        }
    }
}
