using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using LabSOM.Backend.Core.Data;
using Microsoft.EntityFrameworkCore;

namespace LabSOM.Backend.Core.Services
{
    public class ProjectService
    {
        private readonly AppDbContext _db;
        private readonly string _projectsDir;

        public ProjectService(AppDbContext db)
        {
            _db = db;
            _projectsDir = Path.Combine(AppContext.BaseDirectory, "App_Data", "projects");
            if (!Directory.Exists(_projectsDir))
            {
                Directory.CreateDirectory(_projectsDir);
            }
        }

        public async Task<Project> SaveProjectCompressedStreamAsync(int userId, string? projectId, string title, string? description, Stream compressedStream)
        {
            Project? project = null;

            if (!string.IsNullOrEmpty(projectId))
            {
                project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
                if (project != null)
                {
                    // If user is not the owner and the title is different, create a new project for this user instead of modifying the shared one
                    if (project.OwnerId != userId && !string.Equals(project.Title?.Trim(), title?.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        project = null;
                    }
                    else
                    {
                        // Check permission (owner or editor)
                        if (project.OwnerId != userId)
                        {
                            var share = await _db.ProjectShares.FirstOrDefaultAsync(ps => ps.ProjectId == projectId && ps.SharedWithUserId == userId);
                            if (share == null || share.Permission != "Write")
                            {
                                throw new UnauthorizedAccessException("You do not have write permissions for this project.");
                            }
                        }

                        project.Title = title;
                        project.Description = description;
                        project.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }

            if (project == null)
            {
                project = new Project
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Title = title,
                    Description = description,
                    OwnerId = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    PayloadFileName = $"{Guid.NewGuid():N}.json.gz"
                };
                _db.Projects.Add(project);
            }

            // Directly write the client-compressed gzip stream to disk
            string filePath = Path.Combine(_projectsDir, project.PayloadFileName);
            using (var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
            {
                await compressedStream.CopyToAsync(fileStream);
            }

            await _db.SaveChangesAsync();
            return project;
        }

        public async Task<Project> SaveProjectAsync(int userId, string? projectId, string title, string? description, string jsonPayload)
        {
            Project? project = null;

            if (!string.IsNullOrEmpty(projectId))
            {
                project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
                if (project != null)
                {
                    // If user is not the owner and the title is different, create a new project for this user instead of modifying the shared one
                    if (project.OwnerId != userId && !string.Equals(project.Title?.Trim(), title?.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        project = null;
                    }
                    else
                    {
                        // Check permission (owner or editor)
                        if (project.OwnerId != userId)
                        {
                            var share = await _db.ProjectShares.FirstOrDefaultAsync(ps => ps.ProjectId == projectId && ps.SharedWithUserId == userId);
                            if (share == null || share.Permission != "Write")
                            {
                                throw new UnauthorizedAccessException("You do not have write permissions for this project.");
                            }
                        }

                        project.Title = title;
                        project.Description = description;
                        project.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }

            if (project == null)
            {
                project = new Project
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Title = title,
                    Description = description,
                    OwnerId = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    PayloadFileName = $"{Guid.NewGuid():N}.json.gz"
                };
                _db.Projects.Add(project);
            }

            // Save JSON payload to compressed file on disk
            string filePath = Path.Combine(_projectsDir, project.PayloadFileName);
            using (var fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write))
            using (var gzipStream = new GZipStream(fileStream, CompressionLevel.Optimal))
            using (var writer = new StreamWriter(gzipStream, Encoding.UTF8))
            {
                await writer.WriteAsync(jsonPayload);
            }

            await _db.SaveChangesAsync();
            return project;
        }

        public async Task<string> LoadProjectPayloadAsync(int userId, string projectId)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
            if (project == null)
            {
                throw new KeyNotFoundException("Project not found.");
            }

            // Check read permission (owner or shared)
            if (project.OwnerId != userId)
            {
                bool isShared = await _db.ProjectShares.AnyAsync(ps => ps.ProjectId == projectId && ps.SharedWithUserId == userId);
                if (!isShared)
                {
                    throw new UnauthorizedAccessException("Access denied.");
                }
            }

            string filePath = Path.Combine(_projectsDir, project.PayloadFileName);
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException("Project payload file missing.");
            }

            using (var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read))
            using (var gzipStream = new GZipStream(fileStream, CompressionMode.Decompress))
            using (var reader = new StreamReader(gzipStream, Encoding.UTF8))
            {
                return await reader.ReadToEndAsync();
            }
        }

        public async Task<object> GetUserProjectsAsync(int userId)
        {
            var owned = await _db.Projects
                .Where(p => p.OwnerId == userId)
                .OrderByDescending(p => p.UpdatedAt)
                .Select(p => new
                {
                    id = p.Id,
                    title = p.Title,
                    description = p.Description,
                    createdAt = p.CreatedAt,
                    updatedAt = p.UpdatedAt,
                    isOwner = true,
                    permission = "Owner",
                    ownerUsername = p.Owner != null ? p.Owner.Username : ""
                })
                .ToListAsync();

            var shared = await _db.ProjectShares
                .Where(ps => ps.SharedWithUserId == userId)
                .Include(ps => ps.Project)
                .ThenInclude(p => p!.Owner)
                .Select(ps => new
                {
                    id = ps.Project!.Id,
                    title = ps.Project.Title,
                    description = ps.Project.Description,
                    createdAt = ps.Project.CreatedAt,
                    updatedAt = ps.Project.UpdatedAt,
                    isOwner = false,
                    permission = ps.Permission,
                    ownerUsername = ps.Project.Owner != null ? ps.Project.Owner.Username : ""
                })
                .ToListAsync();

            return new { owned, shared };
        }

        public async Task ShareProjectAsync(int ownerId, string projectId, string targetUsernameOrEmail, string permission)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && p.OwnerId == ownerId);
            if (project == null)
            {
                throw new InvalidOperationException("Project not found or you are not the owner.");
            }

            var targetUser = await _db.Users.FirstOrDefaultAsync(u => 
                u.Username.ToLower() == targetUsernameOrEmail.ToLower() || 
                u.Email.ToLower() == targetUsernameOrEmail.ToLower());

            if (targetUser == null)
            {
                throw new KeyNotFoundException($"User '{targetUsernameOrEmail}' not found.");
            }

            if (targetUser.Id == ownerId)
            {
                throw new InvalidOperationException("You cannot share a project with yourself.");
            }

            var existingShare = await _db.ProjectShares.FirstOrDefaultAsync(ps => ps.ProjectId == projectId && ps.SharedWithUserId == targetUser.Id);
            if (existingShare != null)
            {
                existingShare.Permission = permission;
                existingShare.SharedAt = DateTime.UtcNow;
            }
            else
            {
                _db.ProjectShares.Add(new ProjectShare
                {
                    ProjectId = projectId,
                    SharedWithUserId = targetUser.Id,
                    Permission = permission,
                    SharedAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync();
        }

        public async Task DeleteProjectAsync(int userId, string projectId)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && p.OwnerId == userId);
            if (project == null)
            {
                throw new InvalidOperationException("Project not found or permission denied.");
            }

            string filePath = Path.Combine(_projectsDir, project.PayloadFileName);
            if (File.Exists(filePath))
            {
                try { File.Delete(filePath); } catch { }
            }

            _db.Projects.Remove(project);
            await _db.SaveChangesAsync();
        }
    }
}
