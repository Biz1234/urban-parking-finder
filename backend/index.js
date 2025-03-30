const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(express.json());
app.use(cors()); // Enable CORS for all routes

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

// API endpoint to fetch all parking spots
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

app.get('/', (req, res) => {
  res.send('Urban Parking Finder API is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});