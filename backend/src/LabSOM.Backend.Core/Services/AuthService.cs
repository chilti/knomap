using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using LabSOM.Backend.Core.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LabSOM.Backend.Core.Services
{
    public class AuthService
    {
        private readonly AppDbContext _db;
        private readonly string _jwtSecret;

        public AuthService(AppDbContext db)
        {
            _db = db;
            // Secret key fallback if environment variable is not provided
            _jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") 
                ?? "knomap_super_secret_jwt_key_2026_change_in_production_environment_998877665544332211";
        }

        public async Task EnsureAdminCreatedAsync()
        {
            await _db.Database.EnsureCreatedAsync();

            var adminExists = await _db.Users.AnyAsync(u => u.Role == "Admin");
            if (!adminExists)
            {
                string adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? "admin123";
                var admin = new User
                {
                    Username = "admin",
                    Email = "admin@knomap.local",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                    Role = "Admin"
                };
                _db.Users.Add(admin);
                await _db.SaveChangesAsync();
                Console.WriteLine($"[*] Default Admin user seeded: 'admin' with initial password: '{adminPassword}'");
            }

            // Also seed default local desktop user for offline/standalone mode
            var localUserExists = await _db.Users.AnyAsync(u => u.Username == "desktop_local");
            if (!localUserExists)
            {
                var localUser = new User
                {
                    Username = "desktop_local",
                    Email = "desktop@knomap.local",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("local_desktop_pass_9988"),
                    Role = "Admin"
                };
                _db.Users.Add(localUser);
                await _db.SaveChangesAsync();
            }
        }

        public async Task<User?> AuthenticateAsync(string usernameOrEmail, string password)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => 
                u.Username.ToLower() == usernameOrEmail.ToLower() || 
                u.Email.ToLower() == usernameOrEmail.ToLower());

            if (user == null) return null;

            bool isValid = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
            return isValid ? user : null;
        }

        public async Task<User?> CreateUserAsync(string username, string email, string password, string role = "User")
        {
            if (await _db.Users.AnyAsync(u => u.Username.ToLower() == username.ToLower()))
            {
                throw new Exception("Username already exists.");
            }
            if (await _db.Users.AnyAsync(u => u.Email.ToLower() == email.ToLower()))
            {
                throw new Exception("Email already exists.");
            }

            var newUser = new User
            {
                Username = username,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Role = role
            };

            _db.Users.Add(newUser);
            await _db.SaveChangesAsync();
            return newUser;
        }

        public string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_jwtSecret);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Role, user.Role)
                }),
                Expires = DateTime.UtcNow.AddDays(30),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}
