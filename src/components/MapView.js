import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ref, get } from "firebase/database";
import { db } from "../services/firebase";
import { createPath } from "react-router-dom";

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Haversine distance in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Offset coordinates slightly to prevent marker overlap
function offsetCoordinate(lat, lng, index, scale = 0.00005) {
  const angle = (index * 45) * (Math.PI / 180);
  return [lat + Math.sin(angle) * scale, lng + Math.cos(angle) * scale];
}

const MapView = ({ data }) => {
  const [routeCoords, setRouteCoords] = useState([]);
  const [approvedRouteCoords, setApprovedRouteCoords] = useState([]);
  const [startCoord, setStartCoord] = useState(null);
  const [endCoord, setEndCoord] = useState(null);
  const [stoppages, setStoppages] = useState([]);
  const [deviations, setDeviations] = useState([]);
  const [hotStoppages, setHotStoppages] = useState([]);
  const [highlightedStops, setHighlightedStops] = useState([]);
  const [frequencyThreshold, setFrequencyThreshold] = useState(30);
  const [deviationRadiusThreshold, setDeviationRadiusThreshold] = useState(200);

  // Fetch config once
  useEffect(() => {
    const fetchConfig = async () => {
      const freqSnap = await get(ref(db, "config/minHotstopFrequency"));
      const radSnap = await get(ref(db, "config/deviationRadius"));
      if (freqSnap.exists()) {
        const value = Number(freqSnap.val());
        setFrequencyThreshold(value);
        console.log("🔥 Firebase frequency threshold:", value);
      }

      if (radSnap.exists()) {
        const value1 = Number(radSnap.val());
        setDeviationRadiusThreshold(value1);
        
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const sorted = [...data].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    const coords = sorted.map((p) => [p.latitude, p.longitude]);
    setRouteCoords(coords);
    setStartCoord(coords[0]);
    setEndCoord(coords[coords.length - 1]);

    // Stoppage detection
    const stops = [];
    let anchor = sorted[0];
    let inStoppage = false;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const sameLocation =
        prev.latitude === curr.latitude && prev.longitude === curr.longitude;

      if (sameLocation) {
        const duration = new Date(curr.timestamp) - new Date(anchor.timestamp);
        if (duration >= 5 * 60 * 1000) {
          inStoppage = true;
        }
      } else {
        if (inStoppage) {
          stops.push({
            lat: anchor.latitude,
            lng: anchor.longitude,
            startTime: anchor.timestamp,
            endTime: prev.timestamp,
          });
        }
        anchor = curr;
        inStoppage = false;
      }
    }

    const last = sorted[sorted.length - 1];
    if (
      inStoppage &&
      last.latitude === anchor.latitude &&
      last.longitude === anchor.longitude
    ) {
      stops.push({
        lat: anchor.latitude,
        lng: anchor.longitude,
        startTime: anchor.timestamp,
        endTime: last.timestamp,
      });
    }

    setStoppages(stops);

    // Approved route & deviation
    const customerCode = sorted[0]?.customerCode;
    if (customerCode) {
      fetch(`/approved_routes/${customerCode}.json`)
        .then((res) => res.json())
        .then((approvedData) => {
          if (Array.isArray(approvedData.route)) {
            const approvedCoords = approvedData.route.map(([lat, lng]) => [
              lat,
              lng,
            ]);
            setApprovedRouteCoords(approvedCoords);

            const deviationSegments = [];
            let deviating = false;
            let deviationStart = null;

            for (let i = 0; i < coords.length; i++) {
              const [alat, alng] = coords[i];
              const near = approvedCoords.some(([plat, plng]) => {
                return haversineDistance(alat, alng, plat, plng) < 100;
              });

              if (!near) {
                if (!deviating) {
                  deviationStart = { lat: alat, lng: alng, index: i };
                  deviating = true;
                }
              } else {
                if (deviating) {
                  deviationSegments.push({
                    start: deviationStart,
                    end: { lat: alat, lng: alng, index: i },
                  });
                  deviating = false;
                  deviationStart = null;
                }
              }
            }

            if (deviating && deviationStart) {
              deviationSegments.push({
                start: deviationStart,
                end: {
                  lat: coords[coords.length - 1][0],
                  lng: coords[coords.length - 1][1],
                  index: coords.length - 1,
                },
              });
            }

            setDeviations(deviationSegments);
          }
        })
        .catch((err) =>
          console.error("Failed to load approved route:", err)
        );
    }

    // Load hot stoppages
    fetch(
      "https://firebasestorage.googleapis.com/v0/b/grm-app-3d8ab.firebasestorage.app/o/hot_stoppages.json?alt=media"
    )
      .then((res) => res.json())
      .then((hotStops) => {
        
        const filtered = hotStops.filter(
          (s) => s.frequency >= frequencyThreshold
        );
        setHotStoppages(filtered);

        const matched = stops.filter((stop) =>
          filtered.some((hs) => {
            const dist = haversineDistance(
              stop.lat,
              stop.lng,
              hs.latitude,
              hs.longitude
            );
            console.log("deviation radius",deviationRadiusThreshold);
            return dist <= deviationRadiusThreshold;
          })
        );
        setHighlightedStops(matched);
      })
      .catch((err) => {
        console.error("Failed to fetch hot stoppages:", err);
      });
  }, [data, frequencyThreshold, deviationRadiusThreshold]);


  const openInGoogleMaps = (lat, lng) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    if (window.confirm("Open Google Maps for navigation?")) {
      window.open(url, "_blank");
    }
  };

  if (!startCoord || !endCoord) return <div>Loading map...</div>;

  return (
    <div style={{ position: "relative" }}>
      <MapContainer
        center={startCoord}
        key={startCoord.toString()}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: "80vh", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Polyline positions={routeCoords} color="blue" />
        {approvedRouteCoords.length > 0 && (
          <Polyline
            positions={approvedRouteCoords}
            color="green"
            dashArray="5,10"
          />
        )}

        <Marker position={startCoord}>
          <Popup>
            Start Point<br />
            {data[0]?.timestamp}<br />
            Lat: {startCoord[0]}<br />
            Lng: {startCoord[1]}<br />
            <button onClick={() => openInGoogleMaps(...startCoord)}>
              Navigate
            </button>
          </Popup>
        </Marker>

        <Marker position={offsetCoordinate(endCoord[0], endCoord[1], 999)}>
          <Popup>
            End Point<br />
            {data[data.length - 1]?.timestamp}<br />
            Lat: {endCoord[0]}<br />
            Lng: {endCoord[1]}<br />
            <button onClick={() => openInGoogleMaps(...endCoord)}>
              Navigate
            </button>
          </Popup>
        </Marker>

        {stoppages.map((stop, idx) => (
          <Marker
            key={`stop-${idx}`}
            position={offsetCoordinate(stop.lat, stop.lng, idx + 200)}
          >
            <Popup>
              ⏸️ Stoppage<br />
              From: {stop.startTime}<br />
              To: {stop.endTime}<br />
              Lat: {stop.lat}<br />
              Lng: {stop.lng}<br />
              Duration:{" "}
              {Math.round(
                (new Date(stop.endTime) - new Date(stop.startTime)) / 60000
              )}{" "}
              mins<br />
              <button onClick={() => openInGoogleMaps(stop.lat, stop.lng)}>
                Navigate
              </button>
            </Popup>
          </Marker>
        ))}

        {deviations.map((dev, idx) => (
          <React.Fragment key={`dev-${idx}`}>
            <Polyline
              positions={[
                [dev.start.lat, dev.start.lng],
                [dev.end.lat, dev.end.lng],
              ]}
              color="red"
            />
            <Marker
              position={offsetCoordinate(dev.start.lat, dev.start.lng, idx)}
            >
              <Popup>
                🚨 Deviation Start<br />
                Lat: {dev.start.lat}<br />
                Lng: {dev.start.lng}<br />
                Time: {data[dev.start.index]?.timestamp}<br />
                <button
                  onClick={() =>
                    openInGoogleMaps(dev.start.lat, dev.start.lng)
                  }
                >
                  Navigate
                </button>
              </Popup>
            </Marker>
            <Marker
              position={offsetCoordinate(dev.end.lat, dev.end.lng, idx + 100)}
            >
              <Popup>
                ✅ Deviation End<br />
                Lat: {dev.end.lat}<br />
                Lng: {dev.end.lng}<br />
                Time: {data[dev.end.index]?.timestamp}<br />
                <button
                  onClick={() =>
                    openInGoogleMaps(dev.end.lat, dev.end.lng)
                  }
                >
                  Navigate
                </button>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}

        {highlightedStops.map((stop, idx) => (
          <CircleMarker
            key={`hot-${idx}`}
            center={[stop.lat, stop.lng]}
            radius={10}
            pathOptions={{
              color: "orange",
              fillColor: "yellow",
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              🔥 Frequent Hot Stoppage<br />
              Lat: {stop.lat}<br />
              Lng: {stop.lng}<br />
              User Timestamp: {stop.startTime}<br />
              <button onClick={() => openInGoogleMaps(stop.lat, stop.lng)}>
                Navigate
              </button>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Simple Legend */}
      <div style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        background: "#fff",
        padding: "6px 10px",
        borderRadius: "8px",
        fontSize: "0.85rem",
        boxShadow: "0 0 5px rgba(0,0,0,0.3)",
        lineHeight: "1.5"
      }}>
        <div><span style={{ color: "blue" }}>●</span> Actual Route</div>
        <div><span style={{ color: "green" }}>●</span> Approved Route</div>
        <div><span style={{ color: "red" }}>●</span> Deviation</div>
        <div><span style={{ color: "orange" }}>●</span> Hot Stoppage</div>
      </div>
    </div>
  );
};

export default MapView;
