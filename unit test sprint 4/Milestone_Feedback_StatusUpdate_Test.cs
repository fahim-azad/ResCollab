using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using System.Threading.Tasks;
using Xunit;
using ResCollab.Api.Controllers;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using ResCollab.Api.Services;

namespace ResCollab.Tests.Sprint4
{
    public class MilestoneFeedbackControllerTests
    {
        [Fact]
        public async Task AddMilestoneFeedback_ShouldUpdateTaskStatus_IfStatusChangeProvided()
        {
            // 1. Setup In-Memory Database
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_Feedback_Status_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var userId = 700;
                var workspaceId = 800;
                var taskId = 900;

                // Seed data including Workspace Access
                context.Users.Add(new User { Id = userId, FullName = "Feedback User", Email = "fb@test.com", PasswordHash = "hash" });
                context.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = workspaceId, UserId = userId, Role = "Member" });
                context.WorkspaceTasks.Add(new WorkspaceTask 
                { 
                    Id = taskId, 
                    WorkspaceId = workspaceId, 
                    Title = "Milestone Task", 
                    Status = "Todo",
                    IsMilestone = true 
                });
                await context.SaveChangesAsync();

                // 2. Instantiate Controller with Real Access Service
                var accessService = new WorkspaceAccessService(context);
                var controller = new TaskController(context, accessService);

                // 3. Mock HttpContext and User Claims
                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                // 4. Act - Submit Feedback with a Status Change
                var request = new TaskController.CreateFeedbackRequest
                {
                    Content = "Great progress!",
                    StatusChange = "In Progress"
                };
                var result = await controller.AddMilestoneFeedback(workspaceId, taskId, request);

                // 5. Assert API Response
                var createdResult = Assert.IsType<ObjectResult>(result);
                Assert.Equal(201, createdResult.StatusCode);

                // 6. Assert Database State - Verify Feedback inserted
                var feedbackInDb = await context.MilestoneFeedbacks.FirstOrDefaultAsync(f => f.WorkspaceTaskId == taskId);
                Assert.NotNull(feedbackInDb);
                Assert.Equal("In Progress", feedbackInDb.StatusChange);

                // 7. Assert Database State - Verify underlying Task status was automatically updated
                var taskInDb = await context.WorkspaceTasks.FindAsync(taskId);
                Assert.NotNull(taskInDb);
                Assert.Equal("In Progress", taskInDb.Status);
            }
        }
    }
}
