using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public interface IAiMatchingService
    {
        Task<AiRecommendationResponseDto> GetAllRecommendationsAsync(int userId, bool forceRefresh = false);
        Task<List<UserRecommendationItemDto>> GetSupervisorRecommendationsAsync(int userId);
        Task<List<UserRecommendationItemDto>> GetTeammateRecommendationsAsync(int userId);
        Task<List<UserRecommendationItemDto>> GetResearcherRecommendationsAsync(int userId);
        Task<List<PublicationRecommendationDto>> GetPaperRecommendationsAsync(int userId);
        Task<List<ProjectRecommendationDto>> GetProjectRecommendationsAsync(int userId);
        Task<SkillGapAnalysisResult> AnalyzeSkillGapAsync(int userId, string? targetDomain, int? targetProjectId);
        Task<RecommendationPreference> GetUserPreferencesAsync(int userId);
        Task<RecommendationPreference> UpdateUserPreferencesAsync(int userId, RecommendationPreference preference);
        Task<bool> DismissRecommendationAsync(int userId, int recommendationId);
    }

    // DTOs for AI Recommendations
    public class AiRecommendationResponseDto
    {
        public int UserId { get; set; }
        public bool HasSufficientProfileData { get; set; } = true;
        public string? GuidanceMessage { get; set; }

        public List<UserRecommendationItemDto> Supervisors { get; set; } = new List<UserRecommendationItemDto>();
        public List<UserRecommendationItemDto> Teammates { get; set; } = new List<UserRecommendationItemDto>();
        public List<UserRecommendationItemDto> Researchers { get; set; } = new List<UserRecommendationItemDto>();
        public List<PublicationRecommendationDto> Publications { get; set; } = new List<PublicationRecommendationDto>();
        public List<ProjectRecommendationDto> Projects { get; set; } = new List<ProjectRecommendationDto>();
        public SkillGapAnalysisResult? PrimarySkillGap { get; set; }

        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    }

    public class UserRecommendationItemDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? University { get; set; }
        public string? Department { get; set; }
        public string? Bio { get; set; }
        public int MatchScore { get; set; } // 0 - 100
        public List<string> MatchedKeywords { get; set; } = new List<string>();
        public List<string> ComplementarySkills { get; set; } = new List<string>();
        public string RecommendationReason { get; set; } = string.Empty;
        public bool IsAcceptingStudents { get; set; }
    }

    public class PublicationRecommendationDto
    {
        public int PublicationId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Authors { get; set; } = string.Empty;
        public string? JournalOrConference { get; set; }
        public int PublicationYear { get; set; }
        public string? DOI { get; set; }
        public string? SourceLink { get; set; }
        public int MatchScore { get; set; }
        public List<string> MatchedTopics { get; set; } = new List<string>();
        public string Reason { get; set; } = string.Empty;
    }

    public class ProjectRecommendationDto
    {
        public int ProjectId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string SupervisorName { get; set; } = string.Empty;
        public string? Department { get; set; }
        public int MatchScore { get; set; }
        public List<string> MatchedSkills { get; set; } = new List<string>();
        public List<string> MissingSkills { get; set; } = new List<string>();
        public bool IsFunded { get; set; }
        public int OpenPositions { get; set; }
    }
}
