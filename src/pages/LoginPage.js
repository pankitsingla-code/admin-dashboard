import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../services/firebase';
import '../styles/DashboardPage.css'; // reuse existing styles
import ioclLogo from '../assets/iocl-logo.png';


const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // loading state
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true); // start blur

    try {
      const userRef = ref(db, `admin_users/${username}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const user = snapshot.val();
        if (user.password === password) {
          navigate('/dashboard');
        } else {
          setError('Incorrect password');
        }
      } else {
        setError('User not found');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to login');
    }

    setLoading(false); // end blur
  };

  return (
    <>
      {/* Blurred background container */}
      <div className={`dashboard-container login-page ${loading ? 'blurred' : ''}`}>
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-logo-title">
    <img src={ioclLogo} alt="IOCL Logo" className="iocl-logo" />
          <div className="titles">
            <h1 className="primary-heading">Welcome Sangrur Terminal</h1>
            <h2 className="secondary-heading">Journey Risk Management</h2>
          </div>
          </div>
        </header>

        {/* Login Card */}
        <div className="dashboard-card login-card">
          <h3 className="section-title">Admin Login</h3>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
          />

          {error && <p className="error-text">{error}</p>}

          <button className="primary-button" onClick={handleLogin} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </div>

      {/* Optional loading overlay */}
      {loading && (
        <div className="loader-overlay">
          Logging in...
        </div>
      )}
    </>
  );
};

export default LoginPage;
