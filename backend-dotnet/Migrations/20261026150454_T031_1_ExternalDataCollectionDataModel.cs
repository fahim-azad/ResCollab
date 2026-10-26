using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResCollab.Api.Migrations
{
    /// <inheritdoc />
    public partial class T031_1_ExternalDataCollectionDataModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExternalDataSources",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SourceKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BaseUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CollectionMethod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ApiKey = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RateLimitPerMinute = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    LastRunAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExternalDataSources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExternalResearchRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SourceId = table.Column<int>(type: "int", nullable: true),
                    ExternalId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    NormalizedTitleHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    Authors = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Abstract = table.Column<string>(type: "nvarchar(max)", maxLength: 8000, nullable: true),
                    Doi = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PublicationYear = table.Column<int>(type: "int", nullable: true),
                    PublicationDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    JournalOrVenue = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    PrimaryField = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    OriginalUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    PdfDownloadUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    License = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IngestionStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CollectedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExternalResearchRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExternalResearchRecords_ExternalDataSources_SourceId",
                        column: x => x.SourceId,
                        principalTable: "ExternalDataSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "IngestionJobLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SourceId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    RecordsFetched = table.Column<int>(type: "int", nullable: false),
                    RecordsNormalized = table.Column<int>(type: "int", nullable: false),
                    DuplicatesSkipped = table.Column<int>(type: "int", nullable: false),
                    ErrorsCount = table.Column<int>(type: "int", nullable: false),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false),
                    SummaryMessage = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngestionJobLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IngestionJobLogs_ExternalDataSources_SourceId",
                        column: x => x.SourceId,
                        principalTable: "ExternalDataSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IngestionErrorRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    JobLogId = table.Column<int>(type: "int", nullable: false),
                    RawPayload = table.Column<string>(type: "nvarchar(max)", maxLength: 8000, nullable: false),
                    ErrorCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngestionErrorRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IngestionErrorRecords_IngestionJobLogs_JobLogId",
                        column: x => x.JobLogId,
                        principalTable: "IngestionJobLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExternalResearchRecords_Doi",
                table: "ExternalResearchRecords",
                column: "Doi");

            migrationBuilder.CreateIndex(
                name: "IX_ExternalResearchRecords_NormalizedTitleHash",
                table: "ExternalResearchRecords",
                column: "NormalizedTitleHash");

            migrationBuilder.CreateIndex(
                name: "IX_ExternalResearchRecords_SourceId",
                table: "ExternalResearchRecords",
                column: "SourceId");

            migrationBuilder.CreateIndex(
                name: "IX_IngestionErrorRecords_JobLogId",
                table: "IngestionErrorRecords",
                column: "JobLogId");

            migrationBuilder.CreateIndex(
                name: "IX_IngestionJobLogs_SourceId",
                table: "IngestionJobLogs",
                column: "SourceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExternalResearchRecords");

            migrationBuilder.DropTable(
                name: "IngestionErrorRecords");

            migrationBuilder.DropTable(
                name: "IngestionJobLogs");

            migrationBuilder.DropTable(
                name: "ExternalDataSources");
        }
    }
}
