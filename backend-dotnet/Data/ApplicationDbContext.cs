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
        }
    }
}