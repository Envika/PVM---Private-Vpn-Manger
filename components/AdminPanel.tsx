
import React, { useState, useEffect } from 'react';
import { AppState, UserData, Message, SignUpRequest, ServerNode } from '../types';
import { generateSecureCode, simulateLiveSync, saveState, generateUUID } from '../services/storage';
import { 
    Users, DollarSign, Activity, MessageSquare, Plus, RefreshCw, 
    Trash2, Send, AlertCircle, CheckCircle, XCircle, Search, Settings, Server, Lock, Globe,
    Database, Edit2, Link, Wifi
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { suggestReply } from '../services/gemini';

interface AdminPanelProps {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ state, onUpdate, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'servers' | 'requests' | 'messages' | 'settings'>('dashboard');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // User Creation State
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserServerId, setNewUserServerId] = useState<string>('');

  // Server Management State
  const [editingServer, setEditingServer] = useState<ServerNode | null>(null);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  // Chat State
  const [replyText, setReplyText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Settings local state
  const [newPassword, setNewPassword] = useState('');

  // Stats
  const totalUsers = state.users.length;
  const activeUsers = state.users.filter(u => u.status === 'active').length;
  const serverCount = state.servers.length;
  
  // Initialize server selection
  useEffect(() => {
      if (state.servers.length > 0 && !newUserServerId) {
          setNewUserServerId(state.servers[0].id);
      }
  }, [state.servers]);

  const chartData = [
    { name: 'Active', value: activeUsers, color: '#10b981' },
    { name: 'Inactive', value: totalUsers - activeUsers, color: '#ef4444' },
    { name: 'Servers', value: serverCount, color: '#3b82f6' },
  ];

  // --- USER HANDLERS ---

  const handleCreateUser = () => {
    if (!newUserUsername) return;
    const newUser: UserData = {
      id: generateUUID(),
      username: newUserUsername.startsWith('@') ? newUserUsername : `@${newUserUsername}`,
      code: generateSecureCode(),
      status: 'pending_payment',
      serverId: newUserServerId || null,
      plan: { totalDays: 30, daysRemaining: 30, totalDataGB: 50, dataUsedGB: 0 },
      messages: [],
      joinedAt: Date.now()
    };
    onUpdate({ ...state, users: [newUser, ...state.users] });
    setNewUserUsername('');
    setActiveTab('users');
  };

  const handleDeleteUser = (userId: string) => {
      if (window.confirm("Are you sure you want to permanently delete this user?")) {
          const updatedUsers = state.users.filter(u => u.id !== userId);
          // Also remove requests if any
          onUpdate({ ...state, users: updatedUsers });
          if (selectedUser?.id === userId) setSelectedUser(null);
      }
  };

  const handleUpdateUser = (updatedUser: UserData) => {
      const updatedUsers = state.users.map(u => u.id === updatedUser.id ? updatedUser : u);
      onUpdate({ ...state, users: updatedUsers });
      setSelectedUser(updatedUser);
  };

  // --- SERVER HANDLERS ---

  const handleSaveServer = (server: ServerNode) => {
      let newServers;
      if (state.servers.find(s => s.id === server.id)) {
          // Update existing
          newServers = state.servers.map(s => s.id === server.id ? server : s);
      } else {
          // Add new
          newServers = [...state.servers, server];
      }
      onUpdate({ ...state, servers: newServers });
      setIsServerModalOpen(false);
      setEditingServer(null);
  };

  const handleDeleteServer = (serverId: string) => {
      if (window.confirm("Delete this server? Users assigned to it will become unbound.")) {
          const newServers = state.servers.filter(s => s.id !== serverId);
          // Unbind users
          const newUsers = state.users.map(u => u.serverId === serverId ? { ...u, serverId: null } : u);
          onUpdate({ ...state, servers: newServers, users: newUsers });
      }
  };

  const openNewServerModal = () => {
      setEditingServer({
          id: generateUUID(),
          name: 'New Server Node',
          subscriptionUrl: '',
          configLink: '',
          message: 'Server Active',
          totalDataGB: 1000,
          dataUsedGB: 0,
          totalDays: 30,
          daysRemaining: 30,
          status: 'active'
      });
      setIsServerModalOpen(true);
  };

  // --- SYNC & SETTINGS ---

  const handleManualSync = () => {
    const newState = simulateLiveSync(state);
    onUpdate(newState);
    saveState(newState); 
    alert("Manual sync complete. Server stats updated.");
  };

  const handleSaveSettings = () => {
      if (newPassword) {
          onUpdate({ ...state, adminPassword: newPassword });
          alert("Password Updated");
          setNewPassword('');
      }
  };

  // --- MESSAGES & REQUESTS ---

  const handleApproveRequest = (req: SignUpRequest) => {
    const newUser: UserData = {
        id: generateUUID(),
        username: req.username,
        code: generateSecureCode(),
        status: 'pending_payment',
        serverId: state.servers.length > 0 ? state.servers[0].id : null,
        plan: { totalDays: 30, daysRemaining: 30, totalDataGB: 50, dataUsedGB: 0 },
        messages: [],
        joinedAt: Date.now()
    };
    const updatedRequests = state.requests.filter(r => r.id !== req.id);
    onUpdate({ ...state, users: [newUser, ...state.users], requests: updatedRequests });
  };

  const handleSendMessage = async (userId: string) => {
    if (!replyText) return;
    const updatedUsers = state.users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          messages: [...u.messages, { id: generateUUID(), sender: 'admin', text: replyText, timestamp: Date.now(), read: false } as Message]
        };
      }
      return u;
    });
    onUpdate({ ...state, users: updatedUsers });
    setReplyText('');
    if (selectedUser && selectedUser.id === userId) {
        const u = updatedUsers.find(user => user.id === userId);
        if (u) setSelectedUser(u);
    }
  };

  const generateAISuggestion = async () => {
      if(!selectedUser) return;
      const lastUserMsg = [...selectedUser.messages].reverse().find(m => m.sender === 'user');
      if (lastUserMsg) {
          setIsProcessing(true);
          const suggestion = await suggestReply(lastUserMsg.text);
          setReplyText(suggestion);
          setIsProcessing(false);
      }
  }

  const filteredUsers = state.users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.code.includes(searchTerm)
  );

  return (
    <div className="flex h-screen bg-cyber-900 text-gray-200 overflow-hidden font-mono">
      {/* Sidebar */}
      <div className="w-64 bg-cyber-800 border-r border-cyber-700 flex flex-col">
        <div className="p-6 border-b border-cyber-700">
          <h1 className="text-xl font-bold text-cyber-400 tracking-wider">NET_ADMIN</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', icon: Activity, label: 'Overview' },
            { id: 'users', icon: Users, label: 'Users' },
            { id: 'servers', icon: Server, label: 'Servers' },
            { id: 'requests', icon: Plus, label: 'Inquiries', count: state.requests.length },
            { id: 'messages', icon: MessageSquare, label: 'Messages' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as any); setSelectedUser(null); }}
              className={`w-full flex items-center justify-between p-3 rounded transition-colors ${
                activeTab === item.id ? 'bg-cyber-700 text-white' : 'hover:bg-cyber-700/50 text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon size={20} />
                <span>{item.label}</span>
              </div>
              {item.count ? (
                <span className="bg-cyber-500 text-xs px-2 py-0.5 rounded-full text-white">{item.count}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-cyber-700">
             <button 
                onClick={handleManualSync}
                className="w-full flex items-center justify-center space-x-2 bg-cyber-700 hover:bg-cyber-600 text-xs py-2 rounded mb-2 text-gray-300"
            >
                <RefreshCw size={14} />
                <span>Force Sync Now</span>
            </button>
            <button onClick={onLogout} className="w-full text-sm text-red-400 hover:text-red-300 py-2">Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-cyber-800/50 border-b border-cyber-700 flex items-center justify-between px-6 backdrop-blur">
          <h2 className="text-lg font-semibold capitalize text-white">{activeTab}</h2>
          <div className="flex items-center space-x-4">
             <div className="flex flex-col items-end">
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">NETWORK ONLINE</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
                <span className="text-[10px] text-gray-600">Last Sync: {new Date(state.lastSyncTime).toLocaleTimeString()}</span>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 relative">
          
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-cyber-800 p-6 rounded-xl border border-cyber-700 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-400 text-sm">Total Users</p>
                    <h3 className="text-3xl font-bold text-white mt-2">{totalUsers}</h3>
                  </div>
                  <Users className="text-cyber-500 opacity-80" />
                </div>
              </div>
              <div className="bg-cyber-800 p-6 rounded-xl border border-cyber-700 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-400 text-sm">Active Subscriptions</p>
                    <h3 className="text-3xl font-bold text-cyber-accent mt-2">{activeUsers}</h3>
                  </div>
                  <CheckCircle className="text-cyber-accent opacity-80" />
                </div>
              </div>
              <div className="bg-cyber-800 p-6 rounded-xl border border-cyber-700 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-400 text-sm">Online Servers</p>
                    <h3 className="text-3xl font-bold text-blue-400 mt-2">{serverCount}</h3>
                  </div>
                  <Server className="text-blue-400 opacity-80" />
                </div>
              </div>
              
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-cyber-800 p-6 rounded-xl border border-cyber-700 shadow-lg">
                <h3 className="text-lg font-bold mb-4">Network Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} />
                      <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} 
                          itemStyle={{ color: '#e2e8f0' }}
                          cursor={{fill: 'transparent'}}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                          {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

               {/* Server Mini-Status */}
               <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-4">
                   <h3 className="text-lg font-bold">Server Health</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {state.servers.map(server => (
                           <div key={server.id} className="bg-cyber-800 p-4 rounded-lg border border-cyber-700 flex justify-between items-center">
                               <div>
                                   <div className="font-bold text-white flex items-center gap-2">
                                       <div className={`w-2 h-2 rounded-full ${server.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                       {server.name}
                                   </div>
                                   <div className="text-xs text-gray-500 mt-1">
                                       {server.daysRemaining} days left | {(server.totalDataGB - server.dataUsedGB).toFixed(1)} GB Free
                                   </div>
                               </div>
                               <div className="text-right">
                                   <div className="text-xl font-bold text-cyber-400">{Math.round((server.dataUsedGB / server.totalDataGB) * 100)}%</div>
                                   <div className="text-xs text-gray-500">Load</div>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
            </div>
          )}

          {/* Servers View */}
          {activeTab === 'servers' && (
              <div className="space-y-6">
                  <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-bold text-white">Server Nodes</h3>
                      <button onClick={openNewServerModal} className="bg-cyber-500 hover:bg-cyber-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                          <Plus size={18} />
                          <span>Add Server</span>
                      </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {state.servers.map(server => (
                          <div key={server.id} className="bg-cyber-800 rounded-xl border border-cyber-700 overflow-hidden flex flex-col">
                              <div className="p-6 flex-1">
                                  <div className="flex justify-between items-start mb-4">
                                      <h4 className="font-bold text-lg text-white">{server.name}</h4>
                                      <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${server.status === 'active' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                                          {server.status}
                                      </span>
                                  </div>
                                  
                                  <div className="space-y-4">
                                      <div>
                                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                                              <span>Data Usage</span>
                                              <span>{server.dataUsedGB.toFixed(1)} / {server.totalDataGB} GB</span>
                                          </div>
                                          <div className="w-full bg-cyber-900 rounded-full h-2">
                                              <div 
                                                className="bg-cyber-500 h-2 rounded-full transition-all" 
                                                style={{ width: `${Math.min(100, (server.dataUsedGB / server.totalDataGB) * 100)}%` }}
                                              ></div>
                                          </div>
                                      </div>
                                      <div>
                                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                                              <span>Subscription Expiry</span>
                                              <span>{server.daysRemaining} days left</span>
                                          </div>
                                          <div className="w-full bg-cyber-900 rounded-full h-2">
                                              <div 
                                                className="bg-cyber-accent h-2 rounded-full transition-all" 
                                                style={{ width: `${Math.min(100, (server.daysRemaining / server.totalDays) * 100)}%` }}
                                              ></div>
                                          </div>
                                      </div>
                                      <div className="text-xs text-gray-500 italic p-2 bg-cyber-900 rounded border border-cyber-700/50">
                                          "{server.message}"
                                      </div>
                                  </div>
                              </div>
                              <div className="p-4 bg-cyber-900/50 border-t border-cyber-700 flex justify-between">
                                  <button onClick={() => handleDeleteServer(server.id)} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
                                      <Trash2 size={16} /> Delete
                                  </button>
                                  <button onClick={() => { setEditingServer(server); setIsServerModalOpen(true); }} className="text-cyber-400 hover:text-white text-sm flex items-center gap-1">
                                      <Edit2 size={16} /> Configure
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* Server Edit/Create Modal */}
          {isServerModalOpen && editingServer && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-cyber-800 border border-cyber-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                      <div className="p-6 border-b border-cyber-700 flex justify-between items-center">
                          <h3 className="text-xl font-bold text-white">Configure Server Node</h3>
                          <button onClick={() => setIsServerModalOpen(false)}><XCircle className="text-gray-500 hover:text-white" /></button>
                      </div>
                      <div className="p-6 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs text-cyber-400 uppercase font-bold">Server Name</label>
                                  <input 
                                    className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1"
                                    value={editingServer.name} 
                                    onChange={e => setEditingServer({...editingServer, name: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-cyber-400 uppercase font-bold">Status</label>
                                  <select 
                                    className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1"
                                    value={editingServer.status}
                                    onChange={e => setEditingServer({...editingServer, status: e.target.value as any})}
                                  >
                                      <option value="active">Active</option>
                                      <option value="maintenance">Maintenance</option>
                                      <option value="offline">Offline</option>
                                  </select>
                              </div>
                          </div>
                          
                          <div>
                              <label className="text-xs text-cyber-400 uppercase font-bold">Upstream Sync URL</label>
                              <input 
                                className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1"
                                value={editingServer.subscriptionUrl} 
                                onChange={e => setEditingServer({...editingServer, subscriptionUrl: e.target.value})}
                                placeholder="https://provider.com/api/sub?..."
                              />
                              <p className="text-[10px] text-gray-500 mt-1">Used to auto-sync usage stats.</p>
                          </div>

                          <div>
                              <label className="text-xs text-cyber-400 uppercase font-bold">V2Ray Config / Connection Link</label>
                              <textarea 
                                className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1 h-24 font-mono text-xs"
                                value={editingServer.configLink} 
                                onChange={e => setEditingServer({...editingServer, configLink: e.target.value})}
                                placeholder="vless://..."
                              />
                              <p className="text-[10px] text-gray-500 mt-1">Users will copy this to connect.</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs text-cyber-400 uppercase font-bold">Total Data (GB)</label>
                                  <input 
                                    type="number"
                                    className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1"
                                    value={editingServer.totalDataGB} 
                                    onChange={e => setEditingServer({...editingServer, totalDataGB: parseFloat(e.target.value)})}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-cyber-400 uppercase font-bold">Data Used (GB)</label>
                                  <input 
                                    type="number"
                                    className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1"
                                    value={editingServer.dataUsedGB} 
                                    onChange={e => setEditingServer({...editingServer, dataUsedGB: parseFloat(e.target.value)})}
                                  />
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs text-cyber-400 uppercase font-bold">Total Days</label>
                                  <input 
                                    type="number"
                                    className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1"
                                    value={editingServer.totalDays} 
                                    onChange={e => setEditingServer({...editingServer, totalDays: parseInt(e.target.value)})}
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-cyber-400 uppercase font-bold">Days Remaining</label>
                                  <input 
                                    type="number"
                                    className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1"
                                    value={editingServer.daysRemaining} 
                                    onChange={e => setEditingServer({...editingServer, daysRemaining: parseInt(e.target.value)})}
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="text-xs text-cyber-400 uppercase font-bold">Public Message</label>
                              <input 
                                className="w-full bg-cyber-900 border border-cyber-700 rounded p-2 text-white mt-1"
                                value={editingServer.message} 
                                onChange={e => setEditingServer({...editingServer, message: e.target.value})}
                                placeholder="e.g. VIP Server - High Speed"
                              />
                          </div>

                          <div className="pt-4 flex justify-end gap-3">
                              <button onClick={() => setIsServerModalOpen(false)} className="px-4 py-2 rounded bg-cyber-900 hover:bg-cyber-800 text-gray-300">Cancel</button>
                              <button onClick={() => handleSaveServer(editingServer)} className="px-6 py-2 rounded bg-cyber-500 hover:bg-cyber-400 text-white font-bold shadow-lg shadow-cyber-500/20">Save Server</button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* Users View */}
          {activeTab === 'users' && !selectedUser && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search username or code..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-cyber-900 border border-cyber-700 rounded-lg pl-10 pr-4 py-2 focus:ring-1 focus:ring-cyber-500 outline-none"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <select 
                        className="bg-cyber-900 border border-cyber-700 rounded-lg px-2 py-2 text-sm outline-none"
                        value={newUserServerId}
                        onChange={(e) => setNewUserServerId(e.target.value)}
                    >
                        <option value="">Unbound</option>
                        {state.servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input 
                        type="text" 
                        placeholder="@username" 
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        className="bg-cyber-900 border border-cyber-700 rounded-lg px-4 py-2 focus:ring-1 focus:ring-cyber-500 outline-none w-40"
                    />
                    <button 
                        onClick={handleCreateUser}
                        className="bg-cyber-500 hover:bg-cyber-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 whitespace-nowrap"
                    >
                        <Plus size={18} />
                        <span>Generate</span>
                    </button>
                </div>
              </div>

              <div className="bg-cyber-800 rounded-xl border border-cyber-700 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-cyber-900/50 text-gray-400 text-sm">
                    <tr>
                      <th className="p-4 font-medium">Username</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium">Server</th>
                      <th className="p-4 font-medium hidden md:table-cell">Access Code</th>
                      <th className="p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-700">
                    {filteredUsers.map(user => {
                        const assignedServer = state.servers.find(s => s.id === user.serverId);
                        return (
                          <tr key={user.id} className="hover:bg-cyber-700/30 transition-colors">
                            <td className="p-4 font-medium text-white">{user.username}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    user.status === 'active' ? 'bg-cyber-accent/20 text-cyber-accent' : 
                                    user.status === 'pending_payment' ? 'bg-yellow-500/20 text-yellow-500' : 
                                    'bg-red-500/20 text-red-500'
                                }`}>
                                    {user.status.toUpperCase()}
                                </span>
                            </td>
                            <td className="p-4 text-sm">
                                {assignedServer ? (
                                    <span className="flex items-center gap-1 text-cyber-400"><Wifi size={12}/> {assignedServer.name}</span>
                                ) : (
                                    <span className="text-gray-600 italic">Unbound</span>
                                )}
                            </td>
                            <td className="p-4 hidden md:table-cell">
                                <code className="bg-cyber-900 px-2 py-1 rounded text-xs text-cyber-400 font-mono select-all">
                                    {user.code}
                                </code>
                            </td>
                            <td className="p-4">
                                <button 
                                    onClick={() => setSelectedUser(user)}
                                    className="text-cyber-500 hover:text-cyber-400 text-sm font-medium"
                                >
                                    Manage
                                </button>
                            </td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Single User Detail View */}
          {activeTab === 'users' && selectedUser && (
             <div className="bg-cyber-800 rounded-xl border border-cyber-700 p-6 max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold">{selectedUser.username}</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleDeleteUser(selectedUser.id)} 
                            className="bg-red-900/50 hover:bg-red-900 text-red-400 px-3 py-1 rounded border border-red-900 flex items-center gap-2"
                        >
                            <Trash2 size={14} /> Delete User
                        </button>
                        <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white border border-cyber-700 px-3 py-1 rounded bg-cyber-900">Close</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="bg-cyber-900 p-4 rounded-lg">
                            <label className="text-gray-500 text-xs uppercase block mb-1">Access Code</label>
                            <code className="text-xl text-cyber-400 font-mono break-all select-all">{selectedUser.code}</code>
                        </div>
                        
                        <div className="bg-cyber-900 p-4 rounded-lg">
                            <label className="text-gray-500 text-xs uppercase block mb-1">Assigned Server (Source of Truth)</label>
                            <select 
                                value={selectedUser.serverId || ''}
                                onChange={(e) => handleUpdateUser({...selectedUser, serverId: e.target.value || null})}
                                className="bg-cyber-800 border border-cyber-700 text-white text-sm rounded focus:ring-cyber-500 block w-full p-2"
                            >
                                <option value="">-- No Server Assigned --</option>
                                {state.servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.daysRemaining} days left)</option>)}
                            </select>
                            <p className="text-[10px] text-gray-500 mt-1">
                                User sees stats/config from this server. If unbound, they see nothing.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="bg-cyber-900 p-4 rounded-lg">
                                <label className="text-gray-500 text-xs uppercase block mb-1">Account Status</label>
                                <select 
                                    value={selectedUser.status}
                                    onChange={(e) => handleUpdateUser({...selectedUser, status: e.target.value as any})}
                                    className="bg-cyber-800 border border-cyber-700 text-white text-sm rounded focus:ring-cyber-500 block w-full p-2"
                                >
                                    <option value="active">Active</option>
                                    <option value="pending_payment">Pending Payment</option>
                                    <option value="expired">Expired</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Chat Section */}
                    <div className="flex flex-col h-96 bg-cyber-900 rounded-lg border border-cyber-700">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {selectedUser.messages.length === 0 && <div className="text-center text-gray-600 text-sm pt-10">No messages yet</div>}
                            {selectedUser.messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${msg.sender === 'admin' ? 'bg-cyber-500 text-white' : 'bg-cyber-700 text-gray-200'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t border-cyber-700 bg-cyber-800 rounded-b-lg">
                             <button 
                                onClick={generateAISuggestion}
                                disabled={isProcessing}
                                className="text-xs text-cyber-400 mb-2 flex items-center hover:text-cyber-300"
                            >
                                <Activity size={12} className="mr-1" /> 
                                {isProcessing ? 'Thinking...' : 'AI Suggest Reply'}
                            </button>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Type message..." 
                                    className="flex-1 bg-cyber-900 rounded px-3 py-2 text-sm outline-none border border-cyber-700 focus:border-cyber-500"
                                />
                                <button 
                                    onClick={() => handleSendMessage(selectedUser.id)}
                                    className="bg-cyber-500 hover:bg-cyber-400 text-white p-2 rounded"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
          )}

          {/* Requests View */}
          {activeTab === 'requests' && (
              <div className="grid grid-cols-1 gap-4">
                  {state.requests.length === 0 && (
                      <div className="text-center text-gray-500 py-10">No pending access inquiries.</div>
                  )}
                  {state.requests.map(req => (
                      <div key={req.id} className="bg-cyber-800 p-4 rounded-xl border border-cyber-700 flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                              <div className="bg-cyber-700 p-3 rounded-full">
                                  <Users size={20} className="text-cyber-400" />
                              </div>
                              <div>
                                  <h4 className="font-bold text-white">{req.username}</h4>
                                  <p className="text-xs text-gray-500">Requested: {new Date(req.timestamp).toLocaleDateString()}</p>
                              </div>
                          </div>
                          <div className="flex space-x-2">
                              <button 
                                onClick={() => {
                                    const updatedRequests = state.requests.filter(r => r.id !== req.id);
                                    onUpdate({ ...state, requests: updatedRequests });
                                }}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition"
                              >
                                  <XCircle />
                              </button>
                              <button 
                                onClick={() => handleApproveRequest(req)}
                                className="px-4 py-2 bg-cyber-500 hover:bg-cyber-400 text-white rounded-lg font-medium shadow-lg shadow-cyber-500/20"
                              >
                                  Approve & Generate
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          )}
          
          {/* Messages Overview */}
           {activeTab === 'messages' && (
               <div className="space-y-4">
                   <h3 className="text-lg font-semibold mb-4">Recent User Messages</h3>
                   {state.users
                    .filter(u => u.messages.some(m => m.sender === 'user' && !m.read))
                    .map(u => {
                        const lastMsg = [...u.messages].reverse().find(m => m.sender === 'user');
                        return (
                           <div key={u.id} className="bg-cyber-800 p-4 rounded-xl border border-cyber-700 hover:border-cyber-500 cursor-pointer transition-colors" onClick={() => { setActiveTab('users'); setSelectedUser(u); }}>
                               <div className="flex justify-between mb-2">
                                   <span className="font-bold text-cyber-400">{u.username}</span>
                                   <span className="text-xs text-gray-500">{new Date(lastMsg?.timestamp || 0).toLocaleTimeString()}</span>
                               </div>
                               <p className="text-gray-300 text-sm truncate">{lastMsg?.text}</p>
                           </div>
                        )
                    })
                   }
                   {state.users.filter(u => u.messages.some(m => m.sender === 'user' && !m.read)).length === 0 && (
                       <div className="text-center text-gray-500">All messages read.</div>
                   )}
               </div>
           )}

           {/* Settings View */}
           {activeTab === 'settings' && (
               <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95">
                   <div className="bg-cyber-800 p-6 rounded-xl border border-cyber-700">
                        <div className="flex items-center gap-3 mb-4">
                            <Lock className="text-cyber-danger" size={24} />
                            <h3 className="text-xl font-bold text-white">Admin Security</h3>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-cyber-400 mb-2 uppercase tracking-wide">
                                    Change Admin Password
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="flex-1 bg-cyber-900 border border-cyber-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-cyber-500 outline-none"
                                    />
                                    <button onClick={handleSaveSettings} className="bg-cyber-500 text-white px-6 rounded-lg font-bold">Update</button>
                                </div>
                            </div>
                        </div>
                   </div>
               </div>
           )}

        </main>
      </div>
    </div>
  );
};
