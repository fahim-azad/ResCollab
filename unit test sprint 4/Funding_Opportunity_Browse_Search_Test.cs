using System;
using System.Collections.Generic;
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
    public class FundingOpportunityBrowseSearchTests
    {
        private ApplicationDbContext CreateInMemoryContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .Options;

            return new ApplicationDbContext(options);
        }

        private FundingController CreateControllerWithUser(ApplicationDbContext context, int userId)
        {
            var controller = new FundingController(context);
            var userClaims = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString())
            }, "mock"));

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = userClaims }
            };

            return controller;
        }

        [Fact]
        public async Task GetOpportunities_ShouldFilterByStatusAndFundingType()
        {
            var dbName = $"Test_Funding_Browse_{Guid.NewGuid()}";
            using (var context = CreateInMemoryContext(dbName))
            {
                context.FundingOpportunities.AddRange(
                    new FundingOpportunity
                    {
                        Title = "NSF AI Institute Grant",
                        Provider = "NSF",
                        FundingType = "Grant",
                        Status = "Open",
                        ResearchArea = "Artificial Intelligence"
                    },
                    new FundingOpportunity
                    {
                        Title = "Google PhD Fellowship",
                        Provider = "Google",
                        FundingType = "Fellowship",
                        Status = "Open",
                        ResearchArea = "Machine Learning"
                    },
                    new FundingOpportunity
                    {
                        Title = "Closed Travel Award",
                        Provider = "ACM",
                        FundingType = "Award",
                        Status = "Closed",
                        ResearchArea = "Computer Science"
                    }
                );
                await context.SaveChangesAsync();

                var controller = CreateControllerWithUser(context, 1);

                // 1. Filter by FundingType = Grant
                var resultGrant = await controller.GetOpportunities("Grant", null, "Open", null);
                var okResultGrant = Assert.IsType<OkObjectResult>(resultGrant);
                var listGrant = Assert.IsAssignableFrom<System.Collections.IEnumerable>(okResultGrant.Value);
                var countGrant = 0;
                foreach (var item in listGrant) countGrant++;
                Assert.Equal(1, countGrant);

                // 2. Filter with status = All
                var resultAll = await controller.GetOpportunities(null, null, "All", null);
                var okResultAll = Assert.IsType<OkObjectResult>(resultAll);
                var listAll = Assert.IsAssignableFrom<System.Collections.IEnumerable>(okResultAll.Value);
                var countAll = 0;
                foreach (var item in listAll) countAll++;
                Assert.Equal(3, countAll);
            }
        }

        [Fact]
        public async Task GetOpportunities_ShouldFilterBySearchKeyword()
        {
            var dbName = $"Test_Funding_Search_{Guid.NewGuid()}";
            using (var context = CreateInMemoryContext(dbName))
            {
                context.FundingOpportunities.AddRange(
                    new FundingOpportunity
                    {
                        Title = "Genomic Sequencing Research Program",
                        Provider = "National Institutes of Health",
                        FundingType = "Grant",
                        Status = "Open",
                        Description = "Cutting edge DNA analysis"
                    },
                    new FundingOpportunity
                    {
                        Title = "Quantum Algorithms Fellowship",
                        Provider = "IBM Research",
                        FundingType = "Fellowship",
                        Status = "Open",
                        Description = "Qiskit exploration"
                    }
                );
                await context.SaveChangesAsync();

                var controller = CreateControllerWithUser(context, 1);

                // Search for "Genomic"
                var result = await controller.GetOpportunities(null, null, "Open", "Genomic");
                var okResult = Assert.IsType<OkObjectResult>(result);
                var list = Assert.IsAssignableFrom<System.Collections.IEnumerable>(okResult.Value);
                var count = 0;
                foreach (var item in list) count++;
                Assert.Equal(1, count);
            }
        }

        [Fact]
        public async Task GetOpportunity_ShouldReturnFullDetails_WhenIdExists()
        {
            var dbName = $"Test_Funding_Detail_{Guid.NewGuid()}";
            using (var context = CreateInMemoryContext(dbName))
            {
                var opp = new FundingOpportunity
                {
                    Title = "Horizon Europe Green Tech Call",
                    Provider = "European Commission",
                    FundingType = "Grant",
                    FundingAmount = "€1,500,000",
                    Eligibility = "EU consortia with at least 3 members",
                    Requirements = "Proposal Part A and B",
                    ApplicationUrl = "https://ec.europa.eu/funding",
                    ApplicationInfo = "Submit via EC Funding and Tenders portal",
                    Status = "Open"
                };
                context.FundingOpportunities.Add(opp);
                await context.SaveChangesAsync();

                var controller = CreateControllerWithUser(context, 1);
                var result = await controller.GetOpportunity(opp.Id);

                var okResult = Assert.IsType<OkObjectResult>(result);
                var propTitle = okResult.Value!.GetType().GetProperty("Title")?.GetValue(okResult.Value) as string;
                var propProvider = okResult.Value.GetType().GetProperty("Provider")?.GetValue(okResult.Value) as string;
                var propAmount = okResult.Value.GetType().GetProperty("FundingAmount")?.GetValue(okResult.Value) as string;
                var propUrl = okResult.Value.GetType().GetProperty("ApplicationUrl")?.GetValue(okResult.Value) as string;

                Assert.Equal("Horizon Europe Green Tech Call", propTitle);
                Assert.Equal("European Commission", propProvider);
                Assert.Equal("€1,500,000", propAmount);
                Assert.Equal("https://ec.europa.eu/funding", propUrl);
            }
        }

        [Fact]
        public async Task GetOpportunity_ShouldReturn404NotFound_WhenIdDoesNotExist()
        {
            var dbName = $"Test_Funding_404_{Guid.NewGuid()}";
            using (var context = CreateInMemoryContext(dbName))
            {
                var controller = CreateControllerWithUser(context, 1);
                var result = await controller.GetOpportunity(9999);

                Assert.IsType<NotFoundObjectResult>(result);
            }
        }
    }
}
