using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResCollab.Api.Migrations
{
    /// <inheritdoc />
    public partial class T018_1_InstitutionalAnalyticsDataModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CollaborationNetworkMetrics",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SourceInstitution = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TargetInstitution = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SourceDepartment = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TargetDepartment = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    JointPublicationsCount = table.Column<int>(type: "int", nullable: false),
                    JointProjectsCount = table.Column<int>(type: "int", nullable: false),
                    ActiveCoAuthors = table.Column<int>(type: "int", nullable: false),
                    LastCalculated = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CollaborationNetworkMetrics", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InstitutionalMetrics",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionId = table.Column<int>(type: "int", nullable: true),
                    DepartmentId = table.Column<int>(type: "int", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MetricType = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    MetricValue = table.Column<double>(type: "float", nullable: false),
                    Period = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PeriodYear = table.Column<int>(type: "int", nullable: false),
                    PeriodMonth = table.Column<int>(type: "int", nullable: true),
                    MetadataJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InstitutionalMetrics", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InstitutionalMetrics_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InstitutionalMetrics_Universities_InstitutionId",
                        column: x => x.InstitutionId,
                        principalTable: "Universities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ResearchAnalyticsSnapshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScopeType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ScopeId = table.Column<int>(type: "int", nullable: false),
                    ScopeName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TotalPublications = table.Column<int>(type: "int", nullable: false),
                    TotalProjects = table.Column<int>(type: "int", nullable: false),
                    ActiveCollaborations = table.Column<int>(type: "int", nullable: false),
                    CompletedTasks = table.Column<int>(type: "int", nullable: false),
                    TotalTasks = table.Column<int>(type: "int", nullable: false),
                    ProgressPercentage = table.Column<double>(type: "float", nullable: false),
                    ExternalPartnerships = table.Column<int>(type: "int", nullable: false),
                    LastCalculated = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResearchAnalyticsSnapshots", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InstitutionalMetrics_DepartmentId",
                table: "InstitutionalMetrics",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_InstitutionalMetrics_InstitutionId",
                table: "InstitutionalMetrics",
                column: "InstitutionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CollaborationNetworkMetrics");

            migrationBuilder.DropTable(
                name: "InstitutionalMetrics");

            migrationBuilder.DropTable(
                name: "ResearchAnalyticsSnapshots");
        }
    }
}
