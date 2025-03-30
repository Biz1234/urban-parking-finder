const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const PORT = 5000;

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

// Fetch all parking spots
app.get('/api/parking', (req, res) => {
  const query = 'SELECT * FROM parking_spots WHERE status = "active"';
  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// Book a parking spot
app.post('/api/book', (req, res) => {
  const { parking_spot_id } = req.body;

  // Check if the spot is available
  const checkQuery = 'SELECT available_spots FROM parking_spots WHERE id = ? AND status = "active"';
  db.query(checkQuery, [parking_spot_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Parking spot not found' });

    const availableSpots = results[0].available_spots;
    if (availableSpots <= 0) return res.status(400).json({ error: 'No spots available' });

    // Update available spots
    const updateQuery = 'UPDATE parking_spots SET available_spots = available_spots - 1 WHERE id = ?';
    db.query(updateQuery, [parking_spot_id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update spots' });

      // Record the booking (using a dummy user_id for now)
      const insertQuery = 'INSERT INTO bookings (parking_spot_id, user_id) VALUES (?, ?)';
      db.query(insertQuery, [parking_spot_id, 'guest'], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to record booking' });
        res.json({ message: 'Spot booked successfully' });
      });
    });
  });
});

// Test endpoint
app.get('/', (req, res) => {
  res.send('Urban Parking Finder API is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});