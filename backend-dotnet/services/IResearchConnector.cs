using System.Collections.Generic;
using System.Threading.Tasks;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public interface IResearchConnector
    {
        string ProviderName { get; }
        Task<List<SearchResultDto>> SearchAsync(string query, int limit = 10);
    }
}