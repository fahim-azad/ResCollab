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
    public class WorkspaceTaskControllerTests
    {
        [Fact]
        public async Task CreateTask_WithIsMilestoneTrue_ShouldSaveAsMilestone()
        {
            // 1. Setup In-Memory Database
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_Create_Milestone_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var userId = 1000;
                var workspaceId = 1100;

                // Seed data including Workspace Access
                context.Users.Add(new User { Id = userId, FullName = "Creator User", Email = "create@test.com", PasswordHash = "hash" });
                context.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = workspaceId, UserId = userId, Role = "Member" });
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

                // 4. Act - Create a new Milestone Task
                var request = new TaskController.CreateTaskRequest
                {
                    Title = "Major Release",
                    Description = "V1 of the product",
                    IsMilestone = true
                };
                
                var result = await controller.CreateTask(workspaceId, request);

                // 5. Assert API Response
                var createdResult = Assert.IsType<ObjectResult>(result);
                Assert.Equal(201, createdResult.StatusCode);

                // 6. Assert Database State
                var savedTask = await context.WorkspaceTasks.FirstOrDefaultAsync(t => t.WorkspaceId == workspaceId);
                
                Assert.NotNull(savedTask);
                Assert.Equal("Major Release", savedTask.Title);
                Assert.True(savedTask.IsMilestone);
                Assert.Equal("Todo", savedTask.Status); // Default status
            }
        }
    }
}
