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
    public class DuplicateApplicationTest
    {
        [Fact]
        public async Task ApplyToProject_ShouldReturnBadRequest_IfApplicationAlreadyExists()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_DuplicateApp_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var userId = 5;
                var projectId = 10;
                
                context.Users.Add(new User { Id = userId, FullName = "Nahiyan Nower", Email = "nahiyan@test.com", PasswordHash = "hash" });
                context.OpenProjects.Add(new OpenProject { Id = projectId, Status = "Recruiting", Title = "AI Research" });
                
                context.ProjectApplications.Add(new ProjectApplication 
                { 
                    ProjectId = projectId, 
                    ApplicantId = userId, 
                    Status = "Pending",
                    CoverLetter = "My first application."
                });
                
                await context.SaveChangesAsync();

                var controller = new OpenProjectController(context);
                
                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                var request = new OpenProjectController.ApplyProjectRequest
                {
                    CoverLetter = "This is my second time applying! (This should be blocked)"
                };

                var result = await controller.ApplyToProject(projectId, request);

                var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
                Assert.Equal("You have already applied to this project.", badRequestResult.Value);
            }
        }
    }
}
