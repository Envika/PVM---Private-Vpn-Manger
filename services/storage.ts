
import { AppState, INITIAL_STATE, UserData, SignUpRequest, UserStatus } from '../types';

const STORAGE_KEY = 'v2ray_bot_db_v3'; // Bumped version for password support

export const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return INITIAL_STATE;
  try {
    const parsed = JSON.parse(stored);
    // Ensure new fields exist if loading from old state
    return {
        ...INITIAL_STATE,
        ...parsed,
        adminPassword: parsed.adminPassword || INITIAL_STATE.adminPassword,
        serverMessage: parsed.serverMessage || INITIAL_STATE.serverMessage,
        subscriptionUrl: parsed.subscriptionUrl || INITIAL_STATE.subscriptionUrl,
        lastSyncTime: parsed.lastSyncTime || Date.now()
    };
  } catch (e) {
    console.error("Failed to parse state", e);
    return INITIAL_STATE;
  }
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const generateSecureCode = (): string => {
  // Generate 24 random hex characters
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Daily large update (cron job simulation)
export const simulateDailyUpdate = (state: AppState): AppState => {
  const newUsers = state.users.map(u => {
    if (u.status !== 'active') return u;
    
    const newDays = Math.max(0, u.plan.daysRemaining - 1);
    
    let newStatus: UserStatus = u.status;
    if (newDays === 0) {
        newStatus = 'expired';
    }

    return {
      ...u,
      status: newStatus,
      plan: {
        ...u.plan,
        daysRemaining: newDays
      }
    };
  });

  return { ...state, users: newUsers };
};

// "Live" sync that happens every ~10 mins to simulate fetching data from upstream
export const simulateLiveSync = (state: AppState): AppState => {
    const newUsers = state.users.map(u => {
        if (u.status !== 'active') return u;

        // Simulate small data usage increment (0.01 GB to 0.1 GB)
        const usageIncrement = Math.random() * 0.1;
        const usedData = u.plan.dataUsedGB + usageIncrement;
        const newData = Math.min(u.plan.totalDataGB, usedData);
        
        let newStatus: UserStatus = u.status;
        if (newData >= u.plan.totalDataGB) {
            newStatus = 'expired';
        }

        return {
            ...u,
            status: newStatus,
            plan: {
                ...u.plan,
                dataUsedGB: parseFloat(newData.toFixed(2))
            }
        };
    });

    return { 
        ...state, 
        users: newUsers,
        lastSyncTime: Date.now()
    };
};
