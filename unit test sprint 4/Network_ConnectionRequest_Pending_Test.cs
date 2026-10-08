using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using System.Threading.Tasks;
using Xunit;
using ResCollab.Api.Controllers;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Tests.Sprint4
{
    public class NetworkControllerTests
    {
        [Fact]
        public async Task SendConnectionRequest_ShouldReturnOk_AndCreatePendingConnection()
        {
            // 1. Setup In-Memory Database
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_Network_Connect_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var requesterId = 300;
                var targetId = 400;

                context.Users.Add(new User { Id = requesterId, FullName = "Requester User", Email = "req@test.com", PasswordHash = "hash" });
                context.Users.Add(new User { Id = targetId, FullName = "Target User", Email = "target@test.com", PasswordHash = "hash" });
                await context.SaveChangesAsync();

                var controller = new NetworkController(context);

                // 2. Mock HttpContext and User Claims for the Requester
                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, requesterId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                // 3. Act - Send connection request to the Target User
                var result = await controller.SendConnectionRequest(targetId);

                // 4. Assert API Response
                var okResult = Assert.IsType<OkObjectResult>(result);
                
                // 5. Assert Database State
                var connectionInDb = await context.UserConnections
                    .FirstOrDefaultAsync(c => c.RequesterId == requesterId && c.TargetId == targetId);
                
                Assert.NotNull(connectionInDb);
                Assert.Equal("Pending", connectionInDb.Status);
                Assert.Equal(requesterId, connectionInDb.RequesterId);
                Assert.Equal(targetId, connectionInDb.TargetId);
            }
        }
    }
}
