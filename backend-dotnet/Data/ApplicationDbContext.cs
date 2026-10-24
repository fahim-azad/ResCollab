using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Models;

namespace ResCollab.Api.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<UserProfile> UserProfiles { get; set; }
        public DbSet<ResearchResource> ResearchResources { get; set; }
        public DbSet<ResourceTag> ResourceTags { get; set; }
        
        public DbSet<ResearchIdea> ResearchIdeas { get; set; }
        public DbSet<IdeaApplication> IdeaApplications { get; set; }
        
        public DbSet<OpenProject> OpenProjects { get; set; }
        public DbSet<ProjectApplication> ProjectApplications { get; set; }
        
        public DbSet<Workspace> Workspaces { get; set; }
        public DbSet<WorkspaceMember> WorkspaceMembers { get; set; }
        public DbSet<WorkspaceTask> WorkspaceTasks { get; set; }
        public DbSet<WorkspaceNote> WorkspaceNotes { get; set; }
        public DbSet<WorkspaceFile> WorkspaceFiles { get; set; }
        public DbSet<MilestoneFeedback> MilestoneFeedbacks { get; set; }
        public DbSet<UserFollow> UserFollows { get; set; }
        public DbSet<UserConnection> UserConnections { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<Bookmark> Bookmarks { get; set; }

        // Sprint 5 - Collaborator Discovery
        public DbSet<CollaboratorProfile> CollaboratorProfiles { get; set; }
        public DbSet<CollaborationOpportunity> CollaborationOpportunities { get; set; }

        // Sprint 5 - University & Department Profiles
        public DbSet<University> Universities { get; set; }
        public DbSet<Department> Departments { get; set; }

        // Sprint 5 - Research Directory
        public DbSet<Laboratory> Laboratories { get; set; }
        public DbSet<LaboratoryMember> LaboratoryMembers { get; set; }
        public DbSet<ProjectDirectoryListing> ProjectDirectoryListings { get; set; }

        // Sprint 5 - Chat
        public DbSet<Conversation> Conversations { get; set; }
        public DbSet<ConversationParticipant> ConversationParticipants { get; set; }
        public DbSet<ChatMessage> ChatMessages { get; set; }

        // Sprint 5 - Publications
        public DbSet<Publication> Publications { get; set; }

        // Sprint 5 - Research Funding
        public DbSet<FundingOpportunity> FundingOpportunities { get; set; }

        // Sprint 6 - Institutional Analytics
        public DbSet<InstitutionalMetric> InstitutionalMetrics { get; set; }
        public DbSet<ResearchAnalyticsSnapshot> ResearchAnalyticsSnapshots { get; set; }
        public DbSet<CollaborationNetworkMetric> CollaborationNetworkMetrics { get; set; }

        // Sprint 6 - AI Recommendations
        public DbSet<RecommendationPreference> RecommendationPreferences { get; set; }
        public DbSet<UserRecommendationRecord> UserRecommendationRecords { get; set; }
        public DbSet<SkillGapAnalysisResult> SkillGapAnalysisResults { get; set; }

        // Sprint 6 - Community Discussions
        public DbSet<CommunityPost> CommunityPosts { get; set; }
        public DbSet<CommunityComment> CommunityComments { get; set; }
        public DbSet<PostReaction> PostReactions { get; set; }
        public DbSet<PostShare> PostShares { get; set; }

        // Sprint 6 - Academic Events & CFP
        public DbSet<AcademicEvent> AcademicEvents { get; set; }
        public DbSet<EventBookmark> EventBookmarks { get; set; }

        // Sprint 6 - Personalized Dashboard
        public DbSet<DashboardWidgetPreference> DashboardWidgetPreferences { get; set; }
        public DbSet<PersonalizedActivityLog> PersonalizedActivityLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // One-to-One: User <-> UserProfile
            modelBuilder.Entity<User>()
                .HasOne(u => u.Profile)
                .WithOne(p => p.User)
                .HasForeignKey<UserProfile>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // One-to-Many: ResearchResource <-> ResourceTags
            modelBuilder.Entity<ResearchResource>()
                .HasMany(r => r.Tags)
                .WithOne(t => t.ResearchResource)
                .HasForeignKey(t => t.ResearchResourceId)
                .OnDelete(DeleteBehavior.Cascade);

            // One-to-Many: ResearchIdea <-> IdeaApplications
            modelBuilder.Entity<ResearchIdea>()
                .HasMany(i => i.Applications)
                .WithOne(a => a.Idea)
                .HasForeignKey(a => a.IdeaId)
                .OnDelete(DeleteBehavior.Cascade);
                
            // Ensure no circular cascade delete for Application -> User
            modelBuilder.Entity<IdeaApplication>()
                .HasOne(a => a.Applicant)
                .WithMany()
                .HasForeignKey(a => a.ApplicantId)
                .OnDelete(DeleteBehavior.Restrict);

            // One-to-Many: User (Supervisor) <-> OpenProject
            modelBuilder.Entity<OpenProject>()
                .HasOne(p => p.Supervisor)
                .WithMany()
                .HasForeignKey(p => p.SupervisorId)
                .OnDelete(DeleteBehavior.Cascade);

            // One-to-Many: OpenProject <-> ProjectApplications
            modelBuilder.Entity<ProjectApplication>()
                .HasOne(pa => pa.Project)
                .WithMany(p => p.Applications)
                .HasForeignKey(pa => pa.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            // Ensure no circular cascade delete for ProjectApplication -> User
            modelBuilder.Entity<ProjectApplication>()
                .HasOne(pa => pa.Applicant)
                .WithMany()
                .HasForeignKey(pa => pa.ApplicantId)
                .OnDelete(DeleteBehavior.Restrict);

            // Workspace <-> WorkspaceMember
            modelBuilder.Entity<WorkspaceMember>()
                .HasOne(wm => wm.Workspace)
                .WithMany(w => w.Members)
                .HasForeignKey(wm => wm.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);

            // User <-> WorkspaceMember
            modelBuilder.Entity<WorkspaceMember>()
                .HasOne(wm => wm.User)
                .WithMany()
                .HasForeignKey(wm => wm.UserId)
                .OnDelete(DeleteBehavior.Restrict); // Prevent circular cascade

            // OpenProject <-> Workspace (Optional 1-to-1 or 1-to-Many)
            modelBuilder.Entity<Workspace>()
                .HasOne(w => w.OpenProject)
                .WithMany()
                .HasForeignKey(w => w.OpenProjectId)
                .OnDelete(DeleteBehavior.SetNull);

            // Workspace <-> WorkspaceTask
            modelBuilder.Entity<WorkspaceTask>()
                .HasOne(t => t.Workspace)
                .WithMany()
                .HasForeignKey(t => t.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);

            // User <-> WorkspaceTask (Assignee)
            modelBuilder.Entity<WorkspaceTask>()
                .HasOne(t => t.Assignee)
                .WithMany()
                .HasForeignKey(t => t.AssignedToId)
                .OnDelete(DeleteBehavior.SetNull);

            // Workspace <-> WorkspaceNote
            modelBuilder.Entity<WorkspaceNote>()
                .HasOne(n => n.Workspace)
                .WithMany()
                .HasForeignKey(n => n.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<WorkspaceNote>()
                .HasOne(n => n.CreatedBy)
                .WithMany()
                .HasForeignKey(n => n.CreatedById)
                .OnDelete(DeleteBehavior.SetNull);

            // Workspace <-> WorkspaceFile
            modelBuilder.Entity<WorkspaceFile>()
                .HasOne(f => f.Workspace)
                .WithMany()
                .HasForeignKey(f => f.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<WorkspaceFile>()
                .HasOne(f => f.UploadedBy)
                .WithMany()
                .HasForeignKey(f => f.UploadedById)
                .OnDelete(DeleteBehavior.SetNull);

            // WorkspaceTask (Milestone) <-> MilestoneFeedback
            modelBuilder.Entity<MilestoneFeedback>()
                .HasOne(f => f.Milestone)
                .WithMany()
                .HasForeignKey(f => f.WorkspaceTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            // User <-> MilestoneFeedback
            modelBuilder.Entity<MilestoneFeedback>()
                .HasOne(f => f.GivenBy)
                .WithMany()
                .HasForeignKey(f => f.GivenById)
                .OnDelete(DeleteBehavior.Restrict);

            // UserFollow
            modelBuilder.Entity<UserFollow>()
                .HasOne(uf => uf.Follower)
                .WithMany()
                .HasForeignKey(uf => uf.FollowerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserFollow>()
                .HasOne(uf => uf.Followed)
                .WithMany()
                .HasForeignKey(uf => uf.FollowedId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserFollow>()
                .HasIndex(uf => new { uf.FollowerId, uf.FollowedId })
                .IsUnique();

            // UserConnection
            modelBuilder.Entity<UserConnection>()
                .HasOne(uc => uc.Requester)
                .WithMany()
                .HasForeignKey(uc => uc.RequesterId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserConnection>()
                .HasOne(uc => uc.Target)
                .WithMany()
                .HasForeignKey(uc => uc.TargetId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserConnection>()
                .HasIndex(uc => new { uc.RequesterId, uc.TargetId })
                .IsUnique();

            // Notification
            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Bookmark
            modelBuilder.Entity<Bookmark>()
                .HasOne(b => b.User)
                .WithMany()
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Prevent duplicate bookmarks for the exact same item by the same user
            modelBuilder.Entity<Bookmark>()
                .HasIndex(b => new { b.UserId, b.ItemType, b.ItemId })
                .IsUnique();

            // CollaboratorProfile - one per user
            modelBuilder.Entity<CollaboratorProfile>()
                .HasOne(cp => cp.User)
                .WithMany()
                .HasForeignKey(cp => cp.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CollaboratorProfile>()
                .HasIndex(cp => cp.UserId)
                .IsUnique();

            // CollaborationOpportunity - posted by a user
            modelBuilder.Entity<CollaborationOpportunity>()
                .HasOne(co => co.PostedBy)
                .WithMany()
                .HasForeignKey(co => co.PostedById)
                .OnDelete(DeleteBehavior.Cascade);

            // University <-> Department
            modelBuilder.Entity<Department>()
                .HasOne(d => d.University)
                .WithMany(u => u.Departments)
                .HasForeignKey(d => d.UniversityId)
                .OnDelete(DeleteBehavior.Cascade);

            // Unique department name within a university
            modelBuilder.Entity<Department>()
                .HasIndex(d => new { d.UniversityId, d.Name })
                .IsUnique();

            // Laboratory <-> Head (User)
            modelBuilder.Entity<Laboratory>()
                .HasOne(l => l.Head)
                .WithMany()
                .HasForeignKey(l => l.HeadUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Laboratory <-> LaboratoryMember
            modelBuilder.Entity<LaboratoryMember>()
                .HasOne(lm => lm.Laboratory)
                .WithMany(l => l.Members)
                .HasForeignKey(lm => lm.LaboratoryId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<LaboratoryMember>()
                .HasOne(lm => lm.User)
                .WithMany()
                .HasForeignKey(lm => lm.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Prevent duplicate membership in the same lab
            modelBuilder.Entity<LaboratoryMember>()
                .HasIndex(lm => new { lm.LaboratoryId, lm.UserId })
                .IsUnique();

            // ProjectDirectoryListing <-> Laboratory (optional)
            modelBuilder.Entity<ProjectDirectoryListing>()
                .HasOne(pdl => pdl.Laboratory)
                .WithMany()
                .HasForeignKey(pdl => pdl.LaboratoryId)
                .OnDelete(DeleteBehavior.SetNull);

            // Prevent duplicate listings for the same item
            modelBuilder.Entity<ProjectDirectoryListing>()
                .HasIndex(pdl => new { pdl.ItemType, pdl.ItemId })
                .IsUnique();

            // Conversation <-> Workspace (optional)
            modelBuilder.Entity<Conversation>()
                .HasOne(c => c.Workspace)
                .WithMany()
                .HasForeignKey(c => c.WorkspaceId)
                .OnDelete(DeleteBehavior.SetNull);

            // ConversationParticipant <-> Conversation
            modelBuilder.Entity<ConversationParticipant>()
                .HasOne(cp => cp.Conversation)
                .WithMany(c => c.Participants)
                .HasForeignKey(cp => cp.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            // ConversationParticipant <-> User
            modelBuilder.Entity<ConversationParticipant>()
                .HasOne(cp => cp.User)
                .WithMany()
                .HasForeignKey(cp => cp.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Prevent duplicate participants in a conversation
            modelBuilder.Entity<ConversationParticipant>()
                .HasIndex(cp => new { cp.ConversationId, cp.UserId })
                .IsUnique();

            // ChatMessage <-> Conversation
            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            // ChatMessage <-> Sender (User)
            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            // Publication <-> Owner (User)
            modelBuilder.Entity<Publication>()
                .HasOne(p => p.Owner)
                .WithMany()
                .HasForeignKey(p => p.OwnerId)
                .OnDelete(DeleteBehavior.Cascade);

            // FundingOpportunity <-> PostedBy (User, optional)
            modelBuilder.Entity<FundingOpportunity>()
                .HasOne(f => f.PostedBy)
                .WithMany()
                .HasForeignKey(f => f.PostedById)
                .OnDelete(DeleteBehavior.SetNull);

            // InstitutionalMetric <-> University
            modelBuilder.Entity<InstitutionalMetric>()
                .HasOne(m => m.Institution)
                .WithMany()
                .HasForeignKey(m => m.InstitutionId)
                .OnDelete(DeleteBehavior.Restrict);

            // InstitutionalMetric <-> Department
            modelBuilder.Entity<InstitutionalMetric>()
                .HasOne(m => m.Department)
                .WithMany()
                .HasForeignKey(m => m.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);

            // RecommendationPreference <-> User
            modelBuilder.Entity<RecommendationPreference>()
                .HasOne(rp => rp.User)
                .WithMany()
                .HasForeignKey(rp => rp.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // UserRecommendationRecord <-> User
            modelBuilder.Entity<UserRecommendationRecord>()
                .HasOne(ur => ur.User)
                .WithMany()
                .HasForeignKey(ur => ur.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // SkillGapAnalysisResult <-> User
            modelBuilder.Entity<SkillGapAnalysisResult>()
                .HasOne(sg => sg.User)
                .WithMany()
                .HasForeignKey(sg => sg.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // CommunityPost <-> Author (User)
            modelBuilder.Entity<CommunityPost>()
                .HasOne(p => p.Author)
                .WithMany()
                .HasForeignKey(p => p.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);

            // CommunityComment <-> Post
            modelBuilder.Entity<CommunityComment>()
                .HasOne(c => c.Post)
                .WithMany(p => p.Comments)
                .HasForeignKey(c => c.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            // CommunityComment <-> Author (User)
            modelBuilder.Entity<CommunityComment>()
                .HasOne(c => c.Author)
                .WithMany()
                .HasForeignKey(c => c.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);

            // CommunityComment <-> ParentComment (Reply hierarchy)
            modelBuilder.Entity<CommunityComment>()
                .HasOne(c => c.ParentComment)
                .WithMany(c => c.Replies)
                .HasForeignKey(c => c.ParentCommentId)
                .OnDelete(DeleteBehavior.Restrict);

            // PostReaction <-> Post
            modelBuilder.Entity<PostReaction>()
                .HasOne(r => r.Post)
                .WithMany(p => p.Reactions)
                .HasForeignKey(r => r.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            // PostReaction <-> User
            modelBuilder.Entity<PostReaction>()
                .HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Unique reaction per user per post
            modelBuilder.Entity<PostReaction>()
                .HasIndex(r => new { r.PostId, r.UserId })
                .IsUnique();

            // PostShare <-> Post
            modelBuilder.Entity<PostShare>()
                .HasOne(s => s.Post)
                .WithMany(p => p.Shares)
                .HasForeignKey(s => s.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            // PostShare <-> User
            modelBuilder.Entity<PostShare>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // AcademicEvent <-> PostedBy (User, optional)
            modelBuilder.Entity<AcademicEvent>()
                .HasOne(e => e.PostedBy)
                .WithMany()
                .HasForeignKey(e => e.PostedById)
                .OnDelete(DeleteBehavior.SetNull);

            // EventBookmark <-> Event
            modelBuilder.Entity<EventBookmark>()
                .HasOne(b => b.Event)
                .WithMany(e => e.Bookmarks)
                .HasForeignKey(b => b.EventId)
                .OnDelete(DeleteBehavior.Cascade);

            // EventBookmark <-> User
            modelBuilder.Entity<EventBookmark>()
                .HasOne(b => b.User)
                .WithMany()
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Unique bookmark per user per event
            modelBuilder.Entity<EventBookmark>()
                .HasIndex(b => new { b.EventId, b.UserId })
                .IsUnique();

            // DashboardWidgetPreference <-> User
            modelBuilder.Entity<DashboardWidgetPreference>()
                .HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // PersonalizedActivityLog <-> User
            modelBuilder.Entity<PersonalizedActivityLog>()
                .HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}