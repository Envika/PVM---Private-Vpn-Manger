import React, { useState, useEffect } from 'react';
import { loadState, saveState, BotLogic } from './services/storage';
import { AppState, UserData } from './types';
import { AdminPanel } from './components/AdminPanel';
import { UserPanel } from './components/UserPanel';
import { Auth } from './components/Auth';

declare global {
  interface Window {
    Telegram?: any;
  }
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadState());
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'auth' | 'admin' | 'user'>('auth');
  const [detectedTgId, setDetectedTgId] = useState<string | null>(null);

  // Load state on mount
  useEffect(() => {
    setState(loadState());
  }, []);

  // Telegram Web App Integration
  useEffect(() => {
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        
        // Attempt to expand to full height
        try { tg.expand(); } catch (e) {}

        // Style integration
        try {
            tg.setHeaderColor('#0f172a'); 
            tg.setBackgroundColor('#0f172a');
        } catch (e) {}

        const telegramUserId = tg.initDataUnsafe?.user?.id;
        if (telegramUserId) {
            const tgIdStr = String(telegramUserId);
            setDetectedTgId(tgIdStr);

            // Auto-login if user exists
            // Note: We need to use the functional state to ensure we have the latest loaded data, 
            // but since this runs on mount/updates, we check 'state' dependency
            const foundUser = state.users.find(u => u.telegramId === tgIdStr);
            if (foundUser && foundUser.status === 'active') {
                setCurrentUser(foundUser);
                setView('user');
            }
        }
    }
  }, [state.users]); // Re-check if users list is updated (e.g. after sync)

  // Auto-Sync Logic (Every 1 minute) - Simulates the Bot "Heartbeat"
  useEffect(() => {
    const SYNC_INTERVAL_MS = 60 * 1000; // Run logic every minute (Check daily tasks, traffic calc)
    const interval = setInterval(() => {
        setState(prevState => {
            // "Server-Side" Logic Block Execution
            const syncedState = BotLogic.syncNetwork(prevState);
            saveState(syncedState);
            
            // Sync Current User Session if active
            if (currentUser) {
                const updated = syncedState.users.find(u => u.id === currentUser.id);
                if (updated) setCurrentUser(updated);
            }
            return syncedState;
        });
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [currentUser?.id]); 

  // Sync state changes to storage
  const handleStateUpdate = (newState: AppState) => {
    setState(newState);
    saveState(newState);
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
            detectedTgId={detectedTgId}
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