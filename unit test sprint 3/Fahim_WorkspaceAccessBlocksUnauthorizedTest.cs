using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;
using Xunit;
using ResCollab.Api.Services;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Tests.Sprint3
{
    public class WorkspaceAccessBlocksUnauthorizedTest
    {
        [Fact]
        public async Task IsMemberAsync_ShouldReturnFalse_IfUserIsNotInWorkspace()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_AccessControl_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var workspaceId = 1;
                var memberId = 10;
                var nonMemberId = 20;

                context.Workspaces.Add(new Workspace { Id = workspaceId, Name = "Research Hub" });
                context.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = workspaceId, UserId = memberId, Role = "Member" });
                await context.SaveChangesAsync();

                var service = new WorkspaceAccessService(context);

                var result = await service.IsMemberAsync(workspaceId, nonMemberId);

                Assert.False(result);
            }
        }
    }
}
