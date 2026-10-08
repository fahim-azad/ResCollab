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
    public class NotificationControllerTests
    {
        [Fact]
        public async Task MarkAsRead_ShouldReturnOk_AndSetIsReadToTrue()
        {
            // 1. Setup In-Memory Database
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_Notification_Read_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var userId = 500;
                var notificationId = 600;

                context.Users.Add(new User { Id = userId, FullName = "Test User", Email = "notif@test.com", PasswordHash = "hash" });
                context.Notifications.Add(new Notification 
                { 
                    Id = notificationId, 
                    UserId = userId, 
                    Title = "Unread Alert", 
                    Message = "Please read me", 
                    IsRead = false 
                });
                await context.SaveChangesAsync();

                var controller = new NotificationController(context);

                // 2. Mock HttpContext and User Claims
                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                // 3. Act - Mark the notification as read
                var result = await controller.MarkAsRead(notificationId);

                // 4. Assert API Response
                var okResult = Assert.IsType<OkObjectResult>(result);
                
                // 5. Assert Database State
                var notificationInDb = await context.Notifications.FindAsync(notificationId);
                
                Assert.NotNull(notificationInDb);
                Assert.True(notificationInDb.IsRead);
            }
        }
    }
}
