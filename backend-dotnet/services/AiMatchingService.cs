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

        // =========================================================================
        // PREFERENCES
        // =========================================================================

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
            existing.InterestWeight = Math.Max(0.05, Math.Min(1.0, updated.InterestWeight));
            existing.SkillWeight = Math.Max(0.05, Math.Min(1.0, updated.SkillWeight));
            existing.InstitutionWeight = Math.Max(0.05, Math.Min(1.0, updated.InstitutionWeight));
            existing.ActivityWeight = Math.Max(0.05, Math.Min(1.0, updated.ActivityWeight));
            existing.EnabledCategories = string.IsNullOrWhiteSpace(updated.EnabledCategories)
                ? "Supervisors,Teammates,Researchers,Publications,Projects"
                : updated.EnabledCategories;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existing;
        }

        // =========================================================================
        // UNIFIED RECOMMENDATIONS
        // =========================================================================

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

            // Cache top generated recommendations into UserRecommendationRecords
            await CacheGeneratedRecommendationsAsync(userId, supervisors, teammates, researchers, publications, projects);

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

        // =========================================================================
        // 1. SUPERVISOR MATCHING
        // =========================================================================

        public async Task<List<UserRecommendationItemDto>> GetSupervisorRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser?.Profile == null) return new List<UserRecommendationItemDto>();

            var pref = await GetUserPreferencesAsync(userId);
            var dismissedIds = await GetDismissedEntityIdsAsync(userId, "Supervisor");

            var userInterests = ParseTokens(currentUser.Profile.Interests);
            var userSkills = ParseTokens(currentUser.Profile.Skills);
            var userUni = currentUser.Profile.University?.Trim() ?? string.Empty;
            var userDept = currentUser.Profile.Department?.Trim() ?? string.Empty;

            var supervisors = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != userId && (u.Role == "Supervisor" || u.Role == "Faculty"))
                .Where(u => !dismissedIds.Contains(u.Id))
                .Where(u => u.Profile != null && u.Profile.IsAcceptingStudents)
                .ToListAsync();

            // Candidate publications count for activity scoring
            var supervisorIds = supervisors.Select(s => s.Id).ToList();
            var pubCounts = await _context.Publications
                .Where(p => supervisorIds.Contains(p.OwnerId))
                .GroupBy(p => p.OwnerId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count);

            var results = new List<UserRecommendationItemDto>();

            foreach (var sup in supervisors)
            {
                var supProfile = sup.Profile!;
                var supInterests = ParseTokens(supProfile.Interests);
                var supSkills = ParseTokens(supProfile.Skills);

                // 1. Interest Dimension (Jaccard similarity)
                var matched = userInterests.Intersect(supInterests, StringComparer.OrdinalIgnoreCase).ToList();
                double sInt = CalculateJaccard(userInterests, supInterests);

                // 2. Skill Compatibility Dimension
                double sSkill = CalculateJaccard(userSkills, supSkills);

                // 3. Affiliation Affinity Dimension
                double sAffil = CalculateAffiliationAffinity(userUni, userDept, supProfile.University, supProfile.Department);

                // 4. Activity Dimension
                pubCounts.TryGetValue(sup.Id, out int pubCount);
                double sAct = 0.5; // base for accepting students
                if (supProfile.IsAcceptingStudents) sAct += 0.3;
                if (pubCount > 0) sAct += Math.Min(0.2, pubCount * 0.05);

                // Composite multi-attribute calculation
                int finalScore = CalculateCompositeScore(pref, sInt, sSkill, sAffil, sAct);

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
                        : $"Faculty in {supProfile.Department ?? "your field"} accepting research students"
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(10).ToList();
        }

        // =========================================================================
        // 2. TEAMMATE MATCHING (COMPLEMENTARY SKILLS MATRIX)
        // =========================================================================

        public async Task<List<UserRecommendationItemDto>> GetTeammateRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser?.Profile == null) return new List<UserRecommendationItemDto>();

            var pref = await GetUserPreferencesAsync(userId);
            var dismissedIds = await GetDismissedEntityIdsAsync(userId, "Teammate");

            var userInterests = ParseTokens(currentUser.Profile.Interests);
            var userSkills = ParseTokens(currentUser.Profile.Skills);
            var userUni = currentUser.Profile.University?.Trim() ?? string.Empty;
            var userDept = currentUser.Profile.Department?.Trim() ?? string.Empty;

            var candidates = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != userId && u.Role != "Admin" && u.Role != "Moderator")
                .Where(u => !dismissedIds.Contains(u.Id))
                .Where(u => u.Profile != null)
                .ToListAsync();

            var candidateIds = candidates.Select(c => c.Id).ToList();
            var activeWorkspaceCounts = await _context.WorkspaceMembers
                .Where(wm => candidateIds.Contains(wm.UserId))
                .GroupBy(wm => wm.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count);

            var results = new List<UserRecommendationItemDto>();

            foreach (var candidate in candidates)
            {
                var candProfile = candidate.Profile!;
                var candInterests = ParseTokens(candProfile.Interests);
                var candSkills = ParseTokens(candProfile.Skills);

                // Shared interests create alignment
                var sharedInterests = userInterests.Intersect(candInterests, StringComparer.OrdinalIgnoreCase).ToList();
                double sInt = CalculateJaccard(userInterests, candInterests);

                // Complementary skills: skills candidate possesses that user does not
                var complementarySkills = candSkills.Except(userSkills, StringComparer.OrdinalIgnoreCase).ToList();
                double sSkill = candSkills.Count > 0 ? (double)complementarySkills.Count / candSkills.Count : 0.2;

                // Affiliation affinity
                double sAffil = CalculateAffiliationAffinity(userUni, userDept, candProfile.University, candProfile.Department);

                // Activity
                activeWorkspaceCounts.TryGetValue(candidate.Id, out int wsCount);
                double sAct = 0.4 + Math.Min(0.6, wsCount * 0.2);

                int finalScore = CalculateCompositeScore(pref, sInt, sSkill, sAffil, sAct);

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
                        : "Collaborator with aligned scholarly domain"
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(10).ToList();
        }

        // =========================================================================
        // 3. RESEARCHER & COLLABORATOR MATCHING
        // =========================================================================

        public async Task<List<UserRecommendationItemDto>> GetResearcherRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser?.Profile == null) return new List<UserRecommendationItemDto>();

            var pref = await GetUserPreferencesAsync(userId);
            var dismissedIds = await GetDismissedEntityIdsAsync(userId, "Researcher");

            var userInterests = ParseTokens(currentUser.Profile.Interests);
            var userUni = currentUser.Profile.University?.Trim() ?? string.Empty;
            var userDept = currentUser.Profile.Department?.Trim() ?? string.Empty;

            var researchers = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != userId && (u.Role == "Researcher" || u.Role == "Faculty" || u.Role == "Supervisor"))
                .Where(u => !dismissedIds.Contains(u.Id))
                .Where(u => u.Profile != null)
                .ToListAsync();

            var results = new List<UserRecommendationItemDto>();

            foreach (var r in researchers)
            {
                var rProfile = r.Profile!;
                var rInterests = ParseTokens(rProfile.Interests);
                var matched = userInterests.Intersect(rInterests, StringComparer.OrdinalIgnoreCase).ToList();

                double sInt = CalculateJaccard(userInterests, rInterests);
                double sSkill = 0.5;
                double sAffil = CalculateAffiliationAffinity(userUni, userDept, rProfile.University, rProfile.Department);
                double sAct = 0.7;

                int finalScore = CalculateCompositeScore(pref, sInt, sSkill, sAffil, sAct);

                results.Add(new UserRecommendationItemDto
                {
                    UserId = r.Id,
                    FullName = r.FullName,
                    Role = r.Role,
                    University = rProfile.University,
                    Department = rProfile.Department,
                    Bio = rProfile.Bio,
                    MatchScore = finalScore,
                    MatchedKeywords = matched,
                    RecommendationReason = matched.Count > 0
                        ? $"Active researcher in {string.Join(", ", matched.Take(2))}"
                        : "Established researcher in related scholarly disciplines"
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(10).ToList();
        }

        // =========================================================================
        // 4. LITERATURE & PAPER RECOMMENDATIONS
        // =========================================================================

        public async Task<List<PublicationRecommendationDto>> GetPaperRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            var dismissedIds = await GetDismissedEntityIdsAsync(userId, "Publication");

            var userInterests = ParseTokens(currentUser?.Profile?.Interests);
            var userSkills = ParseTokens(currentUser?.Profile?.Skills);
            var queryTokens = userInterests.Concat(userSkills).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            var publications = await _context.Publications
                .Where(p => p.OwnerId != userId && !dismissedIds.Contains(p.Id))
                .OrderByDescending(p => p.PublicationYear)
                .Take(50)
                .ToListAsync();

            var results = new List<PublicationRecommendationDto>();

            foreach (var pub in publications)
            {
                var titleTokens = ParseTokens(pub.Title);
                var matched = queryTokens
                    .Where(q => titleTokens.Contains(q, StringComparer.OrdinalIgnoreCase) ||
                                pub.Title.Contains(q, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                double overlapRatio = queryTokens.Count > 0 ? (double)matched.Count / Math.Min(4, queryTokens.Count) : 0.2;
                int yearDecay = Math.Max(0, DateTime.UtcNow.Year - pub.PublicationYear);
                double recencyScore = Math.Max(0.2, 1.0 - (yearDecay * 0.15));

                int score = (int)Math.Min(100, (overlapRatio * 60) + (recencyScore * 40));
                score = Math.Max(25, score);

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
                        ? $"Relevant to your focus in {string.Join(", ", matched.Take(2))}"
                        : "High-impact publication in your extended academic network"
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(8).ToList();
        }

        // =========================================================================
        // 5. OPEN PROJECT MATCHING
        // =========================================================================

        public async Task<List<ProjectRecommendationDto>> GetProjectRecommendationsAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            var dismissedIds = await GetDismissedEntityIdsAsync(userId, "Project");

            var userSkills = ParseTokens(currentUser?.Profile?.Skills);
            var userInterests = ParseTokens(currentUser?.Profile?.Interests);

            var openProjects = await _context.OpenProjects
                .Include(p => p.Supervisor)
                .Where(p => p.SupervisorId != userId && !dismissedIds.Contains(p.Id))
                .OrderByDescending(p => p.Id)
                .Take(25)
                .ToListAsync();

            var results = new List<ProjectRecommendationDto>();

            foreach (var proj in openProjects)
            {
                var reqSkills = ParseTokens(proj.RequiredSkills);
                var matched = userSkills.Intersect(reqSkills, StringComparer.OrdinalIgnoreCase).ToList();
                var missing = reqSkills.Except(userSkills, StringComparer.OrdinalIgnoreCase).ToList();

                double matchRatio = reqSkills.Count > 0 ? (double)matched.Count / reqSkills.Count : 0.4;
                double fundedBonus = proj.IsFunded ? 15 : 0;

                int score = (int)Math.Min(100, (matchRatio * 70) + fundedBonus + 15);

                results.Add(new ProjectRecommendationDto
                {
                    ProjectId = proj.Id,
                    Title = proj.Title,
                    Description = proj.Description,
                    SupervisorName = proj.Supervisor?.FullName ?? "Project Lead",
                    Department = proj.Department,
                    MatchScore = Math.Max(20, score),
                    MatchedSkills = matched,
                    MissingSkills = missing,
                    IsFunded = proj.IsFunded,
                    OpenPositions = proj.MaxStudents
                });
            }

            return results.OrderByDescending(r => r.MatchScore).Take(6).ToList();
        }

        // =========================================================================
        // 6. SKILL GAP ANALYSIS
        // =========================================================================

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
                // Dynamic domain benchmarks
                if (domain.Contains("Bio", StringComparison.OrdinalIgnoreCase) || domain.Contains("Genom", StringComparison.OrdinalIgnoreCase))
                {
                    benchmarkSkills = new List<string> { "Bioinformatics", "Python", "Genomics", "R", "Sequence Alignment", "Statistical Modeling" };
                }
                else if (domain.Contains("Block", StringComparison.OrdinalIgnoreCase) || domain.Contains("Consens", StringComparison.OrdinalIgnoreCase) || domain.Contains("Distribut", StringComparison.OrdinalIgnoreCase))
                {
                    benchmarkSkills = new List<string> { "Distributed Systems", "Cryptography", "Go", "Solidity", "Consensus Protocols", "P2P Networks" };
                }
                else if (domain.Contains("Robot", StringComparison.OrdinalIgnoreCase) || domain.Contains("Control", StringComparison.OrdinalIgnoreCase))
                {
                    benchmarkSkills = new List<string> { "ROS", "C++", "Kinematics", "Computer Vision", "Control Theory", "Embedded Systems" };
                }
                else
                {
                    benchmarkSkills = new List<string> { "Python", "Machine Learning", "PyTorch", "Data Analysis", "Research Methodology", "Academic Writing" };
                }
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

        // =========================================================================
        // 7. DISMISSAL & CACHING HELPERS
        // =========================================================================

        public async Task<bool> DismissRecommendationAsync(int userId, int recommendationId)
        {
            var record = await _context.UserRecommendationRecords
                .FirstOrDefaultAsync(r => (r.Id == recommendationId || r.TargetEntityId == recommendationId) && r.UserId == userId);

            if (record != null)
            {
                record.Status = "Dismissed";
            }
            else
            {
                _context.UserRecommendationRecords.Add(new UserRecommendationRecord
                {
                    UserId = userId,
                    TargetEntityId = recommendationId,
                    Category = "General",
                    Title = "Dismissed Match",
                    Status = "Dismissed",
                    GeneratedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            return true;
        }

        private async Task<List<int>> GetDismissedEntityIdsAsync(int userId, string category)
        {
            return await _context.UserRecommendationRecords
                .Where(r => r.UserId == userId && r.Status == "Dismissed")
                .Select(r => r.TargetEntityId)
                .ToListAsync();
        }

        private async Task CacheGeneratedRecommendationsAsync(
            int userId,
            List<UserRecommendationItemDto> supervisors,
            List<UserRecommendationItemDto> teammates,
            List<UserRecommendationItemDto> researchers,
            List<PublicationRecommendationDto> publications,
            List<ProjectRecommendationDto> projects)
        {
            try
            {
                var existingActive = await _context.UserRecommendationRecords
                    .Where(r => r.UserId == userId && r.Status == "Active")
                    .ToListAsync();

                _context.UserRecommendationRecords.RemoveRange(existingActive);

                var newRecords = new List<UserRecommendationRecord>();

                foreach (var sup in supervisors.Take(5))
                {
                    newRecords.Add(new UserRecommendationRecord
                    {
                        UserId = userId,
                        Category = "Supervisor",
                        TargetEntityId = sup.UserId,
                        Title = sup.FullName,
                        Subtitle = $"{sup.Department} · {sup.University}",
                        MatchScore = sup.MatchScore,
                        MatchedTags = string.Join(",", sup.MatchedKeywords),
                        RecommendationReason = sup.RecommendationReason,
                        Status = "Active"
                    });
                }

                foreach (var tm in teammates.Take(5))
                {
                    newRecords.Add(new UserRecommendationRecord
                    {
                        UserId = userId,
                        Category = "Teammate",
                        TargetEntityId = tm.UserId,
                        Title = tm.FullName,
                        Subtitle = $"{tm.Department} · {tm.University}",
                        MatchScore = tm.MatchScore,
                        MatchedTags = string.Join(",", tm.ComplementarySkills),
                        RecommendationReason = tm.RecommendationReason,
                        Status = "Active"
                    });
                }

                foreach (var pub in publications.Take(4))
                {
                    newRecords.Add(new UserRecommendationRecord
                    {
                        UserId = userId,
                        Category = "Publication",
                        TargetEntityId = pub.PublicationId,
                        Title = pub.Title,
                        Subtitle = pub.Authors,
                        MatchScore = pub.MatchScore,
                        MatchedTags = string.Join(",", pub.MatchedTopics),
                        RecommendationReason = pub.Reason,
                        Status = "Active"
                    });
                }

                _context.UserRecommendationRecords.AddRange(newRecords);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Non-fatal logging for caching rollups
                Console.WriteLine($"[AiMatchingService] Caching non-fatal warning: {ex.Message}");
            }
        }

        // =========================================================================
        // MATH & SIMILARITY ALGORITHMS
        // =========================================================================

        private static double CalculateJaccard(List<string> setA, List<string> setB)
        {
            if (setA.Count == 0 || setB.Count == 0) return 0.0;
            var intersect = setA.Intersect(setB, StringComparer.OrdinalIgnoreCase).Count();
            var union = setA.Union(setB, StringComparer.OrdinalIgnoreCase).Count();
            return union > 0 ? (double)intersect / union : 0.0;
        }

        private static double CalculateAffiliationAffinity(string? userUni, string? userDept, string? candUni, string? candDept)
        {
            if (string.IsNullOrEmpty(userUni) || string.IsNullOrEmpty(candUni)) return 0.1;

            bool sameUni = userUni.Equals(candUni, StringComparison.OrdinalIgnoreCase);
            bool sameDept = !string.IsNullOrEmpty(userDept) && !string.IsNullOrEmpty(candDept) &&
                            userDept.Equals(candDept, StringComparison.OrdinalIgnoreCase);

            if (sameUni && sameDept) return 1.0;
            if (sameUni) return 0.7;
            return 0.3; // cross-institutional potential
        }

        private static int CalculateCompositeScore(RecommendationPreference pref, double sInt, double sSkill, double sAffil, double sAct)
        {
            double wInt = pref.InterestWeight;
            double wSkill = pref.SkillWeight;
            double wAffil = pref.InstitutionWeight;
            double wAct = pref.ActivityWeight;

            double sumWeights = wInt + wSkill + wAffil + wAct;
            if (sumWeights <= 0) sumWeights = 1.0;

            double composite = (wInt * sInt + wSkill * sSkill + wAffil * sAffil + wAct * sAct) / sumWeights;
            int score = (int)Math.Round(composite * 100);

            return Math.Min(100, Math.Max(20, score));
        }

        private static List<string> ParseTokens(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return new List<string>();
            return input
                .Split(new[] { ',', ';', '|', '/' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
    }
}
