using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResCollab.Api.Migrations
{
    /// <inheritdoc />
    public partial class T027_1_FundingOpportunityDataModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FundingOpportunities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", maxLength: 5000, nullable: true),
                    Eligibility = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Requirements = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    FundingAmount = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FundingType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ResearchArea = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ApplicationUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ApplicationInfo = table.Column<string>(type: "nvarchar(3000)", maxLength: 3000, nullable: true),
                    Deadline = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PostedById = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FundingOpportunities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FundingOpportunities_Users_PostedById",
                        column: x => x.PostedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FundingOpportunities_PostedById",
                table: "FundingOpportunities",
                column: "PostedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FundingOpportunities");
        }
    }
}
