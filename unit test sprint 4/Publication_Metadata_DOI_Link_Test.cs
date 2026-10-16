using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Controllers;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using Xunit;

namespace ResCollab.Tests.Sprint4
{
    public class PublicationMetadataDoiLinkTests
    {
        [Theory]
        [InlineData("10.1109/TSE.2024.1234567", "10.1109/TSE.2024.1234567")]
        [InlineData("https://doi.org/10.1109/TSE.2024.1234567", "10.1109/TSE.2024.1234567")]
        [InlineData("http://doi.org/10.1145/3377811.3380387", "10.1145/3377811.3380387")]
        [InlineData("https://dx.doi.org/10.1007/978-3-030-85529-1_1", "10.1007/978-3-030-85529-1_1")]
        [InlineData("doi:10.1038/s41586-020-2649-2", "10.1038/s41586-020-2649-2")]
        [InlineData("  10.1234/test/doi  ", "10.1234/test/doi")]
        public void NormalizeDoi_ShouldExtractStandardDoi(string rawInput, string expectedNormalized)
        {
            var normalized = PublicationController.NormalizeDoi(rawInput);
            Assert.Equal(expectedNormalized, normalized);
        }

        [Fact]
        public void NormalizeDoi_WithNullOrWhitespace_ShouldReturnNull()
        {
            Assert.Null(PublicationController.NormalizeDoi(null));
            Assert.Null(PublicationController.NormalizeDoi("   "));
        }

        [Theory]
        [InlineData("arxiv.org/abs/2401.12345", "https://arxiv.org/abs/2401.12345")]
        [InlineData("https://ieeexplore.ieee.org/document/12345", "https://ieeexplore.ieee.org/document/12345")]
        [InlineData("http://example.com/paper.pdf", "http://example.com/paper.pdf")]
        public void NormalizeSourceLink_ShouldEnsureValidScheme(string input, string expected)
        {
            var result = PublicationController.NormalizeSourceLink(input);
            Assert.Equal(expected, result);
        }

        [Fact]
        public void ValidatePublicationRequest_ShouldReject_WhenNoIdentifyingMetadataProvided()
        {
            var req = new PublicationController.PublicationRequest
            {
                Title = "Research Paper Title",
                Authors = "John Doe, Jane Smith",
                PublicationYear = 2024,
                DOI = null,
                JournalOrConference = null,
                SourceLink = null
            };

            var error = PublicationController.ValidatePublicationRequest(req);
            Assert.NotNull(error);
            Assert.Contains("At least one of DOI, Journal/Conference, or Source Link must be provided", error);
        }

        [Theory]
        [InlineData("invalid-doi-format")]
        [InlineData("10.withoutslash")]
        [InlineData("https://not-doi.org/test")]
        public void ValidatePublicationRequest_ShouldReject_InvalidDoi(string badDoi)
        {
            var req = new PublicationController.PublicationRequest
            {
                Title = "Valid Title",
                Authors = "Author Name",
                PublicationYear = 2024,
                DOI = badDoi
            };

            var error = PublicationController.ValidatePublicationRequest(req);
            Assert.NotNull(error);
            Assert.Contains("DOI format appears invalid", error);
        }

        [Theory]
        [InlineData(1899)]
        [InlineData(2099)]
        public void ValidatePublicationRequest_ShouldReject_InvalidYear(int invalidYear)
        {
            var req = new PublicationController.PublicationRequest
            {
                Title = "Valid Title",
                Authors = "Author Name",
                PublicationYear = invalidYear,
                JournalOrConference = "IEEE Software"
            };

            var error = PublicationController.ValidatePublicationRequest(req);
            Assert.NotNull(error);
            Assert.Contains("Publication year must be between", error);
        }

        [Fact]
        public async Task CreatePublication_ShouldStoreNormalizedDoiAndLink_AndReturn201Created()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: $"Test_Pub_Metadata_{Guid.NewGuid()}")
                .Options;

            using (var context = new ApplicationDbContext(options))
            {
                var userId = 501;
                context.Users.Add(new User { Id = userId, FullName = "Dr. Alice", Email = "alice@uni.edu", PasswordHash = "hash" });
                await context.SaveChangesAsync();

                var controller = new PublicationController(context);
                var userClaims = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                }, "mock"));

                controller.ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = userClaims }
                };

                var req = new PublicationController.PublicationRequest
                {
                    Title = "Machine Learning in Distributed Systems",
                    Authors = "Alice Smith, Bob Jones",
                    PublicationYear = 2024,
                    PublicationType = "Journal",
                    JournalOrConference = "ACM Transactions on Computer Systems",
                    DOI = "https://doi.org/10.1145/3377811.3380387",
                    SourceLink = "arxiv.org/abs/2401.99999",
                    Visibility = "Public"
                };

                var response = await controller.CreatePublication(req);
                var createdResult = Assert.IsType<ObjectResult>(response);
                Assert.Equal(201, createdResult.StatusCode);

                var createdPub = Assert.IsType<Publication>(createdResult.Value);
                Assert.Equal("10.1145/3377811.3380387", createdPub.DOI);
                Assert.Equal("https://arxiv.org/abs/2401.99999", createdPub.SourceLink);
                Assert.Equal(2024, createdPub.PublicationYear);
                Assert.Equal("ACM Transactions on Computer Systems", createdPub.JournalOrConference);

                // Verify persistence in DB
                var inDb = await context.Publications.FirstOrDefaultAsync(p => p.Id == createdPub.Id);
                Assert.NotNull(inDb);
                Assert.Equal("10.1145/3377811.3380387", inDb.DOI);
            }
        }
    }
}
