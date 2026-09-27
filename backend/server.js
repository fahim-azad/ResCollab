const express = require('express');
const cors = require('cors');
const sql = require('mssql/msnodesqlv8');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
  connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS;Database=ResCollabDB;Trusted_Connection=yes;'
};

// Connect to SQL Server
const pool = new sql.ConnectionPool(dbConfig);
pool.connect().then(() => {
  console.log('Connected to MSSQL Database');
}).catch(err => {
  console.error('Database Connection Failed! Bad Config: ', err);
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Access Denied' });

  const token = authHeader.split(' ')[1];
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid Token' });
  }
};

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, role, password } = req.body;
    
    // Check if user exists
    const checkUser = await pool.request()
      .input('Email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @Email');
      
    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const result = await pool.request()
      .input('FullName', sql.NVarChar, fullName)
      .input('Email', sql.NVarChar, email)
      .input('Role', sql.NVarChar, role)
      .input('PasswordHash', sql.NVarChar, hashedPassword)
      .query('INSERT INTO Users (FullName, Email, Role, PasswordHash) OUTPUT INSERTED.Id VALUES (@FullName, @Email, @Role, @PasswordHash)');

    const userId = result.recordset[0].Id;
    const token = jwt.sign({ id: userId, email, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ token, user: { id: userId, fullName, email, role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const result = await pool.request()
      .input('Email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @Email');
      
    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.recordset[0];

    // Validate password
    const validPassword = await bcrypt.compare(password, user.PasswordHash);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.Id, email: user.Email, role: user.Role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user.Id, fullName: user.FullName, email: user.Email, role: user.Role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Profile Route
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const result = await pool.request()
      .input('Id', sql.Int, req.user.id)
      .query('SELECT Id, FullName, Email, Role, CreatedAt, Bio, University, Department, Country, Skills, Interests FROM Users WHERE Id = @Id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.recordset[0];
    
    const parseArray = (str) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Return combined dynamic + mock data for profile display
    res.json({
      name: user.FullName,
      role: user.Role === 'student' ? 'Research Student' : user.Role === 'researcher' ? 'Researcher' : 'Faculty / Supervisor',
      bio: user.Bio || "Welcome to ResCollab! You can edit this bio later to let others know about your research interests.",
      university: user.University || "Not Specified",
      department: user.Department || "Not Specified",
      country: user.Country || "Global",
      skills: user.Skills ? parseArray(user.Skills) : ["Edit to add skills"],
      interests: user.Interests ? parseArray(user.Interests) : ["Edit to add interests"],
      publications: [],
      projects: []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Profile Route
app.put('/api/profile', verifyToken, async (req, res) => {
  try {
    const { bio, university, department, country, skills, interests } = req.body;
    
    const skillsStr = Array.isArray(skills) ? skills.join(', ') : skills;
    const interestsStr = Array.isArray(interests) ? interests.join(', ') : interests;

    await pool.request()
      .input('Bio', sql.NVarChar(sql.MAX), bio)
      .input('University', sql.NVarChar(100), university)
      .input('Department', sql.NVarChar(100), department)
      .input('Country', sql.NVarChar(100), country)
      .input('Skills', sql.NVarChar(sql.MAX), skillsStr)
      .input('Interests', sql.NVarChar(sql.MAX), interestsStr)
      .input('Id', sql.Int, req.user.id)
      .query(`
        UPDATE Users 
        SET Bio = @Bio, 
            University = @University, 
            Department = @Department, 
            Country = @Country, 
            Skills = @Skills, 
            Interests = @Interests 
        WHERE Id = @Id
      `);

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
