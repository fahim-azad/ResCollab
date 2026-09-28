using System.Threading.Tasks;

namespace ResCollab.Api.Services
{
    public interface IWorkspaceAccessService
    {
        Task<bool> IsMemberAsync(int workspaceId, int userId);
        Task<bool> IsAdminAsync(int workspaceId, int userId);
    }
}
