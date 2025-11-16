import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import RecitationAnalyzer from '../components/RecitationAnalyzer';
import AbjadValidator from '../components/AbjadValidator';
import JannahPoints from '../components/JannahPoints';

const QuranLabHome = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProgress, setUserProgress] = useState(null);
  const [recentRecitations, setRecentRecitations] = useState([]);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
      
      if (session?.user) {
        loadUserProgress(session.user.id);
        loadRecentRecitations(session.user.id);
      }
    };
    
    getSession();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        
        if (session?.user) {
          loadUserProgress(session.user.id);
          loadRecentRecitations(session.user.id);
        } else {
          setUserProgress(null);
          setRecentRecitations([]);
        }
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  const loadUserProgress = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user progress:', error);
        return;
      }
      
      setUserProgress(data || {
        total_jannah_points: 0,
        total_recitations: 0,
        average_accuracy: 0,
        current_level: 'Learner'
      });
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };
  
  const loadRecentRecitations = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('recitations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error loading recent recitations:', error);
        return;
      }
      
      setRecentRecitations(data || []);
    } catch (error) {
      console.error('Error loading recent recitations:', error);
    }
  };
  
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setShowAnalyzer(false);
  };
  
  const getLevelBadge = (points) => {
    if (points >= 10000) return { level: 'Master Scholar', color: '#FFD700', icon: '👑' };
    if (points >= 5000) return { level: 'Advanced Reciter', color: '#C0392B', icon: '🌟' };
    if (points >= 2000) return { level: 'Intermediate', color: '#E67E22', icon: '📿' };
    if (points >= 500) return { level: 'Beginner', color: '#27AE60', icon: '🌱' };
    return { level: 'Learner', color: '#3498DB', icon: '📚' };
  };
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading QuranLab...</p>
        <style jsx>{`
          .loading-screen {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255,255,255,0.3);
            border-top: 5px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  
  if (!user) {
    return (
      <>
        <Head>
          <title>QuranLab - Divine Learning Module</title>
          <meta name="description" content="Learn Quranic recitation with AI-powered precision and earn Jannah Points" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        
        <div className="auth-container">
          <div className="auth-card">
            <div className="logo">
              <h1>🕌 QuranLab</h1>
              <p>Divine Learning Module</p>
            </div>
            
            <form onSubmit={handleAuth} className="auth-form">
              <h2>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
              
              <div className="form-group">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </button>
              
              <p className="auth-switch">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                <button 
                  type="button" 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="switch-btn"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </form>
            
            <div className="features">
              <h3>✨ Features</h3>
              <ul>
                <li>🎤 AI-Powered Speech Recognition</li>
                <li>📊 85%+ Accuracy Validation</li>
                <li>🔢 Abjad Value Calculation</li>
                <li>🌟 Jannah Points System</li>
                <li>📿 Tajweed Rule Analysis</li>
                <li>🏆 Progress Tracking</li>
              </ul>
            </div>
          </div>
          
          <style jsx>{`
            .auth-container {
              min-height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 20px;
            }
            
            .auth-card {
              background: white;
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              max-width: 400px;
              width: 100%;
            }
            
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            
            .logo h1 {
              font-size: 2.5em;
              margin: 0;
              color: #2c3e50;
            }
            
            .logo p {
              color: #7f8c8d;
              margin: 5px 0 0 0;
            }
            
            .auth-form h2 {
              text-align: center;
              color: #2c3e50;
              margin-bottom: 25px;
            }
            
            .form-group {
              margin-bottom: 20px;
            }
            
            .form-group input {
              width: 100%;
              padding: 15px;
              border: 2px solid #ecf0f1;
              border-radius: 10px;
              font-size: 16px;
              transition: border-color 0.3s ease;
            }
            
            .form-group input:focus {
              outline: none;
              border-color: #3498db;
            }
            
            .auth-btn {
              width: 100%;
              padding: 15px;
              background: linear-gradient(135deg, #3498db, #2980b9);
              color: white;
              border: none;
              border-radius: 10px;
              font-size: 18px;
              font-weight: bold;
              cursor: pointer;
              transition: transform 0.2s ease;
            }
            
            .auth-btn:hover {
              transform: translateY(-2px);
            }
            
            .auth-btn:disabled {
              opacity: 0.7;
              cursor: not-allowed;
            }
            
            .auth-switch {
              text-align: center;
              margin-top: 20px;
              color: #7f8c8d;
            }
            
            .switch-btn {
              background: none;
              border: none;
              color: #3498db;
              cursor: pointer;
              font-weight: bold;
              margin-left: 5px;
            }
            
            .features {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ecf0f1;
            }
            
            .features h3 {
              color: #2c3e50;
              margin-bottom: 15px;
            }
            
            .features ul {
              list-style: none;
              padding: 0;
            }
            
            .features li {
              padding: 5px 0;
              color: #555;
            }
          `}</style>
        </div>
      </>
    );
  }
  
  const levelBadge = getLevelBadge(userProgress?.total_jannah_points || 0);
  
  return (
    <>
      <Head>
        <title>QuranLab Dashboard - Divine Learning Module</title>
        <meta name="description" content="Your personal Quranic learning dashboard with AI-powered recitation analysis" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-content">
            <h1>🕌 QuranLab Dashboard</h1>
            <div className="user-info">
              <span>Welcome, {user.email}</span>
              <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
            </div>
          </div>
        </header>
        
        <main className="dashboard-main">
          {!showAnalyzer ? (
            <>
              <div className="stats-grid">
                <div className="stat-card jannah-points">
                  <div className="stat-icon">{levelBadge.icon}</div>
                  <div className="stat-content">
                    <h3>Jannah Points</h3>
                    <div className="stat-value">{userProgress?.total_jannah_points || 0}</div>
                    <div className="stat-label" style={{ color: levelBadge.color }}>
                      {levelBadge.level}
                    </div>
                  </div>
                </div>
                
                <div className="stat-card recitations">
                  <div className="stat-icon">📿</div>
                  <div className="stat-content">
                    <h3>Total Recitations</h3>
                    <div className="stat-value">{userProgress?.total_recitations || 0}</div>
                    <div className="stat-label">Completed</div>
                  </div>
                </div>
                
                <div className="stat-card accuracy">
                  <div className="stat-icon">🎯</div>
                  <div className="stat-content">
                    <h3>Average Accuracy</h3>
                    <div className="stat-value">{userProgress?.average_accuracy || 0}%</div>
                    <div className="stat-label">Precision</div>
                  </div>
                </div>
                
                <div className="stat-card streak">
                  <div className="stat-icon">🔥</div>
                  <div className="stat-content">
                    <h3>Current Streak</h3>
                    <div className="stat-value">{userProgress?.current_streak || 0}</div>
                    <div className="stat-label">Days</div>
                  </div>
                </div>
              </div>
              
              <div className="action-section">
                <button 
                  onClick={() => setShowAnalyzer(true)}
                  className="start-recitation-btn"
                >
                  🎤 Start New Recitation
                </button>
              </div>
              
              {recentRecitations.length > 0 && (
                <div className="recent-recitations">
                  <h2>📊 Recent Recitations</h2>
                  <div className="recitations-list">
                    {recentRecitations.map((recitation, index) => (
                      <div key={index} className="recitation-item">
                        <div className="recitation-info">
                          <h4>Surah {recitation.surah}, Ayah {recitation.ayah}</h4>
                          <p className="recitation-date">
                            {new Date(recitation.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="recitation-stats">
                          <span className="accuracy-badge">{recitation.accuracy}%</span>
                          <span className="points-badge">+{recitation.jannah_points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="analyzer-section">
              <div className="analyzer-header">
                <button 
                  onClick={() => setShowAnalyzer(false)}
                  className="back-btn"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <RecitationAnalyzer />
            </div>
          )}
        </main>
        
        <style jsx>{`
          .dashboard {
            min-height: 100vh;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          }
          
          .dashboard-header {
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 20px 0;
          }
          
          .header-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .header-content h1 {
            color: #2c3e50;
            margin: 0;
          }
          
          .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          
          .sign-out-btn {
            padding: 8px 16px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background 0.3s ease;
          }
          
          .sign-out-btn:hover {
            background: #c0392b;
          }
          
          .dashboard-main {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }
          
          .stat-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 20px;
            transition: transform 0.3s ease;
          }
          
          .stat-card:hover {
            transform: translateY(-5px);
          }
          
          .stat-icon {
            font-size: 3em;
          }
          
          .stat-content h3 {
            margin: 0 0 10px 0;
            color: #7f8c8d;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .stat-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
          }
          
          .stat-label {
            color: #95a5a6;
            font-size: 12px;
          }
          
          .action-section {
            text-align: center;
            margin: 40px 0;
          }
          
          .start-recitation-btn {
            padding: 20px 40px;
            font-size: 20px;
            background: linear-gradient(135deg, #27ae60, #2ecc71);
            color: white;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(39, 174, 96, 0.3);
          }
          
          .start-recitation-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(39, 174, 96, 0.4);
          }
          
          .recent-recitations {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
          }
          
          .recent-recitations h2 {
            color: #2c3e50;
            margin-bottom: 25px;
          }
          
          .recitations-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }
          
          .recitation-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            transition: background 0.3s ease;
          }
          
          .recitation-item:hover {
            background: #e9ecef;
          }
          
          .recitation-info h4 {
            margin: 0 0 5px 0;
            color: #2c3e50;
          }
          
          .recitation-date {
            margin: 0;
            color: #7f8c8d;
            font-size: 14px;
          }
          
          .recitation-stats {
            display: flex;
            gap: 10px;
          }
          
          .accuracy-badge, .points-badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
          }
          
          .accuracy-badge {
            background: #3498db;
            color: white;
          }
          
          .points-badge {
            background: #f39c12;
            color: white;
          }
          
          .analyzer-section {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
          }
          
          .analyzer-header {
            margin-bottom: 20px;
          }
          
          .back-btn {
            padding: 10px 20px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s ease;
          }
          
          .back-btn:hover {
            background: #5a6268;
          }
          
          @media (max-width: 768px) {
            .header-content {
              flex-direction: column;
              gap: 15px;
              text-align: center;
            }
            
            .stats-grid {
              grid-template-columns: 1fr;
            }
            
            .stat-card {
              flex-direction: column;
              text-align: center;
            }
            
            .recitation-item {
              flex-direction: column;
              align-items: flex-start;
              gap: 10px;
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default QuranLabHome;