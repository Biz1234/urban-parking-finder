import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import './App.css';

function App() {
  const [parkingSpots, setParkingSpots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParkingSpots();
  }, []);

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

  const handleBooking = (parkingSpotId) => {
    axios.post('http://localhost:5000/api/book', { parking_spot_id: parkingSpotId })
      .then((response) => {
        alert(response.data.message); // Show success message
        fetchParkingSpots(); // Refresh the map data
      })
      .catch((error) => {
        alert(error.response?.data?.error || 'Booking failed'); // Show error message
      });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="App">
      <h1>Urban Parking Finder - Addis Ababa</h1>
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