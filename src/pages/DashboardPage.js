import React, { useState, useEffect } from 'react';
import '../styles/DashboardPage.css';
import MapView from '../components/MapView';
import HotStoppagesMap from '../components/HotStoppagesMap';
import { useNavigate } from 'react-router-dom';
import ioclLogo from '../assets/iocl-logo.png';


const DashboardPage = () => {
  const [selectedDate, setSelectedDate] = useState('2025-07-31');
  const [loading, setLoading] = useState(false);
  const [structuredData, setStructuredData] = useState({});
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [hotStops, setHotStops] = useState([]);
  const [showHotStopsMap, setShowHotStopsMap] = useState(false);

  const navigate = useNavigate(); // ✅ required for logout

  const fetchDataFromStorage = async (date) => {
    setLoading(true);
    try {
      const url = `https://firebasestorage.googleapis.com/v0/b/grm-app-3d8ab.firebasestorage.app/o/daily_logs%2F${date}.json?alt=media`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('File not found or access denied');
      const rawJson = await response.json();
      const structured = {};
      for (const recordId in rawJson) {
        const entries = rawJson[recordId];
        for (const key in entries) {
          const entry = entries[key];
          const user = entry.username || 'unknown';
          const customer = entry.customerName || 'unknown';
          if (!structured[user]) structured[user] = {};
          if (!structured[user][customer]) structured[user][customer] = [];
          structured[user][customer].push(entry);
        }
      }
      for (const user in structured) {
        for (const customer in structured[user]) {
          structured[user][customer].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
      }
      setStructuredData(structured);
      const firstUser = Object.keys(structured)[0] || '';
      setSelectedUser(firstUser);
    } catch (error) {
      console.error('Error downloading or parsing file:', error);
      setStructuredData({});
    } finally {
      setLoading(false);
    }
  };

  const fetchHotStoppages = async () => {
    try {
      const res = await fetch(
        'https://firebasestorage.googleapis.com/v0/b/grm-app-3d8ab.firebasestorage.app/o/hot_stoppages.json?alt=media'
      );
      const data = await res.json();
      const filtered = Array.isArray(data)
        ? data.filter((stop) => stop.frequency > 0)
        : [];
      setHotStops(filtered);
    } catch (error) {
      console.error('Failed to fetch hot stoppages:', error);
    }
  };

  useEffect(() => {
    fetchDataFromStorage(selectedDate);
    fetchHotStoppages();
  }, [selectedDate]);

  const handleUserChange = (e) => {
    setSelectedUser(e.target.value);
    setSelectedCustomer('');
  };

  const handleCustomerChange = (e) => {
    setSelectedCustomer(e.target.value);
  };

   const handleLogout = () => {   
    navigate('/'); // ✅ redirect to login
  };

  const getCustomersForUser = (user) => {
    return structuredData[user] ? Object.keys(structuredData[user]) : [];
  };

  const getMatchingRecords = () => {
    if (
      selectedUser &&
      selectedCustomer &&
      structuredData[selectedUser] &&
      structuredData[selectedUser][selectedCustomer]
    ) {
      return structuredData[selectedUser][selectedCustomer];
    }
    return [];
  };

  return (
    <div className={`dashboard-container ${loading ? 'blurred' : ''}`}>
      <header className="dashboard-header">
        <div className="header-logo-title">
    <img src={ioclLogo} alt="IOCL Logo" className="iocl-logo" />
        
  <div className="titles">
    <h1 className="primary-heading">Welcome Sangrur Terminal</h1>
    <h2 className="secondary-heading">Journey Risk Management</h2>
  </div>
  </div>
  <div className="date-picker">
    <label>Select Date:&nbsp;</label>
    <input
      type="date"
      value={selectedDate}
      onChange={(e) => setSelectedDate(e.target.value)}
    />
  </div>
  <div className="logout-container">
  <button className="logout-button" onClick={handleLogout}>
    Logout
  </button>
</div>
</header>



     <button className="hot-stoppages-button" onClick={() => setShowHotStopsMap(true)}>
  View Hot Stoppages
</button>

      {showHotStopsMap && (
        <HotStoppagesMap hotStops={hotStops} onClose={() => setShowHotStopsMap(false)} />
      )}

      {loading && <div className="loading">Loading data...</div>}

      {!loading && Object.keys(structuredData).length === 0 && (
        <div className="no-data">No data available for this date.</div>
      )}

      {!loading && Object.keys(structuredData).length > 0 && (
        <div className="dashboard-card">
          <div className="section">
            <label>Select User:&nbsp;</label>
            <select value={selectedUser} onChange={handleUserChange}>
              {Object.keys(structuredData).map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <div className="section">
              <label>Select Customer:&nbsp;</label>
              <select value={selectedCustomer} onChange={handleCustomerChange}>
                <option value="">-- Select Customer --</option>
                {getCustomersForUser(selectedUser).map((cust, idx) => (
                  <option key={idx} value={cust}>
                    {cust}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedUser && selectedCustomer && (
            <div className="data-summary">
              

              <MapView data={getMatchingRecords()} hotStops={hotStops} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;