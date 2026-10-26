using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public class AiMatchingService : IAiMatchingService
    {
        private readonly ApplicationDbContext _context;

        public AiMatchingService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<RecommendationPreference> GetUserPreferencesAsync(int userId)
        {
            var pref = await _context.RecommendationPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (pref == null)
            {
                pref = new RecommendationPreference
                {
                    UserId = userId,
                    InterestWeight = 0.35,
                    SkillWeight = 0.30,
                    InstitutionWeight = 0.15,
                    ActivityWeight = 0.20,
                    EnabledCategories = "Supervisors,Teammates,Researchers,Publications,Projects"
                };
                _context.RecommendationPreferences.Add(pref);
                await _context.SaveChangesAsync();
            }

            return pref;
        }

        public async Task<RecommendationPreference> UpdateUserPreferencesAsync(int userId, RecommendationPreference updated)
        {
            var existing = await GetUserPreferencesAsync(userId);
            existing.InterestWeight = updated.InterestWeight;
            existing.SkillWeight = updated.SkillWeight;
            existing.InstitutionWeight = updated.InstitutionWeight;
            existing.ActivityWeight = updated.ActivityWeight;
            existing.EnabledCategories = updated.EnabledCategories;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task<AiRecommendationResponseDto> GetAllRecommendationsAsync(int userId, bool forceRefresh = false)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null || user.Profile == null)
            {
                return new AiRecommendationResponseDto
                {
                    UserId = userId,
                    HasSufficientProfileData = false,
                    GuidanceMessage = "Please create and complete your profile to enable personalized AI recommendations."
                };
            }

            var userInterests = ParseTokens(user.Profile.Interests);
            var userSkills = ParseTokens(user.Profile.Skills);
            var hasSufficientData = userInterests.Count > 0 || userSkills.Count > 0;

            var supervisors = await GetSupervisorRecommendationsAsync(userId);
            var teammates = await GetTeammateRecommendationsAsync(userId);
            var researchers = await GetResearcherRecommendationsAsync(userId);
            var publications = await GetPaperRecommendationsAsync(userId);
            var projects = await GetProjectRecommendationsAsync(userId);
            var skillGap = await AnalyzeSkillGapAsync(userId, null, null);

            var response = new AiRecommendationResponseDto
            {
                UserId = userId,
                HasSufficientProfileData = hasSufficientData,
                GuidanceMessage = hasSufficientData
                    ? null
                    : "Add research interests and technical skills to your profile to receive higher-confidence AI recommendations.",
                Supervisors = supervisors,
                Teammates = teammates,
                Researchers = researchers,
                Publications = publications,
                Projects = projects,
                PrimarySkillGap = skillGap,
                GeneratedAt = DateTime.UtcNow
            };

            return response;
        }

        public async Task<List<UserRecommendationItemDto>> GetSupervisorRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser?.Profile == null) return new List<UserRecommendationItemDto>();

            var userInterests = ParseTokens(currentUser.Profile.Interests);
            var userUni = currentUser.Profile.University?.Trim() ?? string.Empty;
            var userDept = currentUser.Profile.Department?.Trim() ?? string.Empty;

            var supervisors = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != userId && (u.Role == "Supervisor" || u.Role == "Faculty"))
                .Where(u => u.Profile != null && u.Profile.IsAcceptingStudents)
                .ToListAsync();

            var results = new List<UserRecommendationItemDto>();

            foreach (var sup in supervisors)
            {
                var supProfile = sup.Profile!;
                var supInterests = ParseTokens(supProfile.Interests);
                var matched = userInterests.Intersect(supInterests, StringComparer.OrdinalIgnoreCase).ToList();

                double score = 0;
                // Interest match up to 50 points
                if (matched.Count > 0)
                {
                    score += Math.Min(50, matched.Count * 18);
                }

                // Department match (+25 points)
                if (!string.IsNullOrEmpty(userDept) && !string.IsNullOrEmpty(supProfile.Department) &&
                    userDept.Equals(supProfile.Department, StringComparison.OrdinalIgnoreCase))
                {
                    score += 25;
                }

                // University match (+15 points)
                if (!string.IsNullOrEmpty(userUni) && !string.IsNullOrEmpty(supProfile.University) &&
                    userUni.Equals(supProfile.University, StringComparison.OrdinalIgnoreCase))
                {
                    score += 15;
                }

                // Accepting students bonus (+10 points)
                score += 10;

                int finalScore = Math.Min(100, (int)score);
                if (finalScore == 0) finalScore = 30; // Base score for active faculty

                results.Add(new UserRecommendationItemDto
                {
                    UserId = sup.Id,
                    FullName = sup.FullName,
                    Role = sup.Role,
                    University = supProfile.University,
                    Department = supProfile.Department,
                    Bio = supProfile.Bio,
                    MatchScore = finalScore,
                    MatchedKeywords = matched,
                    IsAcceptingStudents = supProfile.IsAcceptingStudents,
                    RecommendationReason = matched.Count > 0
                        ? $"Matches {matched.Count} of your research interests ({string.Join(", ", matched.Take(2))})"
                        : "Active faculty supervisor in your academic network"
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(10).ToList();
        }

        public async Task<List<UserRecommendationItemDto>> GetTeammateRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser?.Profile == null) return new List<UserRecommendationItemDto>();

            var userInterests = ParseTokens(currentUser.Profile.Interests);
            var userSkills = ParseTokens(currentUser.Profile.Skills);

            var candidates = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != userId && u.Role != "Admin" && u.Role != "Moderator")
                .Where(u => u.Profile != null)
                .ToListAsync();

            var results = new List<UserRecommendationItemDto>();

            foreach (var candidate in candidates)
            {
                var candProfile = candidate.Profile!;
                var candInterests = ParseTokens(candProfile.Interests);
                var candSkills = ParseTokens(candProfile.Skills);

                var sharedInterests = userInterests.Intersect(candInterests, StringComparer.OrdinalIgnoreCase).ToList();
                // Complementary skills: skills the candidate has that the user does not!
                var complementarySkills = candSkills.Except(userSkills, StringComparer.OrdinalIgnoreCase).ToList();

                double score = 0;
                // Shared interests create common ground (+40 max)
                if (sharedInterests.Count > 0)
                {
                    score += Math.Min(40, sharedInterests.Count * 15);
                }

                // Complementary skills provide synergy (+40 max)
                if (complementarySkills.Count > 0)
                {
                    score += Math.Min(40, complementarySkills.Count * 15);
                }

                // Department / Institution familiarity (+20)
                if (!string.IsNullOrEmpty(currentUser.Profile.University) &&
                    currentUser.Profile.University.Equals(candProfile.University, StringComparison.OrdinalIgnoreCase))
                {
                    score += 20;
                }

                int finalScore = Math.Min(100, (int)score);
                if (finalScore == 0) finalScore = 25; // Base exploration score

                results.Add(new UserRecommendationItemDto
                {
                    UserId = candidate.Id,
                    FullName = candidate.FullName,
                    Role = candidate.Role,
                    University = candProfile.University,
                    Department = candProfile.Department,
                    Bio = candProfile.Bio,
                    MatchScore = finalScore,
                    MatchedKeywords = sharedInterests,
                    ComplementarySkills = complementarySkills.Take(3).ToList(),
                    RecommendationReason = complementarySkills.Count > 0
                        ? $"Brings complementary expertise in {string.Join(", ", complementarySkills.Take(2))}"
                        : "Potential research collaborator with aligned interests"
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(10).ToList();
        }

        public async Task<List<UserRecommendationItemDto>> GetResearcherRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser?.Profile == null) return new List<UserRecommendationItemDto>();

            var userInterests = ParseTokens(currentUser.Profile.Interests);

            var researchers = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != userId && (u.Role == "Researcher" || u.Role == "Faculty" || u.Role == "Supervisor"))
                .Where(u => u.Profile != null)
                .ToListAsync();

            var results = new List<UserRecommendationItemDto>();

            foreach (var r in researchers)
            {
                var rProfile = r.Profile!;
                var rInterests = ParseTokens(rProfile.Interests);
                var matched = userInterests.Intersect(rInterests, StringComparer.OrdinalIgnoreCase).ToList();

                int score = matched.Count * 25 + 20; // baseline 20 + 25 per shared domain
                score = Math.Min(98, score);

                results.Add(new UserRecommendationItemDto
                {
                    UserId = r.Id,
                    FullName = r.FullName,
                    Role = r.Role,
                    University = rProfile.University,
                    Department = rProfile.Department,
                    Bio = rProfile.Bio,
                    MatchScore = score,
                    MatchedKeywords = matched,
                    RecommendationReason = matched.Count > 0
                        ? $"Active researcher in {string.Join(", ", matched)}"
                        : "Leading researcher in related scholarly disciplines"
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(10).ToList();
        }

        public async Task<List<PublicationRecommendationDto>> GetPaperRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            var userInterests = ParseTokens(currentUser?.Profile?.Interests);
            var userSkills = ParseTokens(currentUser?.Profile?.Skills);
            var queryTokens = userInterests.Concat(userSkills).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            var publications = await _context.Publications
                .Where(p => p.OwnerId != userId)
                .OrderByDescending(p => p.PublicationYear)
                .Take(50)
                .ToListAsync();

            var results = new List<PublicationRecommendationDto>();

            foreach (var pub in publications)
            {
                var titleTokens = ParseTokens(pub.Title);
                var matched = queryTokens.Intersect(titleTokens, StringComparer.OrdinalIgnoreCase).ToList();

                int score = 40; // baseline discovery score
                if (matched.Count > 0)
                {
                    score += Math.Min(55, matched.Count * 25);
                }

                results.Add(new PublicationRecommendationDto
                {
                    PublicationId = pub.Id,
                    Title = pub.Title,
                    Authors = pub.Authors,
                    JournalOrConference = pub.JournalOrConference,
                    PublicationYear = pub.PublicationYear,
                    DOI = pub.DOI,
                    SourceLink = pub.SourceLink,
                    MatchScore = score,
                    MatchedTopics = matched,
                    Reason = matched.Count > 0
                        ? $"Relevant to your focus in {string.Join(", ", matched)}"
                        : "High-impact publication in your extended academic network"
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(8).ToList();
        }

        public async Task<List<ProjectRecommendationDto>> GetProjectRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            var userSkills = ParseTokens(currentUser?.Profile?.Skills);

            var openProjects = await _context.OpenProjects
                .Include(p => p.Supervisor)
                .Where(p => p.SupervisorId != userId)
                .OrderByDescending(p => p.Id)
                .Take(25)
                .ToListAsync();

            var results = new List<ProjectRecommendationDto>();

            foreach (var proj in openProjects)
            {
                var reqSkills = ParseTokens(proj.RequiredSkills);
                var matched = userSkills.Intersect(reqSkills, StringComparer.OrdinalIgnoreCase).ToList();
                var missing = reqSkills.Except(userSkills, StringComparer.OrdinalIgnoreCase).ToList();

                int score = 35; // base interest score
                if (reqSkills.Count > 0)
                {
                    double ratio = (double)matched.Count / reqSkills.Count;
                    score = (int)(ratio * 65 + 35);
                }

                results.Add(new ProjectRecommendationDto
                {
                    ProjectId = proj.Id,
                    Title = proj.Title,
                    Description = proj.Description,
                    SupervisorName = proj.Supervisor?.FullName ?? "Project Lead",
                    Department = proj.Department,
                    MatchScore = Math.Min(100, score),
                    MatchedSkills = matched,
                    MissingSkills = missing,
                    IsFunded = proj.IsFunded,
                    OpenPositions = proj.MaxStudents
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(6).ToList();
        }

        public async Task<SkillGapAnalysisResult> AnalyzeSkillGapAsync(int userId, string? targetDomain, int? targetProjectId)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            var userSkills = ParseTokens(user?.Profile?.Skills);
            var domain = targetDomain ?? "Artificial Intelligence & Data Science";

            List<string> benchmarkSkills;

            if (targetProjectId.HasValue)
            {
                var proj = await _context.OpenProjects.FindAsync(targetProjectId.Value);
                benchmarkSkills = ParseTokens(proj?.RequiredSkills);
                if (string.IsNullOrEmpty(targetDomain) && proj != null)
                {
                    domain = proj.Title;
                }
            }
            else
            {
                // Domain benchmark standards
                benchmarkSkills = new List<string> { "Python", "Machine Learning", "PyTorch", "Data Analysis", "Research Methodology", "Academic Writing" };
            }

            var currentMatches = userSkills.Intersect(benchmarkSkills, StringComparer.OrdinalIgnoreCase).ToList();
            var missing = benchmarkSkills.Except(userSkills, StringComparer.OrdinalIgnoreCase).ToList();

            int readiness = benchmarkSkills.Count > 0
                ? (int)Math.Round((double)currentMatches.Count / benchmarkSkills.Count * 100)
                : 50;

            var actionAdvice = missing.Count > 0
                ? $"To bridge this gap, prioritize learning {string.Join(", ", missing.Take(2))} or partner with a teammate proficient in these areas."
                : "You possess all key prerequisite skills for this research area!";

            var result = new SkillGapAnalysisResult
            {
                UserId = userId,
                TargetDomain = domain,
                TargetProjectId = targetProjectId,
                CurrentSkills = string.Join(", ", userSkills),
                MissingSkills = string.Join(", ", missing),
                ReadinessScore = Math.Min(100, Math.Max(15, readiness)),
                RecommendedAction = actionAdvice,
                AnalyzedAt = DateTime.UtcNow
            };

            return result;
        }

        public async Task<bool> DismissRecommendationAsync(int userId, int recommendationId)
        {
            var record = await _context.UserRecommendationRecords
                .FirstOrDefaultAsync(r => r.Id == recommendationId && r.UserId == userId);

            if (record != null)
            {
                record.Status = "Dismissed";
                await _context.SaveChangesAsync();
                return true;
            }
            return false;
        }

        private static List<string> ParseTokens(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return new List<string>();
            return input
                .Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .ToList();
        }
    }
}
