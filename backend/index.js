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
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

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

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Register a new user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (username, password, is_admin) VALUES (?, ?, FALSE)';
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

    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '1h' });
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

// Create a new parking spot (admin only)
app.post('/api/parking', authenticateToken, isAdmin, (req, res) => {
  const { location_name, latitude, longitude, total_spots } = req.body;
  if (!location_name || !latitude || !longitude || !total_spots || total_spots < 0) {
    return res.status(400).json({ error: 'All fields required with valid values' });
  }

  const query = 'INSERT INTO parking_spots (location_name, latitude, longitude, total_spots, available_spots, status) VALUES (?, ?, ?, ?, ?, "active")';
  db.query(query, [location_name, latitude, longitude, total_spots, total_spots], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    const fetchQuery = 'SELECT * FROM parking_spots WHERE status = "active"';
    db.query(fetchQuery, (err, updatedSpots) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch updated spots' });
      io.emit('parkingUpdate', updatedSpots);
      res.json({ message: 'Parking spot created successfully' });
    });
  });
});

// Update a parking spot (admin only)
app.put('/api/parking/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { total_spots } = req.body;

  if (!total_spots || total_spots < 0) return res.status(400).json({ error: 'Valid total_spots required' });

  const updateQuery = 'UPDATE parking_spots SET total_spots = ? WHERE id = ?';
  db.query(updateQuery, [total_spots, id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Parking spot not found' });

    const fetchQuery = 'SELECT * FROM parking_spots WHERE status = "active"';
    db.query(fetchQuery, (err, updatedSpots) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch updated spots' });
      io.emit('parkingUpdate', updatedSpots);
      res.json({ message: 'Parking spot updated successfully' });
    });
  });
});

// Delete a parking spot (admin only)
app.delete('/api/parking/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;

  const deleteQuery = 'UPDATE parking_spots SET status = "inactive" WHERE id = ?';
  db.query(deleteQuery, [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Parking spot not found' });

    const fetchQuery = 'SELECT * FROM parking_spots WHERE status = "active"';
    db.query(fetchQuery, (err, updatedSpots) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch updated spots' });
      io.emit('parkingUpdate', updatedSpots);
      res.json({ message: 'Parking spot deleted successfully' });
    });
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

        const fetchQuery = 'SELECT * FROM parking_spots WHERE status = "active"';
        db.query(fetchQuery, (err, updatedSpots) => {
          if (err) return res.status(500).json({ error: 'Failed to fetch updated spots' });
          io.emit('parkingUpdate', updatedSpots);
          res.json({ message: 'Spot booked successfully' });
        });
      });
    });
  });
});

// Cancel a booking (protected)
app.post('/api/cancel', authenticateToken, (req, res) => {
  const { booking_id } = req.body;
  const user_id = req.user.id;

  const checkQuery = 'SELECT parking_spot_id FROM bookings WHERE id = ? AND user_id = ?';
  db.query(checkQuery, [booking_id, user_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Booking not found or not yours' });

    const parking_spot_id = results[0].parking_spot_id;

    const updateQuery = 'UPDATE parking_spots SET available_spots = available_spots + 1 WHERE id = ?';
    db.query(updateQuery, [parking_spot_id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update spots' });

      const deleteQuery = 'DELETE FROM bookings WHERE id = ?';
      db.query(deleteQuery, [booking_id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to cancel booking' });

        const fetchQuery = 'SELECT * FROM parking_spots WHERE status = "active"';
        db.query(fetchQuery, (err, updatedSpots) => {
          if (err) return res.status(500).json({ error: 'Failed to fetch updated spots' });
          io.emit('parkingUpdate', updatedSpots);
          res.json({ message: 'Booking cancelled successfully' });
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});