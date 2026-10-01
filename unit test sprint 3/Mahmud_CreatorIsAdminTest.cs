using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Linq;
using Xunit;
using ResCollab.Api.Controllers;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Tests.Sprint3
{
    public class CreatorIsAdminTest
    {
        [Fact]
        public async Task CreateWorkspace_ShouldMakeCreatorAdmin()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_WorkspaceCreator_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var creatorId = 77;
                
                context.Users.Add(new User { Id = creatorId, FullName = "Mahmud hasan", Email = "mahmud@test.com", PasswordHash = "hash" });
                await context.SaveChangesAsync();

                var controller = new WorkspaceController(context);

                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, creatorId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                var request = new WorkspaceController.CreateWorkspaceRequest { Name = "New Lab", Description = "Testing" };

                var result = await controller.CreateWorkspace(request);

                var objectResult = Assert.IsType<ObjectResult>(result);
                Assert.Equal(201, objectResult.StatusCode);

                var workspace = await context.Workspaces.FirstOrDefaultAsync();
                Assert.NotNull(workspace);

                var member = await context.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == workspace.Id);
                Assert.NotNull(member);
                Assert.Equal(creatorId, member.UserId);
                Assert.Equal("Admin", member.Role);
            }
        }
    }
}
