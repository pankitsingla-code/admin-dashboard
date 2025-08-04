import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ref, get } from 'firebase/database';
import { db } from '../services/firebase'; // ✅ Import Firebase Realtime DB

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const HotStoppagesMap = ({ hotStops, onClose }) => {
  
  const [filteredStops, setFilteredStops] = useState([]);

  const center = filteredStops.length > 0
    ? [filteredStops[0].latitude, filteredStops[0].longitude]
    : [30.7333, 76.7794];

  const openInGoogleMaps = (lat, lng) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    if (window.confirm('Open Google Maps for navigation?')) {
      window.open(url, '_blank');
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snapshot = await get(ref(db, 'config/minHotstopFrequency'));
        const min = snapshot.exists() ? snapshot.val() : 1;
        

        const filtered = hotStops.filter((stop) => stop.frequency >= min);
        setFilteredStops(filtered);
      } catch (err) {
        console.error('Failed to fetch config:', err);
        setFilteredStops(hotStops); // fallback if error
      }
    };

    fetchConfig();
  }, [hotStops]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          zIndex: 1000,
          top: 10,
          right: 10,
          padding: '8px 12px',
          background: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
        }}
      >
        Close Map
      </button>

      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '80vh', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {filteredStops.map((stop, index) => (
          <Marker key={index} position={[stop.latitude, stop.longitude]}>
            <Popup>
              🔥 Hot Stoppage<br />
              Lat: {stop.latitude.toFixed(5)}<br />
              Lng: {stop.longitude.toFixed(5)}<br />
              Frequency: {stop.frequency}<br />
              <button onClick={() => openInGoogleMaps(stop.latitude, stop.longitude)}>
                Navigate
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default HotStoppagesMap;
