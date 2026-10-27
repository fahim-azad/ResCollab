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

            // Funding Opportunities Seeding
            bool hasFunding = await context.FundingOpportunities.AnyAsync();
            if (!hasFunding)
            {
                var alan = await context.Users.FirstOrDefaultAsync(u => u.Email == "alan@mit.edu");
                int? postedById = alan?.Id;

                var opp1 = new FundingOpportunity
                {
                    Title = "NSF Graduate Research Fellowship Program (GRFP)",
                    Provider = "National Science Foundation (NSF)",
                    FundingType = "Fellowship",
                    FundingAmount = "$37,000 / year + $12,000 tuition allowance",
                    ResearchArea = "Computer Science, Engineering, STEM",
                    Status = "Open",
                    Deadline = DateTime.UtcNow.AddDays(45),
                    Description = "The NSF GRFP recognizes and supports outstanding graduate students pursuing research-based master's and doctoral degrees in NSF-supported science, technology, engineering, and mathematics disciplines.",
                    Eligibility = "Early-stage graduate students or senior undergraduates who are US citizens, nationals, or permanent residents.",
                    Requirements = "Personal, Relevant Background and Future Goals Statement (3 pages); Graduate Research Plan Statement (2 pages); 3 Reference Letters; Academic Transcripts.",
                    ApplicationUrl = "https://www.nsfgrfp.org",
                    ApplicationInfo = "Applications must be submitted through Research.gov. Review criteria evaluate Intellectual Merit and Broader Impacts.",
                    PostedById = postedById
                };

                var opp2 = new FundingOpportunity
                {
                    Title = "Horizon Europe Research Grant on Foundation Models & Trustworthy AI",
                    Provider = "European Commission",
                    FundingType = "Grant",
                    FundingAmount = "Up to €2,500,000 per consortium",
                    ResearchArea = "Artificial Intelligence, Data Science, Ethics",
                    Status = "Open",
                    Deadline = DateTime.UtcNow.AddDays(90),
                    Description = "Collaborative research grant aimed at advancing trustworthy, privacy-preserving, and foundation model AI architectures for healthcare and sustainable industries across European institutions.",
                    Eligibility = "Consortia of at least 3 independent legal entities from different EU Member States or Associated Countries.",
                    Requirements = "Consortium agreement, project proposal (Parts A and B), detailed work packages, ethics self-assessment, and milestone deliverables.",
                    ApplicationUrl = "https://ec.europa.eu/info/funding-tenders",
                    ApplicationInfo = "Proposals must be submitted through the EU Funding & Tenders Portal prior to 17:00 Brussels time on the deadline date.",
                    PostedById = postedById
                };

                var opp3 = new FundingOpportunity
                {
                    Title = "Google PhD Fellowship in Systems and Machine Learning",
                    Provider = "Google Research",
                    FundingType = "Fellowship",
                    FundingAmount = "$50,000 stipend + Google Research Mentor",
                    ResearchArea = "Machine Learning, Distributed Systems, Cloud",
                    Status = "Open",
                    Deadline = DateTime.UtcNow.AddDays(60),
                    Description = "Google PhD Fellowships directly support graduate students doing exceptional research in computer science and related fields, connecting them with a Google Research Mentor.",
                    Eligibility = "Full-time graduate students currently enrolled in a PhD program at an accredited university.",
                    Requirements = "CV, research proposal (maximum 3 pages), 3 letters of recommendation, department nomination form.",
                    ApplicationUrl = "https://research.google/outreach/phd-fellowship",
                    ApplicationInfo = "Nominations must be made by the university department. Direct applications from individual students are not accepted.",
                    PostedById = postedById
                };

                var opp4 = new FundingOpportunity
                {
                    Title = "NIH R01 Research Project Grant in Computational Biology & Genomics",
                    Provider = "National Institutes of Health (NIH)",
                    FundingType = "Grant",
                    FundingAmount = "Up to $500,000 / year (up to 5 years)",
                    ResearchArea = "Biomedical & Health, Computational Biology, Bioinformatics",
                    Status = "Open",
                    Deadline = DateTime.UtcNow.AddDays(120),
                    Description = "The NIH Research Project Grant supports discrete, specified research projects in scientific areas representing investigators' specific interests and competencies.",
                    Eligibility = "Qualified investigators holding faculty or research scientist appointments at universities, medical schools, or independent research institutes.",
                    Requirements = "Specific Aims (1 page), Research Strategy (12 pages), Biosketch in NIH format, Budget justification, Resource sharing plan.",
                    ApplicationUrl = "https://grants.nih.gov/grants/funding/r01.htm",
                    ApplicationInfo = "Standard submission cycle via ASSIST or Grants.gov workspace. Requires institutional eRA Commons registration.",
                    PostedById = postedById
                };

                var opp5 = new FundingOpportunity
                {
                    Title = "Gates Cambridge Scholarship for International Postgraduate Study",
                    Provider = "Bill & Melinda Gates Foundation",
                    FundingType = "Scholarship",
                    FundingAmount = "Full tuition + £20,000 / year maintenance stipend",
                    ResearchArea = "All Academic Disciplines",
                    Status = "Open",
                    Deadline = DateTime.UtcNow.AddDays(30),
                    Description = "Prestigious, competitive scholarships awarded to outstanding applicants from countries outside the UK to pursue a full-time postgraduate degree in any subject available at the University of Cambridge.",
                    Eligibility = "Citizens of any country outside the United Kingdom applying to pursue a PhD, MSc, or MLitt at the University of Cambridge.",
                    Requirements = "Gates Cambridge statement (500 words), research proposal, academic transcripts, two academic references, one personal reference.",
                    ApplicationUrl = "https://www.gatescambridge.org/apply",
                    ApplicationInfo = "Apply through the University of Cambridge Graduate Admissions portal selecting the Gates Cambridge funding option.",
                    PostedById = postedById
                };

                context.FundingOpportunities.AddRange(opp1, opp2, opp3, opp4, opp5);
                await context.SaveChangesAsync();
            }

            // Sprint 6 - Academic Events & CFP Discovery Seeding
            bool hasEvents = await context.AcademicEvents.AnyAsync();
            if (!hasEvents)
            {
                var alan = await context.Users.FirstOrDefaultAsync(u => u.Email == "alan@mit.edu");
                int? postedById = alan?.Id;

                var ev1 = new AcademicEvent
                {
                    Title = "IEEE International Conference on Computer Vision (ICCV 2027)",
                    Organizer = "IEEE Computer Society & CVF",
                    EventType = "Conference",
                    Description = "The premier international computer vision event comprising the main conference and several co-located workshops and tutorials. Papers are invited covering generative modeling, 3D perception, multi-modal representation, and robotics vision.",
                    FieldOfStudy = "Computer Vision & Artificial Intelligence",
                    Location = "Venice Convention Center, Venice, Italy",
                    IsVirtual = false,
                    StartDate = DateTime.UtcNow.AddDays(90),
                    EndDate = DateTime.UtcNow.AddDays(95),
                    SubmissionDeadline = DateTime.UtcNow.AddDays(25),
                    RegistrationDeadline = DateTime.UtcNow.AddDays(60),
                    WebsiteUrl = "https://iccv2027.thecvf.com",
                    RegistrationUrl = "https://iccv2027.thecvf.com/registration",
                    Source = "IEEE Conference Portal",
                    Status = "Upcoming",
                    PostedById = postedById,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var ev2 = new AcademicEvent
                {
                    Title = "NeurIPS 2026: Conference on Neural Information Processing Systems",
                    Organizer = "NeurIPS Foundation",
                    EventType = "Conference",
                    Description = "A top-tier multidisciplinary conference fostering the exchange of research on neural information processing systems in their biological, technological, mathematical, and cognitive aspects.",
                    FieldOfStudy = "Machine Learning & Deep Learning",
                    Location = "Vancouver Convention Centre, Vancouver, Canada",
                    IsVirtual = true,
                    StartDate = DateTime.UtcNow.AddDays(70),
                    EndDate = DateTime.UtcNow.AddDays(76),
                    SubmissionDeadline = DateTime.UtcNow.AddDays(14),
                    RegistrationDeadline = DateTime.UtcNow.AddDays(45),
                    WebsiteUrl = "https://neurips.cc",
                    RegistrationUrl = "https://neurips.cc/Register",
                    Source = "NeurIPS Ingestion",
                    Status = "Upcoming",
                    PostedById = postedById,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var ev3 = new AcademicEvent
                {
                    Title = "ACM SIGKDD Conference on Knowledge Discovery and Data Mining",
                    Organizer = "ACM SIGKDD",
                    EventType = "Conference",
                    Description = "The premier interdisciplinary conference bringing together researchers and practitioners from data science, data mining, large language models, knowledge graphs, and big data systems.",
                    FieldOfStudy = "Data Science & Big Data",
                    Location = "Suntec Singapore Convention & Exhibition Centre, Singapore",
                    IsVirtual = false,
                    StartDate = DateTime.UtcNow.AddDays(110),
                    EndDate = DateTime.UtcNow.AddDays(115),
                    SubmissionDeadline = DateTime.UtcNow.AddDays(40),
                    RegistrationDeadline = DateTime.UtcNow.AddDays(80),
                    WebsiteUrl = "https://kdd.org/kdd2026",
                    RegistrationUrl = "https://kdd.org/kdd2026/registration",
                    Source = "ACM Digital Library",
                    Status = "Upcoming",
                    PostedById = postedById,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var ev4 = new AcademicEvent
                {
                    Title = "Nature Symposium on Computational Biology & Genomic Medicine",
                    Organizer = "Nature Portfolio & Harvard Medical School",
                    EventType = "Symposium",
                    Description = "Highlighting breakthroughs at the intersection of AI foundation models, structural biology, gene editing, and precision oncology therapeutics.",
                    FieldOfStudy = "Biomedical & Healthcare",
                    Location = "Joseph B. Martin Conference Center, Boston, MA, USA",
                    IsVirtual = true,
                    StartDate = DateTime.UtcNow.AddDays(45),
                    EndDate = DateTime.UtcNow.AddDays(47),
                    SubmissionDeadline = DateTime.UtcNow.AddDays(6),
                    RegistrationDeadline = DateTime.UtcNow.AddDays(30),
                    WebsiteUrl = "https://nature.com/events/genomics-2026",
                    RegistrationUrl = "https://nature.com/events/genomics-2026/register",
                    Source = "Nature Academic Events",
                    Status = "Upcoming",
                    PostedById = postedById,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var ev5 = new AcademicEvent
                {
                    Title = "International Workshop on Quantum Systems and Algorithms (IWQSA)",
                    Organizer = "IEEE Quantum Initiative",
                    EventType = "Workshop",
                    Description = "Focused on quantum error correction, fault-tolerant quantum algorithms, NISQ-era optimization, and quantum chemistry simulations.",
                    FieldOfStudy = "Quantum Computing",
                    Location = "ETH Zurich, Zurich, Switzerland",
                    IsVirtual = true,
                    StartDate = DateTime.UtcNow.AddDays(65),
                    EndDate = DateTime.UtcNow.AddDays(67),
                    SubmissionDeadline = DateTime.UtcNow.AddDays(18),
                    RegistrationDeadline = DateTime.UtcNow.AddDays(50),
                    WebsiteUrl = "https://quantum.ieee.org/events/iwqsa2026",
                    RegistrationUrl = "https://quantum.ieee.org/events/iwqsa2026/tickets",
                    Source = "WikiCFP Ingestion",
                    Status = "Upcoming",
                    PostedById = postedById,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var ev6 = new AcademicEvent
                {
                    Title = "Global Seminar on Ethical AI Governance and Algorithmic Auditing",
                    Organizer = "Oxford Internet Institute & Stanford HAI",
                    EventType = "Seminar",
                    Description = "Discussion forum on international regulatory standards, bias mitigation benchmarks, copyright in foundation models, and explainable AI in public institutions.",
                    FieldOfStudy = "AI Ethics & Public Policy",
                    Location = "Oxford, UK & Global Virtual Stream",
                    IsVirtual = true,
                    StartDate = DateTime.UtcNow.AddDays(15),
                    EndDate = DateTime.UtcNow.AddDays(16),
                    SubmissionDeadline = DateTime.UtcNow.AddDays(3),
                    RegistrationDeadline = DateTime.UtcNow.AddDays(10),
                    WebsiteUrl = "https://oii.ox.ac.uk/events/ethical-ai-2026",
                    RegistrationUrl = "https://oii.ox.ac.uk/events/ethical-ai-2026/rsvp",
                    Source = "Manual Submission",
                    Status = "Upcoming",
                    PostedById = postedById,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var ev7 = new AcademicEvent
                {
                    Title = "Call for Papers: IEEE TPAMI Special Issue on Multimodal Foundation Models",
                    Organizer = "IEEE Computer Society",
                    EventType = "CallForPapers",
                    Description = "Call for original contributions addressing cross-modal alignment, vision-language-action models, video generation, and robust benchmark evaluations.",
                    FieldOfStudy = "Computer Vision & Artificial Intelligence",
                    Location = "Special Issue Journal Publication",
                    IsVirtual = true,
                    StartDate = DateTime.UtcNow.AddDays(20),
                    EndDate = DateTime.UtcNow.AddDays(180),
                    SubmissionDeadline = DateTime.UtcNow.AddDays(21),
                    RegistrationDeadline = null,
                    WebsiteUrl = "https://computer.org/tpami/cfp-multimodal",
                    RegistrationUrl = "https://mc.manuscriptcentral.com/tpami-cs",
                    Source = "IEEE TPAMI CFP Board",
                    Status = "Upcoming",
                    PostedById = postedById,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                context.AcademicEvents.AddRange(ev1, ev2, ev3, ev4, ev5, ev6, ev7);
                await context.SaveChangesAsync();
            }

            // Ensure an Administrator/Moderator user exists
            bool hasAdmin = await context.Users.AnyAsync(u => u.Role == "Admin");
            User? adminUser = null;
            if (!hasAdmin)
            {
                adminUser = new User
                {
                    FullName = "Platform Administrator",
                    Email = "admin@rescollab.edu",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                    Role = "Admin",
                    Profile = new UserProfile
                    {
                        Bio = "Lead Research Ethics Officer and System Administrator.",
                        University = "ResCollab Consortium",
                        Department = "Research Integrity Office",
                        Interests = "Academic Ethics, Research Integrity, Moderation"
                    }
                };
                context.Users.Add(adminUser);
                await context.SaveChangesAsync();
            }
            else
            {
                adminUser = await context.Users.FirstOrDefaultAsync(u => u.Role == "Admin");
            }

            // Sprint 6 - Content Moderation & Reporting Seeding
            bool hasReports = await context.ReportSubmissions.AnyAsync();
            if (!hasReports)
            {
                var alice = await context.Users.FirstOrDefaultAsync(u => u.Email == "alice@student.edu");
                var alan = await context.Users.FirstOrDefaultAsync(u => u.Email == "alan@mit.edu");
                var bob = await context.Users.FirstOrDefaultAsync(u => u.Email == "bob@student.edu");

                if (alice != null && alan != null && bob != null)
                {
                    var rep1 = new ReportSubmission
                    {
                        ReporterId = alice.Id,
                        TargetType = "CommunityPost",
                        TargetId = 1,
                        ReportedUserId = alan.Id,
                        Reason = "Plagiarism",
                        Description = "The discussion post cites novel benchmark findings from an uncredited arXiv paper without proper author attribution or DOI.",
                        Status = "Pending",
                        ActionTaken = "None",
                        SubmittedAt = DateTime.UtcNow.AddHours(-18)
                    };

                    var rep2 = new ReportSubmission
                    {
                        ReporterId = bob.Id,
                        TargetType = "CommunityComment",
                        TargetId = 1,
                        ReportedUserId = alice.Id,
                        Reason = "Harassment",
                        Description = "Targeted dismissive remarks and personal attacks in discussion thread violating community guidelines.",
                        Status = "UnderReview",
                        ModeratorId = adminUser?.Id,
                        ActionTaken = "None",
                        SubmittedAt = DateTime.UtcNow.AddDays(-2)
                    };

                    var rep3 = new ReportSubmission
                    {
                        ReporterId = alice.Id,
                        TargetType = "User",
                        TargetId = bob.Id,
                        ReportedUserId = bob.Id,
                        Reason = "Spam",
                        Description = "Repeated commercial service promotion and unsolicited tutoring solicitations in research channels.",
                        Status = "Resolved",
                        ModeratorId = adminUser?.Id,
                        ResolutionNote = "Official warning issued. Promotional links removed.",
                        ActionTaken = "WarningIssued",
                        SubmittedAt = DateTime.UtcNow.AddDays(-5),
                        ResolvedAt = DateTime.UtcNow.AddDays(-3)
                    };

                    context.ReportSubmissions.AddRange(rep1, rep2, rep3);
                    await context.SaveChangesAsync();

                    if (adminUser != null)
                    {
                        var audit = new ModerationAuditLog
                        {
                            ReportId = rep3.Id,
                            ModeratorId = adminUser.Id,
                            PreviousStatus = "UnderReview",
                            NewStatus = "Resolved",
                            ActionDetails = "Decision: Resolved | Action: WarningIssued | Note: Official warning issued.",
                            Timestamp = DateTime.UtcNow.AddDays(-3)
                        };
                        context.ModerationAuditLogs.Add(audit);
                        await context.SaveChangesAsync();
                    }
                }
            }
        }
    }
}
