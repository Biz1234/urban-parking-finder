import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import './App.css';

function App() {
  const [parkingSpots, setParkingSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (token) fetchParkingSpots();
  }, [token]);

  const fetchParkingSpots = () => {
    axios.get('http://localhost:5000/api/parking')
      .then((response) => {
        setParkingSpots(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching parking spots:', error);
        setLoading(false);
      });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    axios.post('http://localhost:5000/api/login', { username, password })
      .then((response) => {
        setToken(response.data.token);
        localStorage.setItem('token', response.data.token);
        setUsername('');
        setPassword('');
        fetchParkingSpots();
      })
      .catch((error) => {
        alert(error.response?.data?.error || 'Login failed');
      });
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setParkingSpots([]);
  };

  const handleBooking = (parkingSpotId) => {
    axios.post('http://localhost:5000/api/book', { parking_spot_id: parkingSpotId }, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => {
        alert(response.data.message);
        fetchParkingSpots();
      })
      .catch((error) => {
        alert(error.response?.data?.error || 'Booking failed');
      });
  };

  if (!token) {
    return (
      <div className="App">
        <h1>Urban Parking Finder - Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Login</button>
        </form>
        <p>Hint: Register with POST to /api/register if you don’t have an account.</p>
      </div>
    );
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="App">
      <h1>Urban Parking Finder - Addis Ababa</h1>
      <button onClick={handleLogout} className="logout-btn">Logout</button>
      <MapContainer center={[9.03, 38.74]} zoom={13} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {parkingSpots.map((spot) => (
          <Marker key={spot.id} position={[spot.latitude, spot.longitude]}>
            <Popup>
              <strong>{spot.location_name}</strong> <br />
              Available Spots: {spot.available_spots}/{spot.total_spots} <br />
              <button
                onClick={() => handleBooking(spot.id)}
                disabled={spot.available_spots === 0}
              >
                {spot.available_spots > 0 ? 'Book Now' : 'No Spots Available'}
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;