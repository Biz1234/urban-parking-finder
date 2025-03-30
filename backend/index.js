const express = require('express');
const mysql = require('mysql2');
const app = express();
const PORT = 5000;

app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'mysql', // Default AMPPS password
  database: 'urban_parking'
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

app.get('/', (req, res) => {
  res.send('Urban Parking Finder API is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});