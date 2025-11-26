import { AppState, INITIAL_STATE, UserData, SignUpRequest, UserStatus } from '../types';

const STORAGE_KEY = 'v2ray_bot_db_v1';

export const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return INITIAL_STATE;
  try {
    return JSON.parse(stored);
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

export const simulateDailyUpdate = (state: AppState): AppState => {
  const newUsers = state.users.map(u => {
    if (u.status !== 'active') return u;
    
    const newDays = Math.max(0, u.plan.daysRemaining - 1);
    const usedData = u.plan.dataUsedGB + (Math.random() * 2); // Random usage 0-2GB per day
    const newData = Math.min(u.plan.totalDataGB, usedData);
    
    let newStatus: UserStatus = u.status;
    if (newDays === 0 || newData >= u.plan.totalDataGB) {
        newStatus = 'expired';
    }

    return {
      ...u,
      status: newStatus,
      plan: {
        ...u.plan,
        daysRemaining: newDays,
        dataUsedGB: parseFloat(newData.toFixed(2))
      }
    };
  });

  return { ...state, users: newUsers };
};