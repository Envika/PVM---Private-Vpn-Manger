
export type UserStatus = 'active' | 'expired' | 'pending_payment';

export interface Message {
  id: string;
  sender: 'user' | 'admin';
  text: string;
  timestamp: number;
  read: boolean;
}

export interface UserData {
  id: string;
  username: string; // Telegram handle
  code: string; // The 24-char unique access code
  status: UserStatus;
  plan: {
    totalDays: number;
    daysRemaining: number;
    totalDataGB: number;
    dataUsedGB: number;
  };
  messages: Message[];
  joinedAt: number;
}

export interface SignUpRequest {
  id: string;
  username: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AppState {
  users: UserData[];
  requests: SignUpRequest[];
  baseVpnConfig: string;
  serverMessage: string;
  adminPassword: string; // New: changeable password
  subscriptionUrl: string; // New: Upstream URL
  lastSyncTime: number; // New: Track updates
}

// Global context to simulate database
export const INITIAL_STATE: AppState = {
  users: [
    {
      id: 'demo-user-1',
      username: '@crypto_king',
      code: 'a1b2c3d4e5f6789012345678',
      status: 'active',
      plan: {
        totalDays: 30,
        daysRemaining: 12,
        totalDataGB: 50,
        dataUsedGB: 34.5
      },
      messages: [
        { id: 'm1', sender: 'user', text: 'Hey, connection is slow today.', timestamp: Date.now() - 100000, read: true },
        { id: 'm2', sender: 'admin', text: 'We are fixing server 2, please try server 1.', timestamp: Date.now() - 50000, read: true }
      ],
      joinedAt: Date.now() - 1000000
    },
    {
      id: 'demo-user-2',
      username: '@alice_wonder',
      code: '11223344556677889900aabb',
      status: 'pending_payment',
      plan: {
        totalDays: 30,
        daysRemaining: 0,
        totalDataGB: 50,
        dataUsedGB: 49.9
      },
      messages: [],
      joinedAt: Date.now() - 2000000
    }
  ],
  requests: [
    { id: 'req-1', username: '@new_guy', timestamp: Date.now(), status: 'pending' }
  ],
  baseVpnConfig: 'vless://uuid@cdn.example.com:443?encryption=none&security=tls&sni=cdn.example.com&fp=chrome&type=ws&host=cdn.example.com&path=%2F#VPN-Server',
  serverMessage: '✅ All Systems Operational | ⚡ Server 2 Added',
  adminPassword: 'admin', // Default password
  subscriptionUrl: '',
  lastSyncTime: Date.now()
};
