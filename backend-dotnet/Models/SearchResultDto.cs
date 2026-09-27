using System;
using System.Collections.Generic;

namespace ResCollab.Api.Models
{
    public class SearchResultDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // "Paper", "Dataset", "Researcher"
        public string Description { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public DateTime PublishedDate { get; set; }
        public string Source { get; set; } = string.Empty; // "Local", "Crossref"
    }
}