const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
 
 
const PORT = 5000;
const JWT_SECRET = 'your-secret-key'; // Change this in production

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

// Create HTTP server and integrate Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Allow front-end origin
    methods: ['GET', 'POST']
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
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
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query(query, [username, hashedPassword], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username already exists' });
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'User registered successfully' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
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

// Book a parking spot (protected)
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

        // Fetch updated parking spots and broadcast to all clients
        const fetchQuery = 'SELECT * FROM parking_spots WHERE status = "active"';
        db.query(fetchQuery, (err, updatedSpots) => {
          if (err) return res.status(500).json({ error: 'Failed to fetch updated spots' });
          io.emit('parkingUpdate', updatedSpots); // Broadcast to all connected clients
          res.json({ message: 'Spot booked successfully' });
        });
      });
    });
  });
});

// Fetch user’s booking history (protected)
app.get('/api/bookings', authenticateToken, (req, res) => {
  const user_id = req.user.id;
  const query = `
    SELECT b.id, b.booked_at, p.location_name 
    FROM bookings b 
    JOIN parking_spots p ON b.parking_spot_id = p.id 
    WHERE b.user_id = ?
    ORDER BY b.booked_at DESC
  `;
  db.query(query, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

app.get('/', (req, res) => {
  res.send('Urban Parking Finder API is running!');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});