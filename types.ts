
export type UserStatus = 'active' | 'expired' | 'pending_payment';

export interface Message {
  id: string;
  sender: 'user' | 'admin';
  text: string;
  timestamp: number;
  read: boolean;
}

export interface ServerNode {
  id: string;
  name: string;
  subscriptionUrl: string; // The Upstream Sync URL (e.g. from a panel like Marzban/X-UI)
  configLink: string; // The connect link (vless://...)
  message: string; // Server specific message
  totalDataGB: number;
  dataUsedGB: number;
  totalDays: number;
  daysRemaining: number;
  status: 'active' | 'maintenance' | 'offline';
}

export interface UserData {
  id: string;
  telegramId?: string; // Optional: Link to real Telegram User ID
  username: string; // Telegram handle
  code: string; // The 24-char unique access code
  status: UserStatus;
  serverId: string | null; // Link to a server
  // Individual plan tracking (kept for history, but UI will prioritize Server stats if bound)
  plan: {
    totalDays: number;
    daysRemaining: number;
    totalDataGB: number;
    dataUsedGB: number;
  };
  messages: Message[];
  joinedAt: number;
}

export interface AppState {
  users: UserData[];
  servers: ServerNode[];
  adminPassword: string;
  lastSyncTime: number;
  lastDayUpdate: number; // Timestamp for when we last decremented days
}

// Global context to simulate database
export const INITIAL_STATE: AppState = {
  users: [],
  servers: [
    {
      id: 'srv-default-1',
      name: 'Titanium Node (DE)',
      subscriptionUrl: '',
      configLink: 'vless://uuid@cdn.example.com:443?encryption=none&security=tls&type=ws#Titanium-Node',
      message: '⚡ Optimized for Streaming | Low Latency',
      totalDataGB: 500,
      dataUsedGB: 124.5,
      totalDays: 30,
      daysRemaining: 15,
      status: 'active'
    }
  ],
  adminPassword: 'admin',
  lastSyncTime: Date.now(),
  lastDayUpdate: Date.now()
};
