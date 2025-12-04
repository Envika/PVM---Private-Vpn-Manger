
import React, { useState, useEffect } from 'react';
import { loadState, saveState, generateUUID, simulateLiveSync } from './services/storage';
import { AppState, UserData, SignUpRequest } from './types';
import { AdminPanel } from './components/AdminPanel';
import { UserPanel } from './components/UserPanel';
import { Auth } from './components/Auth';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadState());
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'auth' | 'admin' | 'user'>('auth');

  // Load state on mount
  useEffect(() => {
    setState(loadState());
  }, []);

  // Auto-Sync Logic (Every 10 minutes)
  useEffect(() => {
    const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    const interval = setInterval(() => {
        // We read from function scope 'state' which might be stale in a closure if not careful,
        // but since we are updating state via setState callback, it's better to load fresh or use callback.
        // For simplicity with this hook structure:
        setState(prevState => {
            const syncedState = simulateLiveSync(prevState);
            saveState(syncedState);
            
            // Also update current user if logged in
            if (currentUser) {
                const updated = syncedState.users.find(u => u.id === currentUser.id);
                if (updated) setCurrentUser(updated);
            }
            return syncedState;
        });
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [currentUser?.id]); // Restart interval if user changes (rare), mainly just run on mount

  // Sync state changes to storage
  const handleStateUpdate = (newState: AppState) => {
    setState(newState);
    saveState(newState);
    // If we are updating the current logged in user from admin side, sync that too
    if (currentUser) {
        const updatedUser = newState.users.find(u => u.id === currentUser.id);
        if (updatedUser) setCurrentUser(updatedUser);
    }
  };

  const handleAdminLogin = (password: string): boolean => {
    if (password === state.adminPassword) {
        setIsAdmin(true);
        setView('admin');
        return true;
    }
    return false;
  };

  const handleUserLogin = (code: string) => {
    const user = state.users.find(u => u.code === code);
    if (user) {
      setCurrentUser(user);
      setView('user');
    } else {
      alert("Invalid Access Code");
    }
  };

  const handleSignUp = (username: string) => {
    const newRequest: SignUpRequest = {
        id: generateUUID(),
        username: username.startsWith('@') ? username : `@${username}`,
        timestamp: Date.now(),
        status: 'pending'
    };
    const newState = { ...state, requests: [...state.requests, newRequest] };
    handleStateUpdate(newState);
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setCurrentUser(null);
    setView('auth');
  };

  const handleUserSelfUpdate = (updatedUser: UserData) => {
      const newUsers = state.users.map(u => u.id === updatedUser.id ? updatedUser : u);
      const newState = { ...state, users: newUsers };
      handleStateUpdate(newState);
      setCurrentUser(updatedUser);
  };

  return (
    <div className="min-h-screen bg-cyber-900 text-white">
      {view === 'auth' && (
        <Auth 
            onAdminLogin={handleAdminLogin} 
            onUserLogin={handleUserLogin} 
            onSignUp={handleSignUp}
        />
      )}
      
      {view === 'admin' && (
        <AdminPanel 
            state={state} 
            onUpdate={handleStateUpdate} 
            onLogout={handleLogout} 
        />
      )}

      {view === 'user' && currentUser && (
        <UserPanel 
            user={currentUser} 
            fullState={state}
            onUpdateUser={handleUserSelfUpdate}
            onLogout={handleLogout} 
        />
      )}
    </div>
  );
};

export default App;
