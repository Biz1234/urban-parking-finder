import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import './App.css';

function App() {
  const [parkingSpots, setParkingSpots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch parking spots from the back-end
    axios.get('http://localhost:5000/api/parking')
      .then((response) => {
        setParkingSpots(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching parking spots:', error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="App">
      <h1>Urban Parking Finder - Addis Ababa</h1>
      <MapContainer center={[9.03, 38.74]} zoom={13} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {parkingSpots.map((spot) => (
          <Marker key={spot.id} position={[spot.latitude, spot.longitude]}>
            <Popup>
              {spot.location_name} <br />
              Available Spots: {spot.available_spots}/{spot.total_spots}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;