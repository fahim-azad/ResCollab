using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using System.Threading.Tasks;
using Xunit;
using ResCollab.Api.Controllers;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Tests.Sprint3
{
    public class PreventNonOwnerReviewTest
    {
        [Fact]
        public async Task ReviewApplication_ShouldReturnForbid_IfNotProjectOwner()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_NonOwnerReview_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var ownerId = 1;
                var nonOwnerId = 2;
                var projectId = 100;
                var appId = 500;

                context.OpenProjects.Add(new OpenProject { Id = projectId, SupervisorId = ownerId, Status = "Recruiting", Title = "AI Lab" });
                context.ProjectApplications.Add(new ProjectApplication { Id = appId, ProjectId = projectId, ApplicantId = 3, Status = "Pending" });
                await context.SaveChangesAsync();

                var controller = new OpenProjectController(context);

                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, nonOwnerId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                var request = new OpenProjectController.ReviewApplicationRequest { Status = "Accepted" };

                var result = await controller.ReviewApplication(projectId, appId, request);

                Assert.IsType<ForbidResult>(result);
            }
        }
    }
}
