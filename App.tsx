import React, { useState, useEffect } from 'react';
import { loadState, saveState } from './services/storage';
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

  const handleAdminLogin = () => {
    setIsAdmin(true);
    setView('admin');
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
        id: crypto.randomUUID(),
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