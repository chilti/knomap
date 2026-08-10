using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;

namespace LabSOM.Backend.Core.Data
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = "User"; // "Admin" or "User"
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Project
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int OwnerId { get; set; }
        public User? Owner { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public string PayloadFileName { get; set; } = string.Empty;
        
        public ICollection<ProjectShare> Shares { get; set; } = new List<ProjectShare>();
    }

    public class ProjectShare
    {
        public int Id { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public Project? Project { get; set; }
        public int SharedWithUserId { get; set; }
        public User? SharedWithUser { get; set; }
        public string Permission { get; set; } = "Read"; // "Read" or "Write"
        public DateTime SharedAt { get; set; } = DateTime.UtcNow;
    }

    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Project> Projects => Set<Project>();
        public DbSet<ProjectShare> ProjectShares => Set<ProjectShare>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<Project>()
                .HasOne(p => p.Owner)
                .WithMany()
                .HasForeignKey(p => p.OwnerId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProjectShare>()
                .HasOne(ps => ps.Project)
                .WithMany(p => p.Shares)
                .HasForeignKey(ps => ps.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProjectShare>()
                .HasOne(ps => ps.SharedWithUser)
                .WithMany()
                .HasForeignKey(ps => ps.SharedWithUserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
