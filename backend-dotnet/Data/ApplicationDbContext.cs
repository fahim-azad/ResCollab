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
        }
    }
}