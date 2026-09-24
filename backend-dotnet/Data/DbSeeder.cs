using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ResCollab.Api.Models;

namespace ResCollab.Api.Data
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(ApplicationDbContext context)
        {
            // Ensure database is created
            await context.Database.MigrateAsync();

            // Note: We changed from AnyAsync() to checking specific users so we can incrementally add seeds.
            bool hasAlice = await context.Users.AnyAsync(u => u.Email == "alice@student.edu");
            if (!hasAlice)
            {

            // 1. Create a Test Student
            var student = new User
            {
                FullName = "Alice Student",
                Email = "alice@student.edu",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                Role = "Student",
                Profile = new UserProfile
                {
                    Bio = "I am a passionate student looking for a supervisor in Artificial Intelligence.",
                    University = "MIT",
                    Department = "Computer Science",
                    Interests = "Artificial Intelligence, Machine Learning, Robotics"
                }
            };

            // 2. Create a PERFECT MATCH Supervisor (+17 points)
            var perfectSupervisor = new User
            {
                FullName = "Dr. Alan Turing",
                Email = "alan@mit.edu",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                Role = "Supervisor",
                Profile = new UserProfile
                {
                    Bio = "Head of AI Lab. I love working with students on deep learning.",
                    University = "MIT",
                    Department = "Computer Science",
                    Interests = "Artificial Intelligence, Deep Learning, Data Science",
                    IsAcceptingStudents = true
                }
            };

            // 3. Create a LOW MATCH Supervisor (+2 points for University only)
            var lowSupervisor = new User
            {
                FullName = "Dr. Marie Curie",
                Email = "marie@mit.edu",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                Role = "Supervisor",
                Profile = new UserProfile
                {
                    Bio = "Physics and Radiation researcher.",
                    University = "MIT",
                    Department = "Physics",
                    Interests = "Quantum Physics, Chemistry",
                    IsAcceptingStudents = true
                }
            };

            // 4. Create an INVISIBLE Supervisor (Not accepting students - should NOT appear)
            var invisibleSupervisor = new User
            {
                FullName = "Dr. Hidden Boss",
                Email = "hidden@mit.edu",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                Role = "Supervisor",
                Profile = new UserProfile
                {
                    Bio = "I am currently on sabbatical and not accepting any students.",
                    University = "MIT",
                    Department = "Computer Science",
                    Interests = "Artificial Intelligence",
                    IsAcceptingStudents = false
                }
            };

                context.Users.AddRange(student, perfectSupervisor, lowSupervisor, invisibleSupervisor);
                await context.SaveChangesAsync();
            }

            // Teammate Seeding
            bool hasBob = await context.Users.AnyAsync(u => u.Email == "bob@student.edu");
            if (!hasBob)
            {
                var teammateBob = new User
                {
                    FullName = "Bob Teammate",
                    Email = "bob@student.edu",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                    Role = "Student",
                    Profile = new UserProfile
                    {
                        Bio = "I love AI but I specialize in backend systems.",
                        University = "MIT",
                        Department = "Computer Science",
                        Interests = "Artificial Intelligence, Distributed Systems",
                        Skills = "C#, .NET, SQL Server"
                    }
                };

                var teammateCharlie = new User
                {
                    FullName = "Charlie UI/UX",
                    Email = "charlie@student.edu",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                    Role = "Student",
                    Profile = new UserProfile
                    {
                        Bio = "Designing beautiful interfaces for AI tools.",
                        University = "MIT",
                        Department = "Design",
                        Interests = "Artificial Intelligence, Human-Computer Interaction",
                        Skills = "Figma, React, CSS"
                    }
                };

                var teammateDavid = new User
                {
                    FullName = "David Biology",
                    Email = "david@student.edu",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                    Role = "Student",
                    Profile = new UserProfile
                    {
                        Bio = "I have no idea what AI is.",
                        University = "Harvard",
                        Department = "Biology",
                        Interests = "Genetics, Cell Biology",
                        Skills = "Microscopy, Lab Research"
                    }
                };

                context.Users.AddRange(teammateBob, teammateCharlie, teammateDavid);
                await context.SaveChangesAsync();
            }
        }
    }
}
