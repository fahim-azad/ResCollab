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
        }
    }
}