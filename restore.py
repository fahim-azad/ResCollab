import os

base_path = r"d:\3-2 class stuff\software lab\project\ResCollab2\backend-dotnet"
files = {
    r"Program.cs": r"""using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ResCollab.Api.Data;
using ResCollab.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure EF Core with PostgreSQL
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

// Configure CORS for React frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

// Add Search Connector
builder.Services.AddHttpClient();
builder.Services.AddScoped<IResearchConnector, CrossrefConnector>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowReactApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();""",

    r"ResCollab.Api.csproj": r"""<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.4.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
  </ItemGroup>

</Project>""",

    r"appsettings.json": r"""{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=rescollab;Username=postgres;Password=postgres"
  },
  "Jwt": {
    "Key": "supersecretjwtkey12345678901234567890",
    "Issuer": "ResCollab",
    "Audience": "ResCollabUsers"
  }
}""",

    r"appsettings.Development.json": r"""{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}""",

    r"Controllers\AuthController.cs": r"""using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using ResCollab.Api.Data;
using ResCollab.Api.Models;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _config;

        public AuthController(ApplicationDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public class RegisterRequest
        {
            public string FullName { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string Role { get; set; } = string.Empty;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest req)
        {
            if (await _context.Users.AnyAsync(u => u.Email == req.Email))
            {
                return BadRequest(new { message = "User already exists" });
            }

            var user = new User
            {
                FullName = req.FullName,
                Email = req.Email,
                Role = req.Role,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Create empty profile
            var profile = new UserProfile { UserId = user.Id };
            _context.UserProfiles.Add(profile);
            await _context.SaveChangesAsync();

            var token = GenerateJwt(user);
            return StatusCode(201, new { token, user = new { id = user.Id, fullName = user.FullName, email = user.Email, role = user.Role } });
        }

        public class LoginRequest
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
            if (user == null)
            {
                return BadRequest(new { message = "Invalid credentials" });
            }

            if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            {
                return BadRequest(new { message = "Invalid credentials" });
            }

            var token = GenerateJwt(user);
            return Ok(new { token, user = new { id = user.Id, fullName = user.FullName, email = user.Email, role = user.Role } });
        }

        private string GenerateJwt(User user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("role", user.Role)
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}""",

    r"Controllers\ProfileController.cs": r"""using System.Linq;
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
    public class ProfileController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ProfileController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetUserId()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdStr, out int userId)) return userId;
            return -1;
        }

        [HttpGet]
        public async Task<IActionResult> GetProfile()
        {
            var userId = GetUserId();
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            return Ok(new
            {
                name = user.FullName,
                role = user.Role,
                bio = user.Profile?.Bio ?? "",
                university = user.Profile?.University ?? "",
                department = user.Profile?.Department ?? "",
                country = user.Profile?.Country ?? "",
                skills = string.IsNullOrEmpty(user.Profile?.Skills) ? new string[0] : user.Profile.Skills.Split(',', System.StringSplitOptions.TrimEntries | System.StringSplitOptions.RemoveEmptyEntries),
                interests = string.IsNullOrEmpty(user.Profile?.Interests) ? new string[0] : user.Profile.Interests.Split(',', System.StringSplitOptions.TrimEntries | System.StringSplitOptions.RemoveEmptyEntries),
                publications = new object[0],
                projects = new object[0]
            });
        }

        public class UpdateProfileRequest
        {
            public string? Bio { get; set; }
            public string? University { get; set; }
            public string? Department { get; set; }
            public string? Country { get; set; }
            public string? Skills { get; set; }
            public string? Interests { get; set; }
        }

        [HttpPut]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
        {
            var userId = GetUserId();
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            if (user.Profile == null)
            {
                user.Profile = new UserProfile { UserId = user.Id };
                _context.UserProfiles.Add(user.Profile);
            }

            if (req.Bio != null) user.Profile.Bio = req.Bio;
            if (req.University != null) user.Profile.University = req.University;
            if (req.Department != null) user.Profile.Department = req.Department;
            if (req.Country != null) user.Profile.Country = req.Country;
            if (req.Skills != null) user.Profile.Skills = req.Skills;
            if (req.Interests != null) user.Profile.Interests = req.Interests;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Profile updated successfully", profile = user.Profile });
        }
    }
}""",

    r"Controllers\SearchController.cs": r"""using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Data;
using ResCollab.Api.Models;
using ResCollab.Api.Services;
using System.Collections.Generic;

namespace ResCollab.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SearchController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        private readonly IResearchConnector _connector;

        public SearchController(ApplicationDbContext context, IResearchConnector connector)
        {
            _context = context;
            _connector = connector;
        }

        [HttpGet]
        public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] string? filter)
        {
            var results = new List<SearchResultDto>();

            // 1. Query Local Database
            var dbQuery = _context.ResearchResources
                .Include(r => r.Tags)
                .AsQueryable();

            if (!string.IsNullOrEmpty(q))
            {
                var lowerQ = q.ToLower();
                dbQuery = dbQuery.Where(r => 
                    r.Title.ToLower().Contains(lowerQ) || 
                    (r.Description != null && r.Description.ToLower().Contains(lowerQ)) ||
                    r.Tags.Any(t => t.Name.ToLower().Contains(lowerQ))
                );
            }

            if (!string.IsNullOrEmpty(filter) && filter != "All")
            {
                var lowerFilter = filter.ToLower();
                // We map frontend filters "Papers" to "Paper"
                var dbTypeFilter = lowerFilter.TrimEnd('s');
                dbQuery = dbQuery.Where(r => r.Type.ToLower() == dbTypeFilter);
            }

            var dbItems = await dbQuery.OrderByDescending(r => r.PublishedDate).Take(10).ToListAsync();

            // Map DB items to DTO
            foreach (var item in dbItems)
            {
                var dto = new SearchResultDto
                {
                    Id = item.Id.ToString(),
                    Title = item.Title,
                    Type = item.Type,
                    Description = item.Description ?? "",
                    Url = item.Url ?? "",
                    PublishedDate = item.PublishedDate,
                    Source = "Local"
                };
                dto.Tags.AddRange(item.Tags.Select(t => t.Name));
                results.Add(dto);
            }

            // 2. Query External API (Crossref)
            if (!string.IsNullOrEmpty(q) && (string.IsNullOrEmpty(filter) || filter == "All" || filter == "Papers"))
            {
                var externalResults = await _connector.SearchAsync(q, 10);
                results.AddRange(externalResults);
            }

            // Return unified result
            return Ok(results);
        }
    }
}""",

    r"Data\ApplicationDbContext.cs": r"""using Microsoft.EntityFrameworkCore;
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
}""",

    r"Models\User.cs": r"""using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ResCollab.Api.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [JsonIgnore]
        public UserProfile? Profile { get; set; }
    }
}""",

    r"Models\UserProfile.cs": r"""using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ResCollab.Api.Models
{
    public class UserProfile
    {
        [Key]
        public int Id { get; set; }

        [ForeignKey("User")]
        public int UserId { get; set; }
        
        [JsonIgnore]
        public User? User { get; set; }

        public string? Bio { get; set; }
        
        [MaxLength(150)]
        public string? University { get; set; }
        
        [MaxLength(150)]
        public string? Department { get; set; }
        
        [MaxLength(100)]
        public string? Country { get; set; }

        public string? Skills { get; set; }
        
        public string? Interests { get; set; }
    }
}""",

    r"Models\ResearchResource.cs": r"""using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ResCollab.Api.Models
{
    public class ResearchResource
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = string.Empty; // "Paper", "Dataset", "Code"

        public string? Description { get; set; }

        public string? Url { get; set; }

        public DateTime PublishedDate { get; set; } = DateTime.UtcNow;

        public ICollection<ResourceTag> Tags { get; set; } = new List<ResourceTag>();
    }

    public class ResourceTag
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        public int ResearchResourceId { get; set; }
        public ResearchResource? ResearchResource { get; set; }
    }
}""",

    r"Models\SearchResultDto.cs": r"""using System;
using System.Collections.Generic;

namespace ResCollab.Api.Models
{
    public class SearchResultDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // "Paper", "Dataset", "Researcher"
        public string Description { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public DateTime PublishedDate { get; set; }
        public string Source { get; set; } = string.Empty; // "Local", "Crossref"
    }
}""",

    r"Services\IResearchConnector.cs": r"""using System.Collections.Generic;
using System.Threading.Tasks;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public interface IResearchConnector
    {
        string ProviderName { get; }
        Task<List<SearchResultDto>> SearchAsync(string query, int limit = 10);
    }
}""",

    r"Services\CrossrefConnector.cs": r"""using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using ResCollab.Api.Models;

namespace ResCollab.Api.Services
{
    public class CrossrefConnector : IResearchConnector
    {
        private readonly HttpClient _httpClient;

        public string ProviderName => "Crossref";

        public CrossrefConnector(HttpClient httpClient)
        {
            _httpClient = httpClient;
            // Crossref asks for contact info in the user-agent for "polite" pool
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "ResCollab/1.0 (mailto:admin@rescollab.local)");
        }

        public async Task<List<SearchResultDto>> SearchAsync(string query, int limit = 10)
        {
            var results = new List<SearchResultDto>();
            
            if (string.IsNullOrWhiteSpace(query))
                return results;

            try
            {
                var url = f"https://api.crossref.org/works?query={Uri.EscapeDataString(query)}&select=title,author,URL,abstract,type,created&rows={limit}";
                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                    return results;

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                
                var items = doc.RootElement.GetProperty("message").GetProperty("items");

                foreach (var item in items.EnumerateArray())
                {
                    var title = item.TryGetProperty("title", out var titleProp) && titleProp.GetArrayLength() > 0 
                        ? titleProp[0].GetString() 
                        : "Untitled Document";

                    var abstractText = item.TryGetProperty("abstract", out var abstractProp) 
                        ? abstractProp.GetString() 
                        : "No abstract available.";

                    // Strip JATS XML tags often returned by Crossref abstracts
                    if (abstractText != null && abstractText.Contains("<jats:"))
                    {
                        abstractText = System.Text.RegularExpressions.Regex.Replace(abstractText, "<.*?>", string.Empty);
                    }

                    var urlVal = item.TryGetProperty("URL", out var urlProp) ? urlProp.GetString() : "";

                    var dto = new SearchResultDto
                    {
                        Id = Guid.NewGuid().ToString(),
                        Title = title ?? "Untitled",
                        Type = "Paper",
                        Description = abstractText ?? "No abstract available.",
                        Url = urlVal ?? "",
                        Source = ProviderName,
                        PublishedDate = DateTime.UtcNow // Fallback, could parse 'created' if needed
                    };
                    
                    dto.Tags.Add(ProviderName); // Add Crossref as a tag
                    
                    results.Add(dto);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Crossref Connector Error: {ex.Message}");
            }

            return results;
        }
    }
}"""
}

for name, content in files.items():
    full = os.path.join(base_path, name)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)

print("Restored")
