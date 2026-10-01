using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Controllers;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using System.Security.Claims;

namespace ResCollab.Tests
{
    public class Extra_PreventDuplicateWorkspaceMemberTest
    {
        [Fact]
        public async Task AddMember_ShouldReturnBadRequest_IfAlreadyMember()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_Extra_DuplicateMember_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var adminId = 1;
                var workspaceId = 10;
                var existingMemberId = 2;

                context.Users.Add(new User { Id = adminId, FullName = "Admin", Email = "admin@test.com", Role = "Faculty", PasswordHash = "hash" });
                context.Users.Add(new User { Id = existingMemberId, FullName = "Member", Email = "member@test.com", Role = "Student", PasswordHash = "hash" });
                context.Workspaces.Add(new Workspace { Id = workspaceId, Name = "Lab" });
                context.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = workspaceId, UserId = adminId, Role = "Admin" });
                context.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = workspaceId, UserId = existingMemberId, Role = "Member" });
                await context.SaveChangesAsync();

                var controller = new WorkspaceController(context);

                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, adminId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                var request = new WorkspaceController.AddMemberRequest { UserId = existingMemberId };
                var result = await controller.AddMember(workspaceId, request);

                var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
                Assert.Equal("User is already a member of this workspace.", badRequestResult.Value);
            }
        }
    }
}
