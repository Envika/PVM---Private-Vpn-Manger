
import { AppState, INITIAL_STATE, ServerNode } from '../types';

const STORAGE_KEY = 'v2ray_bot_db_v5_multiserver'; // Bumped version

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const generateSecureCode = (): string => {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Try to migrate from v3/v4 if exists to preserve password/users
    const oldStored = localStorage.getItem('v2ray_bot_db_v3') || localStorage.getItem('v2ray_bot_db_v4');
    if (oldStored) {
      try {
        const parsedOld = JSON.parse(oldStored);
        // Create a default server from old global config
        const defaultServer: ServerNode = {
          id: generateUUID(),
          name: 'Primary Server (Migrated)',
          subscriptionUrl: parsedOld.subscriptionUrl || '',
          configLink: parsedOld.baseVpnConfig || 'vless://example',
          message: parsedOld.serverMessage || 'System Operational',
          totalDataGB: 1000,
          dataUsedGB: 0,
          totalDays: 30,
          daysRemaining: 30,
          status: 'active'
        };

        // Assign existing users to this server
        const migratedUsers = (parsedOld.users || []).map((u: any) => ({
           ...u,
           serverId: defaultServer.id
        }));

        return {
          users: migratedUsers,
          servers: [defaultServer],
          adminPassword: parsedOld.adminPassword || 'admin',
          lastSyncTime: Date.now()
        };
      } catch (e) {
        console.error("Migration failed", e);
      }
    }
    return INITIAL_STATE;
  }

  try {
    const parsed = JSON.parse(stored);
    // Ensure requests property is ignored if present in old JSON
    const { requests, ...cleanState } = parsed; 
    return { ...INITIAL_STATE, ...cleanState };
  } catch (e) {
    console.error("Failed to parse state", e);
    return INITIAL_STATE;
  }
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

// Daily update logic (Run via manual trigger or smart sync)
export const simulateDailyUpdate = (state: AppState): AppState => {
  // Update Server Days
  const newServers = state.servers.map(s => {
      const newDays = Math.max(0, s.daysRemaining - 1);
      return { ...s, daysRemaining: newDays };
  });

  return { ...state, servers: newServers };
};

// "Live" sync that simulates fetching data from Upstream
// This now updates SERVERS (Shared stats) rather than just users
export const simulateLiveSync = (state: AppState): AppState => {
    // Update Servers
    const newServers = state.servers.map(s => {
        if (s.status === 'offline') return s;

        // Simulate usage increment
        // Random usage between 0.05 GB and 0.5 GB per sync interval
        const usageIncrement = Math.random() * 0.5; 
        const usedData = s.dataUsedGB + usageIncrement;
        const newData = Math.min(s.totalDataGB, usedData);
        
        let newStatus = s.status;
        if (newData >= s.totalDataGB || s.daysRemaining <= 0) {
            // Can add logic to auto-disable, but usually we just show 0
        }

        return {
            ...s,
            dataUsedGB: parseFloat(newData.toFixed(2))
        };
    });

    return { 
        ...state, 
        servers: newServers,
        lastSyncTime: Date.now()
    };
};
