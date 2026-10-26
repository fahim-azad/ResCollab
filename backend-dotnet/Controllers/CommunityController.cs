using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CommunityController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CommunityController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        private string GetCurrentUserRole()
        {
            return User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
        }

        // =========================================================================
        // 1. GET COMMUNITY FEED (WITH FILTERS, SEARCH & PAGINATION)
        // GET /api/community/posts?category=AI&search=quantum&tag=NLP&sort=latest&page=1&pageSize=10
        // =========================================================================
        [HttpGet("posts")]
        public async Task<IActionResult> GetPosts(
            [FromQuery] string? category = null,
            [FromQuery] string? search = null,
            [FromQuery] string? tag = null,
            [FromQuery] string? sort = "latest",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 15)
        {
            var currentUserId = GetCurrentUserId();
            var query = _context.CommunityPosts
                .Include(p => p.Author)
                    .ThenInclude(a => a!.Profile)
                .AsQueryable();

            // Filter: Category
            if (!string.IsNullOrWhiteSpace(category) && !category.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(p => p.Category.ToLower() == category.ToLower());
            }

            // Filter: Tag
            if (!string.IsNullOrWhiteSpace(tag))
            {
                query = query.Where(p => p.Tags != null && p.Tags.ToLower().Contains(tag.ToLower()));
            }

            // Filter: Search Keyword
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(p =>
                    p.Title.ToLower().Contains(s) ||
                    p.Content.ToLower().Contains(s) ||
                    (p.Tags != null && p.Tags.ToLower().Contains(s)) ||
                    (p.Author != null && p.Author.FullName.ToLower().Contains(s)));
            }

            // Sorting
            query = sort?.ToLower() switch
            {
                "popular" => query.OrderByDescending(p => p.IsPinned)
                                  .ThenByDescending(p => p.ReactionsCount + p.CommentsCount)
                                  .ThenByDescending(p => p.CreatedAt),
                "comments" => query.OrderByDescending(p => p.IsPinned)
                                   .ThenByDescending(p => p.CommentsCount)
                                   .ThenByDescending(p => p.CreatedAt),
                _ => query.OrderByDescending(p => p.IsPinned)
                          .ThenByDescending(p => p.CreatedAt)
            };

            var totalCount = await query.CountAsync();
            var skip = (Math.Max(1, page) - 1) * pageSize;
            var posts = await query.Skip(skip).Take(pageSize).ToListAsync();

            // Fetch current user's reactions for these posts in one query
            var postIds = posts.Select(p => p.Id).ToList();
            var userReactions = await _context.PostReactions
                .Where(r => r.UserId == currentUserId && postIds.Contains(r.PostId))
                .ToDictionaryAsync(r => r.PostId, r => r.ReactionType);

            var postDtos = posts.Select(p =>
            {
                var authorProfile = p.Author?.Profile;
                userReactions.TryGetValue(p.Id, out var userReactType);

                return new CommunityPostDto
                {
                    Id = p.Id,
                    AuthorId = p.AuthorId,
                    AuthorName = p.Author?.FullName ?? "Unknown Researcher",
                    AuthorRole = p.Author?.Role ?? "Researcher",
                    AuthorUniversity = authorProfile?.University,
                    AuthorDepartment = authorProfile?.Department,
                    Title = p.Title,
                    Content = p.Content,
                    Category = p.Category,
                    Tags = !string.IsNullOrWhiteSpace(p.Tags)
                        ? p.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
                        : new List<string>(),
                    AttachmentUrl = p.AttachmentUrl,
                    AttachmentType = p.AttachmentType,
                    ReactionsCount = p.ReactionsCount,
                    CommentsCount = p.CommentsCount,
                    SharesCount = p.SharesCount,
                    IsPinned = p.IsPinned,
                    Visibility = p.Visibility,
                    CreatedAt = p.CreatedAt,
                    UpdatedAt = p.UpdatedAt,
                    HasUserReacted = userReactType != null,
                    UserReactionType = userReactType,
                    IsAuthor = p.AuthorId == currentUserId
                };
            }).ToList();

            var result = new PaginatedPostsResultDto
            {
                Items = postDtos,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };

            return Ok(result);
        }

        // =========================================================================
        // 2. GET SINGLE POST WITH THREADED DISCUSSION
        // GET /api/community/posts/{id}
        // =========================================================================
        [HttpGet("posts/{id}")]
        public async Task<IActionResult> GetPostById(int id)
        {
            var currentUserId = GetCurrentUserId();

            var post = await _context.CommunityPosts
                .Include(p => p.Author)
                    .ThenInclude(a => a!.Profile)
                .Include(p => p.Comments)
                    .ThenInclude(c => c.Author)
                        .ThenInclude(a => a!.Profile)
                .Include(p => p.Comments)
                    .ThenInclude(c => c.Replies)
                        .ThenInclude(r => r.Author)
                            .ThenInclude(a => a!.Profile)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (post == null)
            {
                return NotFound(new { message = $"Post with ID {id} was not found." });
            }

            var userReaction = await _context.PostReactions
                .FirstOrDefaultAsync(r => r.PostId == id && r.UserId == currentUserId);

            // Filter to top-level comments only (ParentCommentId == null)
            var topLevelComments = post.Comments
                .Where(c => c.ParentCommentId == null)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new CommunityCommentDto
                {
                    Id = c.Id,
                    PostId = c.PostId,
                    AuthorId = c.AuthorId,
                    AuthorName = c.Author?.FullName ?? "Researcher",
                    AuthorRole = c.Author?.Role ?? "Researcher",
                    AuthorUniversity = c.Author?.Profile?.University,
                    AuthorDepartment = c.Author?.Profile?.Department,
                    Content = c.Content,
                    LikesCount = c.LikesCount,
                    CreatedAt = c.CreatedAt,
                    IsAuthor = c.AuthorId == currentUserId,
                    Replies = c.Replies
                        .OrderBy(r => r.CreatedAt)
                        .Select(r => new CommunityCommentDto
                        {
                            Id = r.Id,
                            PostId = r.PostId,
                            AuthorId = r.AuthorId,
                            AuthorName = r.Author?.FullName ?? "Researcher",
                            AuthorRole = r.Author?.Role ?? "Researcher",
                            AuthorUniversity = r.Author?.Profile?.University,
                            AuthorDepartment = r.Author?.Profile?.Department,
                            ParentCommentId = r.ParentCommentId,
                            Content = r.Content,
                            LikesCount = r.LikesCount,
                            CreatedAt = r.CreatedAt,
                            IsAuthor = r.AuthorId == currentUserId
                        }).ToList()
                }).ToList();

            var postDto = new CommunityPostDetailDto
            {
                Id = post.Id,
                AuthorId = post.AuthorId,
                AuthorName = post.Author?.FullName ?? "Unknown",
                AuthorRole = post.Author?.Role ?? "Researcher",
                AuthorUniversity = post.Author?.Profile?.University,
                AuthorDepartment = post.Author?.Profile?.Department,
                Title = post.Title,
                Content = post.Content,
                Category = post.Category,
                Tags = !string.IsNullOrWhiteSpace(post.Tags)
                    ? post.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
                    : new List<string>(),
                AttachmentUrl = post.AttachmentUrl,
                AttachmentType = post.AttachmentType,
                ReactionsCount = post.ReactionsCount,
                CommentsCount = post.CommentsCount,
                SharesCount = post.SharesCount,
                IsPinned = post.IsPinned,
                Visibility = post.Visibility,
                CreatedAt = post.CreatedAt,
                UpdatedAt = post.UpdatedAt,
                HasUserReacted = userReaction != null,
                UserReactionType = userReaction?.ReactionType,
                IsAuthor = post.AuthorId == currentUserId,
                Comments = topLevelComments
            };

            return Ok(postDto);
        }

        // =========================================================================
        // 3. CREATE RESEARCH POST
        // POST /api/community/posts
        // =========================================================================
        [HttpPost("posts")]
        public async Task<IActionResult> CreatePost([FromBody] CreatePostRequest req)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId <= 0) return Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Title))
            {
                return BadRequest(new { message = "Post title cannot be empty." });
            }

            if (string.IsNullOrWhiteSpace(req.Content))
            {
                return BadRequest(new { message = "Post content cannot be empty." });
            }

            var post = new CommunityPost
            {
                AuthorId = currentUserId,
                Title = req.Title.Trim(),
                Content = req.Content.Trim(),
                Category = string.IsNullOrWhiteSpace(req.Category) ? "General" : req.Category.Trim(),
                Tags = req.Tags != null && req.Tags.Any() ? string.Join(", ", req.Tags.Select(t => t.Trim())) : null,
                AttachmentUrl = req.AttachmentUrl?.Trim(),
                AttachmentType = req.AttachmentType?.Trim(),
                Visibility = string.IsNullOrWhiteSpace(req.Visibility) ? "Public" : req.Visibility.Trim(),
                IsPinned = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.CommunityPosts.Add(post);
            await _context.SaveChangesAsync();

            var author = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == currentUserId);

            var createdDto = new CommunityPostDto
            {
                Id = post.Id,
                AuthorId = currentUserId,
                AuthorName = author?.FullName ?? "Researcher",
                AuthorRole = author?.Role ?? "Researcher",
                AuthorUniversity = author?.Profile?.University,
                AuthorDepartment = author?.Profile?.Department,
                Title = post.Title,
                Content = post.Content,
                Category = post.Category,
                Tags = !string.IsNullOrWhiteSpace(post.Tags)
                    ? post.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
                    : new List<string>(),
                AttachmentUrl = post.AttachmentUrl,
                AttachmentType = post.AttachmentType,
                ReactionsCount = 0,
                CommentsCount = 0,
                SharesCount = 0,
                IsPinned = false,
                Visibility = post.Visibility,
                CreatedAt = post.CreatedAt,
                UpdatedAt = post.UpdatedAt,
                HasUserReacted = false,
                IsAuthor = true
            };

            return CreatedAtAction(nameof(GetPostById), new { id = post.Id }, createdDto);
        }

        // =========================================================================
        // 4. UPDATE RESEARCH POST
        // PUT /api/community/posts/{id}
        // =========================================================================
        [HttpPut("posts/{id}")]
        public async Task<IActionResult> UpdatePost(int id, [FromBody] UpdatePostRequest req)
        {
            var currentUserId = GetCurrentUserId();
            var currentUserRole = GetCurrentUserRole();

            var post = await _context.CommunityPosts
                .Include(p => p.Author)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (post == null)
            {
                return NotFound(new { message = $"Post with ID {id} was not found." });
            }

            var isAuthor = post.AuthorId == currentUserId;
            var isAdmin = currentUserRole == "Admin" || currentUserRole == "Moderator";

            if (!isAuthor && !isAdmin)
            {
                return Forbid();
            }

            if (!string.IsNullOrWhiteSpace(req.Title))
            {
                post.Title = req.Title.Trim();
            }

            if (!string.IsNullOrWhiteSpace(req.Content))
            {
                post.Content = req.Content.Trim();
            }

            if (!string.IsNullOrWhiteSpace(req.Category))
            {
                post.Category = req.Category.Trim();
            }

            if (req.Tags != null)
            {
                post.Tags = req.Tags.Any() ? string.Join(", ", req.Tags.Select(t => t.Trim())) : null;
            }

            if (req.AttachmentUrl != null)
            {
                post.AttachmentUrl = req.AttachmentUrl.Trim();
            }

            if (req.AttachmentType != null)
            {
                post.AttachmentType = req.AttachmentType.Trim();
            }

            if (isAdmin && req.IsPinned.HasValue)
            {
                post.IsPinned = req.IsPinned.Value;
            }

            post.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Post updated successfully.", postId = post.Id });
        }

        // =========================================================================
        // 5. DELETE RESEARCH POST
        // DELETE /api/community/posts/{id}
        // =========================================================================
        [HttpDelete("posts/{id}")]
        public async Task<IActionResult> DeletePost(int id)
        {
            var currentUserId = GetCurrentUserId();
            var currentUserRole = GetCurrentUserRole();

            var post = await _context.CommunityPosts.FirstOrDefaultAsync(p => p.Id == id);
            if (post == null)
            {
                return NotFound(new { message = $"Post with ID {id} was not found." });
            }

            var isAuthor = post.AuthorId == currentUserId;
            var isAdmin = currentUserRole == "Admin" || currentUserRole == "Moderator";

            if (!isAuthor && !isAdmin)
            {
                return Forbid();
            }

            _context.CommunityPosts.Remove(post);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Post deleted successfully.", postId = id });
        }

        // =========================================================================
        // 6. ADD COMMENT OR REPLY
        // POST /api/community/posts/{id}/comments
        // =========================================================================
        [HttpPost("posts/{id}/comments")]
        public async Task<IActionResult> AddComment(int id, [FromBody] AddCommentRequest req)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId <= 0) return Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Content))
            {
                return BadRequest(new { message = "Comment content cannot be empty." });
            }

            var post = await _context.CommunityPosts.FirstOrDefaultAsync(p => p.Id == id);
            if (post == null)
            {
                return NotFound(new { message = $"Post with ID {id} was not found." });
            }

            // Verify parent comment if this is a reply
            if (req.ParentCommentId.HasValue)
            {
                var parentExists = await _context.CommunityComments
                    .AnyAsync(c => c.Id == req.ParentCommentId.Value && c.PostId == id);

                if (!parentExists)
                {
                    return BadRequest(new { message = "Invalid parent comment reference." });
                }
            }

            var comment = new CommunityComment
            {
                PostId = id,
                AuthorId = currentUserId,
                ParentCommentId = req.ParentCommentId,
                Content = req.Content.Trim(),
                LikesCount = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.CommunityComments.Add(comment);
            post.CommentsCount += 1;
            await _context.SaveChangesAsync();

            var author = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == currentUserId);

            var commentDto = new CommunityCommentDto
            {
                Id = comment.Id,
                PostId = comment.PostId,
                AuthorId = currentUserId,
                AuthorName = author?.FullName ?? "Researcher",
                AuthorRole = author?.Role ?? "Researcher",
                AuthorUniversity = author?.Profile?.University,
                AuthorDepartment = author?.Profile?.Department,
                ParentCommentId = comment.ParentCommentId,
                Content = comment.Content,
                LikesCount = 0,
                CreatedAt = comment.CreatedAt,
                IsAuthor = true
            };

            return StatusCode(201, commentDto);
        }

        // =========================================================================
        // 7. DELETE COMMENT
        // DELETE /api/community/comments/{commentId}
        // =========================================================================
        [HttpDelete("comments/{commentId}")]
        public async Task<IActionResult> DeleteComment(int commentId)
        {
            var currentUserId = GetCurrentUserId();
            var currentUserRole = GetCurrentUserRole();

            var comment = await _context.CommunityComments
                .Include(c => c.Post)
                .FirstOrDefaultAsync(c => c.Id == commentId);

            if (comment == null)
            {
                return NotFound(new { message = $"Comment with ID {commentId} not found." });
            }

            var isAuthor = comment.AuthorId == currentUserId;
            var isAdmin = currentUserRole == "Admin" || currentUserRole == "Moderator";

            if (!isAuthor && !isAdmin)
            {
                return Forbid();
            }

            var post = comment.Post;
            if (post != null && post.CommentsCount > 0)
            {
                post.CommentsCount -= 1;
            }

            _context.CommunityComments.Remove(comment);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Comment deleted successfully." });
        }

        // =========================================================================
        // 8. TOGGLE POST REACTION
        // POST /api/community/posts/{id}/react
        // =========================================================================
        [HttpPost("posts/{id}/react")]
        public async Task<IActionResult> ToggleReaction(int id, [FromBody] ReactRequest req)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId <= 0) return Unauthorized();

            var post = await _context.CommunityPosts.FirstOrDefaultAsync(p => p.Id == id);
            if (post == null)
            {
                return NotFound(new { message = $"Post with ID {id} was not found." });
            }

            var reactionType = string.IsNullOrWhiteSpace(req.ReactionType) ? "Like" : req.ReactionType.Trim();

            var existingReaction = await _context.PostReactions
                .FirstOrDefaultAsync(r => r.PostId == id && r.UserId == currentUserId);

            bool hasReacted;
            string? activeType;

            if (existingReaction != null)
            {
                if (existingReaction.ReactionType.Equals(reactionType, StringComparison.OrdinalIgnoreCase))
                {
                    // Toggle OFF
                    _context.PostReactions.Remove(existingReaction);
                    post.ReactionsCount = Math.Max(0, post.ReactionsCount - 1);
                    hasReacted = false;
                    activeType = null;
                }
                else
                {
                    // Update reaction type (no count change)
                    existingReaction.ReactionType = reactionType;
                    hasReacted = true;
                    activeType = reactionType;
                }
            }
            else
            {
                // New reaction
                var reaction = new PostReaction
                {
                    PostId = id,
                    UserId = currentUserId,
                    ReactionType = reactionType,
                    CreatedAt = DateTime.UtcNow
                };

                _context.PostReactions.Add(reaction);
                post.ReactionsCount += 1;
                hasReacted = true;
                activeType = reactionType;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                postId = id,
                hasReacted,
                reactionType = activeType,
                reactionsCount = post.ReactionsCount
            });
        }

        // =========================================================================
        // 9. SHARE POST
        // POST /api/community/posts/{id}/share
        // =========================================================================
        [HttpPost("posts/{id}/share")]
        public async Task<IActionResult> SharePost(int id, [FromBody] ShareRequest req)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId <= 0) return Unauthorized();

            var post = await _context.CommunityPosts.FirstOrDefaultAsync(p => p.Id == id);
            if (post == null)
            {
                return NotFound(new { message = $"Post with ID {id} was not found." });
            }

            var share = new PostShare
            {
                PostId = id,
                UserId = currentUserId,
                ShareNote = req.ShareNote?.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _context.PostShares.Add(share);
            post.SharesCount += 1;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Post shared successfully.", sharesCount = post.SharesCount });
        }

        // =========================================================================
        // 10. CATEGORIES WITH COUNTS
        // GET /api/community/categories
        // =========================================================================
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            var categoryCounts = await _context.CommunityPosts
                .GroupBy(p => p.Category)
                .Select(g => new CategoryCountDto
                {
                    Category = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();

            var defaultCategories = new List<string>
            {
                "General", "ResearchInquiry", "PaperDiscussion", "ConferenceUpdate", "CollaborationCall"
            };

            foreach (var defCat in defaultCategories)
            {
                if (!categoryCounts.Any(c => c.Category.Equals(defCat, StringComparison.OrdinalIgnoreCase)))
                {
                    categoryCounts.Add(new CategoryCountDto { Category = defCat, Count = 0 });
                }
            }

            return Ok(categoryCounts);
        }

        // =========================================================================
        // 11. TRENDING TAGS
        // GET /api/community/trending-tags
        // =========================================================================
        [HttpGet("trending-tags")]
        public async Task<IActionResult> GetTrendingTags()
        {
            var allTags = await _context.CommunityPosts
                .Where(p => !string.IsNullOrEmpty(p.Tags))
                .Select(p => p.Tags!)
                .ToListAsync();

            var trending = allTags
                .SelectMany(t => t.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(g => g.Count())
                .Take(10)
                .Select(g => new { Tag = g.Key, Count = g.Count() })
                .ToList();

            return Ok(trending);
        }
    }

    // =========================================================================
    // DTO REQUEST / RESPONSE MODELS
    // =========================================================================

    public class CreatePostRequest
    {
        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(5000)]
        public string Content { get; set; } = string.Empty;

        public string? Category { get; set; } = "General";

        public List<string>? Tags { get; set; }

        public string? AttachmentUrl { get; set; }

        public string? AttachmentType { get; set; } // "Link", "PDF", "Image"

        public string? Visibility { get; set; } = "Public";
    }

    public class UpdatePostRequest
    {
        public string? Title { get; set; }
        public string? Content { get; set; }
        public string? Category { get; set; }
        public List<string>? Tags { get; set; }
        public string? AttachmentUrl { get; set; }
        public string? AttachmentType { get; set; }
        public bool? IsPinned { get; set; }
    }

    public class AddCommentRequest
    {
        [Required]
        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        public int? ParentCommentId { get; set; }
    }

    public class ReactRequest
    {
        public string? ReactionType { get; set; } = "Like";
    }

    public class ShareRequest
    {
        public string? ShareNote { get; set; }
    }

    public class CommunityPostDto
    {
        public int Id { get; set; }
        public int AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string AuthorRole { get; set; } = string.Empty;
        public string? AuthorUniversity { get; set; }
        public string? AuthorDepartment { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public string? AttachmentUrl { get; set; }
        public string? AttachmentType { get; set; }
        public int ReactionsCount { get; set; }
        public int CommentsCount { get; set; }
        public int SharesCount { get; set; }
        public bool IsPinned { get; set; }
        public string Visibility { get; set; } = "Public";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool HasUserReacted { get; set; }
        public string? UserReactionType { get; set; }
        public bool IsAuthor { get; set; }
    }

    public class CommunityPostDetailDto : CommunityPostDto
    {
        public List<CommunityCommentDto> Comments { get; set; } = new List<CommunityCommentDto>();
    }

    public class CommunityCommentDto
    {
        public int Id { get; set; }
        public int PostId { get; set; }
        public int AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string AuthorRole { get; set; } = string.Empty;
        public string? AuthorUniversity { get; set; }
        public string? AuthorDepartment { get; set; }
        public int? ParentCommentId { get; set; }
        public string Content { get; set; } = string.Empty;
        public int LikesCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsAuthor { get; set; }
        public List<CommunityCommentDto> Replies { get; set; } = new List<CommunityCommentDto>();
    }

    public class PaginatedPostsResultDto
    {
        public List<CommunityPostDto> Items { get; set; } = new List<CommunityPostDto>();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    public class CategoryCountDto
    {
        public string Category { get; set; } = string.Empty;
        public int Count { get; set; }
    }
}
