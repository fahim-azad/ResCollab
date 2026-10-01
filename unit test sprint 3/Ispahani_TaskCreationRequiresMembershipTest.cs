using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using System.Threading.Tasks;
using Xunit;
using Moq;
using ResCollab.Api.Controllers;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using ResCollab.Api.Services;

namespace ResCollab.Tests.Sprint3
{
    public class TaskCreationRequiresMembershipTest
    {
        [Fact]
        public async Task CreateTask_ShouldReturnForbid_IfUserIsNotMember()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_TaskCreation_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var workspaceId = 1;
                var nonMemberId = 99;

                var mockAccessService = new Mock<IWorkspaceAccessService>();
                mockAccessService.Setup(x => x.IsMemberAsync(workspaceId, nonMemberId)).ReturnsAsync(false);

                var controller = new TaskController(context, mockAccessService.Object);

                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, nonMemberId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                var request = new TaskController.CreateTaskRequest
                {
                    Title = "Sneaky Task"
                };

                var result = await controller.CreateTask(workspaceId, request);

                Assert.IsType<ForbidResult>(result);
            }
        }
    }
}
