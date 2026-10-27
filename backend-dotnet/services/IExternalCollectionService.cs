using System.Collections.Generic;
using System.Threading.Tasks;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public interface IExternalCollectionService
    {
        Task<List<ExternalDataSource>> GetConfiguredSourcesAsync();
        Task<ExternalDataSource?> GetSourceByIdAsync(int id);
        Task<ExternalDataSource?> GetSourceByKeyAsync(string sourceKey);
        Task<ExternalDataSource> UpdateSourceConfigAsync(int id, ExternalDataSource updated);
        Task<List<SourceStatusSummaryDto>> GetSourcesStatusAsync();
        Task<IngestionJobLog> RunCollectionJobAsync(string sourceKey, string? queryKeyword = null, int maxRecords = 30);
        Task<List<IngestionJobLog>> GetJobLogsAsync(int? sourceId = null, int limit = 20);
        Task<IngestionJobLog?> GetJobLogByIdAsync(int id);
        Task<PaginatedExternalRecordsDto> GetIngestedRecordsAsync(string? sourceKey = null, string? status = null, string? search = null, int page = 1, int pageSize = 20);
    }

    public class PaginatedExternalRecordsDto
    {
        public List<ExternalResearchRecord> Items { get; set; } = new List<ExternalResearchRecord>();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }
}
