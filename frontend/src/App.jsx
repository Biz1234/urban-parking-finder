import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import io from 'socket.io-client';
import jwtDecode from 'jwt-decode'; // Use library instead of manual decode
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const socket = io('http://localhost:5000');

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function App() {
  const [parkingSpots, setParkingSpots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newSpot, setNewSpot] = useState({ location_name: '', latitude: '', longitude: '', total_spots: '' });

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setIsAdmin(decoded.is_admin || false); // Fallback to false if undefined
        fetchParkingSpots();
        fetchBookings();

        socket.on('parkingUpdate', (updatedSpots) => {
          setParkingSpots(updatedSpots);
        });

        return () => {
          socket.off('parkingUpdate');
        };
      } catch (error) {
        console.error('Invalid token:', error);
        setToken(''); // Clear invalid token
        localStorage.removeItem('token');
      }
    }
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

  const fetchBookings = () => {
    axios.get('http://localhost:5000/api/bookings', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => {
        setBookings(response.data);
      })
      .catch((error) => {
        console.error('Error fetching bookings:', error);
      });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setAuthLoading(true);
    axios.post('http://localhost:5000/api/login', { username, password })
      .then((response) => {
        setToken(response.data.token);
        localStorage.setItem('token', response.data.token);
        setUsername('');
        setPassword('');
        setAuthLoading(false);
      })
      .catch((error) => {
        alert(error.response?.data?.error || 'Login failed');
        setAuthLoading(false);
      });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setAuthLoading(true);
    axios.post('http://localhost:5000/api/register', { username, password })
      .then((response) => {
        alert(response.data.message);
        setIsRegistering(false);
        setUsername('');
        setPassword('');
        setAuthLoading(false);
      })
      .catch((error) => {
        alert(error.response?.data?.error || 'Registration failed');
        setAuthLoading(false);
      });
  };

  const handleLogout = () => {
    setToken('');
    setIsAdmin(false);
    localStorage.removeItem('token');
    setParkingSpots([]);
    setBookings([]);
    socket.disconnect();
  };

  const handleBooking = (parkingSpotId) => {
    axios.post('http://localhost:5000/api/book', { parking_spot_id: parkingSpotId }, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => {
        alert(response.data.message);
        fetchBookings();
      })
      .catch((error) => {
        alert(error.response?.data?.error || 'Booking failed');
      });
  };

  const handleCancel = (bookingId) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      axios.post('http://localhost:5000/api/cancel', { booking_id: bookingId }, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((response) => {
          alert(response.data.message);
          fetchBookings();
        })
        .catch((error) => {
          alert(error.response?.data?.error || 'Cancellation failed');
        });
    }
  };

  const handleUpdateSpots = (spotId, currentTotal) => {
    const newTotal = prompt('Enter new total spots:', currentTotal);
    if (newTotal && !isNaN(newTotal) && newTotal >= 0) {
      axios.put(`http://localhost:5000/api/parking/${spotId}`, { total_spots: parseInt(newTotal) }, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((response) => {
          alert(response.data.message);
        })
        .catch((error) => {
          alert(error.response?.data?.error || 'Update failed');
        });
    }
  };

  const handleDeleteSpot = (spotId) => {
    if (window.confirm('Are you sure you want to delete this parking spot?')) {
      axios.delete(`http://localhost:5000/api/parking/${spotId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((response) => {
          alert(response.data.message);
        })
        .catch((error) => {
          alert(error.response?.data?.error || 'Deletion failed');
        });
    }
  };

  const handleCreateSpot = (e) => {
    e.preventDefault();
    axios.post('http://localhost:5000/api/parking', newSpot, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => {
        alert(response.data.message);
        setNewSpot({ location_name: '', latitude: '', longitude: '', total_spots: '' });
      })
      .catch((error) => {
        alert(error.response?.data?.error || 'Creation failed');
      });
  };

  if (!token) {
    return (
      <div className="App">
        <h1>Urban Parking Finder - {isRegistering ? 'Register' : 'Login'}</h1>
        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
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
          <button type="submit" disabled={authLoading}>
            {authLoading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}
          </button>
        </form>
        {authLoading && <div className="spinner"></div>}
        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="toggle-btn"
          disabled={authLoading}
        >
          {isRegistering ? 'Switch to Login' : 'Switch to Register'}
        </button>
      </div>
    );
  }

  if (loading) return <div className="App"><div className="spinner"></div></div>;

  return (
    <div className="App">
      <h1>Urban Parking Finder - Addis Ababa</h1>
      <button onClick={handleLogout} className="logout-btn">Logout</button>
      <MapContainer center={[9.03, 38.74]} zoom={13} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
          attribution='© <a href="https://stadiamaps.com/">Stadia Maps</a>, © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
        />
        {parkingSpots.map((spot) => (
          <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={customIcon}>
            <Popup>
              <strong>{spot.location_name}</strong> <br />
              Available Spots: {spot.available_spots}/{spot.total_spots} <br />
              <button
                onClick={() => handleBooking(spot.id)}
                disabled={spot.available_spots === 0}
              >
                {spot.available_spots > 0 ? 'Book Now' : 'No Spots Available'}
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => handleUpdateSpots(spot.id, spot.total_spots)}
                    className="update-btn"
                  >
                    Update Spots
                  </button>
                  <button
                    onClick={() => handleDeleteSpot(spot.id)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="booking-history">
        <h2>Your Booking History</h2>
        {bookings.length === 0 ? (
          <p>No bookings yet.</p>
        ) : (
          <ul>
            {bookings.map((booking) => (
              <li key={booking.id}>
                {booking.location_name} - Booked on {new Date(booking.booked_at).toLocaleString()}
                <button
                  onClick={() => handleCancel(booking.id)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {isAdmin ? (
        <div className="admin-panel">
          <h2>Admin Panel - Add Parking Spot</h2>
          <form onSubmit={handleCreateSpot}>
            <input
              type="text"
              placeholder="Location Name"
              value={newSpot.location_name}
              onChange={(e) => setNewSpot({ ...newSpot, location_name: e.target.value })}
              required
            />
            <input
              type="number"
              step="0.0001"
              placeholder="Latitude"
              value={newSpot.latitude}
              onChange={(e) => setNewSpot({ ...newSpot, latitude: e.target.value })}
              required
            />
            <input
              type="number"
              step="0.0001"
              placeholder="Longitude"
              value={newSpot.longitude}
              onChange={(e) => setNewSpot({ ...newSpot, longitude: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Total Spots"
              value={newSpot.total_spots}
              onChange={(e) => setNewSpot({ ...newSpot, total_spots: e.target.value })}
              required
            />
            <button type="submit">Add Spot</button>
          </form>
        </div>
      ) : (
        <p>You do not have admin privileges.</p>
      )}
    </div>
  );
}

export default App;