
import { AppState, INITIAL_STATE, ServerNode, UserData, Message } from '../types';

const STORAGE_KEY = 'v2ray_bot_db_v6_logic_block';

// --- UTILITIES ---

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

// --- DATA PERSISTENCE ---

export const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return INITIAL_STATE;
  }
  try {
    const parsed = JSON.parse(stored);
    // Ensure all new fields exist if loading from old state
    return { 
        ...INITIAL_STATE, 
        ...parsed,
        // Migration safety: ensure lastDayUpdate exists
        lastDayUpdate: parsed.lastDayUpdate || Date.now() 
    };
  } catch (e) {
    console.error("Failed to parse state", e);
    return INITIAL_STATE;
  }
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

// --- CORE SERVER LOGIC BLOCKS ---
// These functions act as the "Backend API" or "Bot Controller"

export const BotLogic = {
    // 1. Create User
    createUser: (state: AppState, username: string, serverId: string, telegramId?: string): AppState => {
        const newUser: UserData = {
            id: generateUUID(),
            telegramId: telegramId || undefined,
            username,
            code: generateSecureCode(),
            status: 'active',
            serverId: serverId || null,
            plan: {
                totalDays: 30,
                daysRemaining: 30,
                totalDataGB: 100,
                dataUsedGB: 0
            },
            messages: [],
            joinedAt: Date.now()
        };
        return { ...state, users: [...state.users, newUser] };
    },

    // 2. Delete User
    deleteUser: (state: AppState, userId: string): AppState => {
        return {
            ...state,
            users: state.users.filter(u => u.id !== userId)
        };
    },

    // 3. Server Management
    upsertServer: (state: AppState, serverData: Partial<ServerNode>): AppState => {
        let newServers = [...state.servers];
        if (serverData.id) {
            // Update existing
            newServers = newServers.map(s => s.id === serverData.id ? { ...s, ...serverData } as ServerNode : s);
        } else {
            // Create new
            const newServer: ServerNode = {
                id: generateUUID(),
                name: serverData.name || 'New Node',
                subscriptionUrl: serverData.subscriptionUrl || '',
                configLink: serverData.configLink || '',
                message: serverData.message || '',
                totalDataGB: Number(serverData.totalDataGB) || 1000,
                dataUsedGB: 0,
                totalDays: Number(serverData.totalDays) || 30,
                daysRemaining: Number(serverData.totalDays) || 30,
                status: 'active'
            };
            newServers.push(newServer);
        }
        return { ...state, servers: newServers };
    },

    deleteServer: (state: AppState, serverId: string): AppState => {
        // Remove server
        const newServers = state.servers.filter(s => s.id !== serverId);
        // Unassign users linked to this server
        const newUsers = state.users.map(u => 
            u.serverId === serverId ? { ...u, serverId: null } : u
        );
        return { ...state, servers: newServers, users: newUsers };
    },

    // 4. Messaging
    sendMessage: (state: AppState, userId: string, text: string, sender: 'admin' | 'user'): AppState => {
        const user = state.users.find(u => u.id === userId);
        if (!user) return state;

        const newMsg: Message = {
            id: generateUUID(),
            sender,
            text,
            timestamp: Date.now(),
            read: false
        };

        const updatedUser = { ...user, messages: [...user.messages, newMsg] };
        return {
            ...state,
            users: state.users.map(u => u.id === userId ? updatedUser : u)
        };
    },

    markMessagesRead: (state: AppState, userId: string, reader: 'admin' | 'user'): AppState => {
        const user = state.users.find(u => u.id === userId);
        if (!user) return state;

        // If reader is admin, we mark 'user' messages as read.
        // If reader is user, we mark 'admin' messages as read.
        const targetSender = reader === 'admin' ? 'user' : 'admin';
        
        const hasUnread = user.messages.some(m => m.sender === targetSender && !m.read);
        if (!hasUnread) return state;

        const updatedMessages = user.messages.map(m => 
            m.sender === targetSender ? { ...m, read: true } : m
        );
        
        return {
            ...state,
            users: state.users.map(u => u.id === userId ? { ...user, messages: updatedMessages } : u)
        };
    },

    // 5. System Sync (The "Game Loop" or Cron Job)
    syncNetwork: (state: AppState): AppState => {
        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        
        let newState = { ...state };
        let daysDecremented = false;

        // A. Daily Settlement (Check if 24h passed since last day update)
        if (now - state.lastDayUpdate > ONE_DAY_MS) {
            newState.servers = newState.servers.map(s => {
                const newDays = Math.max(0, s.daysRemaining - 1);
                // Auto-disable if expired
                const newStatus = newDays === 0 ? 'offline' : s.status;
                return { ...s, daysRemaining: newDays, status: newStatus };
            });
            newState.lastDayUpdate = now;
            daysDecremented = true;
        }

        // B. Live Traffic Simulation (Simulate data usage)
        newState.servers = newState.servers.map(s => {
            if (s.status === 'offline') return s;

            // Random usage increment between 0.01 GB and 0.1 GB per sync
            const usageIncrement = Math.random() * 0.1; 
            const usedData = s.dataUsedGB + usageIncrement;
            const newData = Math.min(s.totalDataGB, usedData);
            
            // Auto-disable if data depleted
            let newStatus = s.status;
            if (newData >= s.totalDataGB) {
                newStatus = 'maintenance'; // Cap reached
            }

            return {
                ...s,
                dataUsedGB: parseFloat(newData.toFixed(2)),
                status: newStatus
            };
        });

        newState.lastSyncTime = now;
        return newState;
    }
};
