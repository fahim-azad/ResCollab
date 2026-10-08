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
    public class BookmarkControllerTests
    {
        [Fact]
        public async Task AddBookmark_ShouldReturn201Created_AndSaveToDatabase()
        {
            // 1. Setup In-Memory Database
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: "Test_Bookmark_Add_DB")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var userId = 100;
                var ideaId = 200;

                context.Users.Add(new User { Id = userId, FullName = "Test User", Email = "test@test.com", PasswordHash = "hash" });
                context.ResearchIdeas.Add(new ResearchIdea { Id = ideaId, Title = "Cool Idea" });
                await context.SaveChangesAsync();

                var controller = new BookmarkController(context);

                // 2. Mock HttpContext and User Claims
                var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = user }
                };

                // 3. Construct Request
                var request = new BookmarkController.CreateBookmarkRequest
                {
                    ItemType = "Idea",
                    ItemId = ideaId
                };

                // 4. Act
                var result = await controller.AddBookmark(request);

                // 5. Assert API Response
                var createdResult = Assert.IsType<ObjectResult>(result);
                Assert.Equal(201, createdResult.StatusCode);

                // 6. Assert Database State
                var bookmarkInDb = await context.Bookmarks
                    .FirstOrDefaultAsync(b => b.UserId == userId && b.ItemType == "Idea" && b.ItemId == ideaId);
                
                Assert.NotNull(bookmarkInDb);
                Assert.Equal("Idea", bookmarkInDb.ItemType);
                Assert.Equal(ideaId, bookmarkInDb.ItemId);
            }
        }
    }
}
