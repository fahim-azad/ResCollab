using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResCollab.Api.Migrations
{
    /// <inheritdoc />
    public partial class T019_1_RecommendationCriteriaDataModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RecommendationPreferences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    InterestWeight = table.Column<double>(type: "float", nullable: false),
                    SkillWeight = table.Column<double>(type: "float", nullable: false),
                    InstitutionWeight = table.Column<double>(type: "float", nullable: false),
                    ActivityWeight = table.Column<double>(type: "float", nullable: false),
                    EnabledCategories = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecommendationPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecommendationPreferences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SkillGapAnalysisResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TargetDomain = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TargetProjectId = table.Column<int>(type: "int", nullable: true),
                    CurrentSkills = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    MissingSkills = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    ReadinessScore = table.Column<int>(type: "int", nullable: false),
                    RecommendedAction = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    AnalyzedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkillGapAnalysisResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SkillGapAnalysisResults_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRecommendationRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TargetEntityId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Subtitle = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    MatchScore = table.Column<int>(type: "int", nullable: false),
                    MatchedTags = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RecommendationReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRecommendationRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserRecommendationRecords_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RecommendationPreferences_UserId",
                table: "RecommendationPreferences",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SkillGapAnalysisResults_UserId",
                table: "SkillGapAnalysisResults",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRecommendationRecords_UserId",
                table: "UserRecommendationRecords",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RecommendationPreferences");

            migrationBuilder.DropTable(
                name: "SkillGapAnalysisResults");

            migrationBuilder.DropTable(
                name: "UserRecommendationRecords");
        }
    }
}
