const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = 5000;
const JWT_SECRET = 'your-secret-key'; // Change this to a secure key in production

app.use(express.json());
app.use(cors());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'mysql',
  database: 'urban_parking'
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Expecting "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Register a new user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
  db.query(query, [username, hashedPassword], (err) => {
    if (err) return res.status(400).json({ error: 'Username already exists' });
    res.json({ message: 'User registered successfully' });
  });
});

// Login a user
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM users WHERE username = ?';
  db.query(query, [username], async (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  });
});

// Fetch all parking spots
app.get('/api/parking', (req, res) => {
  const query = 'SELECT * FROM parking_spots WHERE status = "active"';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Book a parking spot (protected route)
app.post('/api/book', authenticateToken, (req, res) => {
  const { parking_spot_id } = req.body;
  const user_id = req.user.id;

  const checkQuery = 'SELECT available_spots FROM parking_spots WHERE id = ? AND status = "active"';
  db.query(checkQuery, [parking_spot_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Parking spot not found' });

    const availableSpots = results[0].available_spots;
    if (availableSpots <= 0) return res.status(400).json({ error: 'No spots available' });

    const updateQuery = 'UPDATE parking_spots SET available_spots = available_spots - 1 WHERE id = ?';
    db.query(updateQuery, [parking_spot_id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update spots' });

      const insertQuery = 'INSERT INTO bookings (parking_spot_id, user_id) VALUES (?, ?)';
      db.query(insertQuery, [parking_spot_id, user_id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to record booking' });
        res.json({ message: 'Spot booked successfully' });
      });
    });
  });
});

app.get('/', (req, res) => {
  res.send('Urban Parking Finder API is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});