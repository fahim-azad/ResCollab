using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public class CrossrefConnector : IResearchConnector
    {
        private readonly HttpClient _httpClient;

        public string ProviderName => "Crossref";

        public CrossrefConnector(HttpClient httpClient)
        {
            _httpClient = httpClient;
            // Crossref asks for contact info in the user-agent for "polite" pool
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "ResCollab/1.0 (mailto:admin@rescollab.local)");
        }

        public async Task<List<SearchResultDto>> SearchAsync(string query, int limit = 10)
        {
            var results = new List<SearchResultDto>();
            
            if (string.IsNullOrWhiteSpace(query))
                return results;

            try
            {
                var url = $"https://api.crossref.org/works?query={Uri.EscapeDataString(query)}&select=title,author,URL,abstract,type,created&rows={limit}";
                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                    return results;

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                
                var items = doc.RootElement.GetProperty("message").GetProperty("items");

                foreach (var item in items.EnumerateArray())
                {
                    var title = item.TryGetProperty("title", out var titleProp) && titleProp.GetArrayLength() > 0 
                        ? titleProp[0].GetString() 
                        : "Untitled Document";

                    var abstractText = item.TryGetProperty("abstract", out var abstractProp) 
                        ? abstractProp.GetString() 
                        : "No abstract available.";

                    // Strip JATS XML tags often returned by Crossref abstracts
                    if (abstractText != null && abstractText.Contains("<jats:"))
                    {
                        abstractText = System.Text.RegularExpressions.Regex.Replace(abstractText, "<.*?>", string.Empty);
                    }

                    var urlVal = item.TryGetProperty("URL", out var urlProp) ? urlProp.GetString() : "";

                    var dto = new SearchResultDto
                    {
                        Id = Guid.NewGuid().ToString(),
                        Title = title ?? "Untitled",
                        Type = "Paper",
                        Description = abstractText ?? "No abstract available.",
                        Url = urlVal ?? "",
                        Source = ProviderName,
                        PublishedDate = DateTime.UtcNow // Fallback, could parse 'created' if needed
                    };
                    
                    dto.Tags.Add(ProviderName); // Add Crossref as a tag
                    
                    results.Add(dto);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Crossref Connector Error: {ex.Message}");
            }

            return results;
        }
    }
}