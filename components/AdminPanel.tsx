
import React, { useState } from 'react';
import { AppState, UserData, Message, ServerNode } from '../types';
import { generateSecureCode, simulateLiveSync, generateUUID } from '../services/storage';
import { 
    Users, Activity, MessageSquare, Plus, RefreshCw, 
    Trash2, Send, CheckCircle, Search, Settings, Server,
    Database, LogOut, Wifi, Megaphone, Sparkles, Copy, Check, Lock, Save
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { suggestReply, generateBroadcastMessage } from '../services/gemini';

interface AdminPanelProps {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ state, onUpdate, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'servers' | 'messages' | 'broadcasts' | 'settings'>('dashboard');
  
  // User Management
  const [searchTerm, setSearchTerm] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserServerId, setNewUserServerId] = useState<string>('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Server Management
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverFormData, setServerFormData] = useState<Partial<ServerNode>>({});

  // Chat / Messages
  const [selectedChatUser, setSelectedChatUser] = useState<UserData | null>(null);
  const [replyText, setReplyText] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');

  // Broadcast
  const [broadcastTopic, setBroadcastTopic] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isGeneratingBroadcast, setIsGeneratingBroadcast] = useState(false);

  // Settings / Password
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  // Derived State
  const activeUsers = state.users.filter(u => u.status === 'active').length;
  const totalDataUsed = state.servers.reduce((acc, s) => acc + s.dataUsedGB, 0);
  
  const handleSync = () => {
    const newState = simulateLiveSync(state);
    onUpdate(newState);
  };

  const handleCreateUser = () => {
    if (!newUserUsername) return;
    
    const newUser: UserData = {
      id: generateUUID(),
      username: newUserUsername,
      code: generateSecureCode(),
      status: 'active',
      serverId: newUserServerId || null,
      plan: {
        totalDays: 30,
        daysRemaining: 30,
        totalDataGB: 100,
        dataUsedGB: 0
      },
      messages: [],
      joinedAt: Date.now()
    };

    onUpdate({
      ...state,
      users: [...state.users, newUser]
    });
    setNewUserUsername('');
  };

  const handleDeleteUser = (id: string) => {
      if(confirm('Are you sure you want to delete this user?')) {
          onUpdate({
              ...state,
              users: state.users.filter(u => u.id !== id)
          });
      }
  };

  const handleCopyCode = (id: string, code: string) => {
      navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Server Handlers
  const handleSaveServer = () => {
      if (!serverFormData.name || !serverFormData.configLink) return;

      let newServers = [...state.servers];
      if (serverFormData.id) {
          // Edit
          newServers = newServers.map(s => s.id === serverFormData.id ? { ...s, ...serverFormData } as ServerNode : s);
      } else {
          // Create
          const newServer: ServerNode = {
              id: generateUUID(),
              name: serverFormData.name!,
              subscriptionUrl: serverFormData.subscriptionUrl || '',
              configLink: serverFormData.configLink!,
              message: serverFormData.message || '',
              totalDataGB: Number(serverFormData.totalDataGB) || 1000,
              dataUsedGB: 0,
              totalDays: Number(serverFormData.totalDays) || 30,
              daysRemaining: Number(serverFormData.totalDays) || 30,
              status: 'active'
          };
          newServers.push(newServer);
      }
      onUpdate({ ...state, servers: newServers });
      setIsServerModalOpen(false);
      setServerFormData({});
  };

  const handleDeleteServer = (id: string) => {
      if (confirm('Are you sure you want to delete this server node? Users assigned to it will be unassigned.')) {
          const newServers = state.servers.filter(s => s.id !== id);
          // Unassign users
          const newUsers = state.users.map(u => 
             u.serverId === id ? { ...u, serverId: null } : u
          );
          
          onUpdate({
              ...state,
              servers: newServers,
              users: newUsers
          });
      }
  };

  // Chat Handlers
  const handleSelectChatUser = (user: UserData) => {
      // Mark messages as read when opening chat
      const hasUnread = user.messages.some(m => m.sender === 'user' && !m.read);
      
      let userToSet = user;

      if (hasUnread) {
          const updatedMessages = user.messages.map(m => 
              m.sender === 'user' ? { ...m, read: true } : m
          );
          userToSet = { ...user, messages: updatedMessages };
          
          onUpdate({
              ...state,
              users: state.users.map(u => u.id === user.id ? userToSet : u)
          });
      }

      setSelectedChatUser(userToSet);
      setActiveTab('messages');
  };

  const handleSendMessage = (userId: string) => {
      if (!replyText.trim()) return;
      const user = state.users.find(u => u.id === userId);
      if (!user) return;

      const newMsg: Message = {
          id: generateUUID(),
          sender: 'admin',
          text: replyText,
          timestamp: Date.now(),
          read: false // User needs to read it
      };

      const updatedUser = { ...user, messages: [...user.messages, newMsg] };
      onUpdate({
          ...state,
          users: state.users.map(u => u.id === userId ? updatedUser : u)
      });
      setReplyText('');
      setAiSuggestion('');
      setSelectedChatUser(updatedUser); // Update local selection to show new msg
  };

  const handleGetAiSuggestion = async (text: string) => {
      const suggestion = await suggestReply(text);
      setAiSuggestion(suggestion);
      setReplyText(suggestion);
  };

  // Broadcast Handlers
  const handleGenerateBroadcast = async () => {
      setIsGeneratingBroadcast(true);
      const msg = await generateBroadcastMessage(broadcastTopic, 'formal');
      setBroadcastMessage(msg);
      setIsGeneratingBroadcast(false);
  };

  const handleSendBroadcast = () => {
      if (!broadcastMessage.trim()) return;
      const newUsers = state.users.map(u => ({
          ...u,
          messages: [...u.messages, {
              id: generateUUID(),
              sender: 'admin' as const, // Explicit type cast if needed
              text: broadcastMessage,
              timestamp: Date.now(),
              read: false
          }]
      }));
      onUpdate({ ...state, users: newUsers });
      alert("Broadcast sent to all users!");
      setBroadcastTopic('');
      setBroadcastMessage('');
  };

  // Settings Handlers
  const handleChangePassword = () => {
      if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
          alert("Please fill in all fields");
          return;
      }
      
      if (passwordForm.current !== state.adminPassword) {
          alert("Current password is incorrect");
          return;
      }

      if (passwordForm.new !== passwordForm.confirm) {
          alert("New passwords do not match");
          return;
      }

      if (passwordForm.new.length < 4) {
          alert("Password must be at least 4 characters long");
          return;
      }

      if (confirm("Changing your password will log you out immediately. Do you want to continue?")) {
          onUpdate({ ...state, adminPassword: passwordForm.new });
          alert("Password updated successfully. Please log in again.");
          onLogout();
      }
  };

  // Render Helpers
  const renderDashboard = () => (
      <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                  { label: 'Total Users', value: state.users.length, icon: Users, color: 'text-blue-400' },
                  { label: 'Active Sessions', value: activeUsers, icon: Wifi, color: 'text-green-400' },
                  { label: 'Nodes Online', value: state.servers.filter(s => s.status === 'active').length, icon: Server, color: 'text-yellow-400' },
                  { label: 'Total Data (GB)', value: totalDataUsed.toFixed(1), icon: Activity, color: 'text-purple-400' }
              ].map((stat, i) => (
                  <div key={i} className="bg-cyber-800 p-4 rounded-xl border border-cyber-700 shadow-lg">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="text-gray-400 text-xs uppercase">{stat.label}</p>
                              <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
                          </div>
                          <stat.icon className={`${stat.color}`} size={24} />
                      </div>
                  </div>
              ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-cyber-800 p-6 rounded-xl border border-cyber-700">
                  <h3 className="text-white font-bold mb-4">Server Load</h3>
                  <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={state.servers}>
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                              <YAxis stroke="#94a3b8" fontSize={12} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                                itemStyle={{ color: '#e2e8f0' }}
                              />
                              <Bar dataKey="dataUsedGB" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
              
              <div className="bg-cyber-800 p-6 rounded-xl border border-cyber-700">
                   <h3 className="text-white font-bold mb-4">Quick Actions</h3>
                   <div className="grid grid-cols-2 gap-4">
                       <button onClick={handleSync} className="p-4 bg-cyber-700 hover:bg-cyber-600 rounded-lg flex flex-col items-center gap-2 transition-colors">
                           <RefreshCw size={24} className="text-blue-400" />
                           <span className="text-sm">Force Sync</span>
                       </button>
                       <button onClick={() => setActiveTab('broadcasts')} className="p-4 bg-cyber-700 hover:bg-cyber-600 rounded-lg flex flex-col items-center gap-2 transition-colors">
                           <Megaphone size={24} className="text-yellow-400" />
                           <span className="text-sm">Broadcast</span>
                       </button>
                       <button onClick={() => setActiveTab('users')} className="p-4 bg-cyber-700 hover:bg-cyber-600 rounded-lg flex flex-col items-center gap-2 transition-colors">
                           <Plus size={24} className="text-green-400" />
                           <span className="text-sm">Add User</span>
                       </button>
                       <button onClick={() => setActiveTab('servers')} className="p-4 bg-cyber-700 hover:bg-cyber-600 rounded-lg flex flex-col items-center gap-2 transition-colors">
                           <Server size={24} className="text-purple-400" />
                           <span className="text-sm">Manage Nodes</span>
                       </button>
                   </div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="flex h-screen bg-cyber-900 text-gray-200 font-mono overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-cyber-800 border-r border-cyber-700 flex flex-col">
            <div className="p-6 border-b border-cyber-700">
                <h1 className="text-xl font-bold text-white tracking-widest flex items-center gap-2">
                    <Database className="text-cyber-500" />
                    V2RAY<span className="text-cyber-500">MGR</span>
                </h1>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: Activity },
                    { id: 'users', label: 'Users', icon: Users },
                    { id: 'servers', label: 'Nodes', icon: Server },
                    { id: 'messages', label: 'Support', icon: MessageSquare },
                    { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
                    { id: 'settings', label: 'Settings', icon: Settings },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                            activeTab === item.id 
                                ? 'bg-cyber-500/20 text-cyber-400 border border-cyber-500/50' 
                                : 'text-gray-400 hover:bg-cyber-700 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon size={18} />
                            <span>{item.label}</span>
                        </div>
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-cyber-700">
                <button 
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <LogOut size={18} />
                    <span>Logout</span>
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="h-16 bg-cyber-800/50 border-b border-cyber-700 flex items-center justify-between px-6 backdrop-blur">
                <h2 className="text-lg font-bold text-white capitalize">{activeTab}</h2>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">Last Sync: {new Date(state.lastSyncTime).toLocaleTimeString()}</span>
                    <div className="w-8 h-8 bg-cyber-500 rounded-full flex items-center justify-center text-white font-bold">
                        A
                    </div>
                </div>
            </header>

            {/* Content Body */}
            <main className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {activeTab === 'dashboard' && renderDashboard()}
                
                {activeTab === 'users' && (
                    <div className="space-y-6">
                        {/* Add User Bar */}
                        <div className="bg-cyber-800 p-4 rounded-xl border border-cyber-700 flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">Username</label>
                                <input 
                                    type="text" 
                                    value={newUserUsername}
                                    onChange={(e) => setNewUserUsername(e.target.value)}
                                    className="w-full bg-cyber-900 border border-cyber-700 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder="@telegram_handle"
                                />
                            </div>
                            <div className="w-64">
                                <label className="text-xs text-gray-500 mb-1 block">Assign Node</label>
                                <select 
                                    value={newUserServerId}
                                    onChange={(e) => setNewUserServerId(e.target.value)}
                                    className="w-full bg-cyber-900 border border-cyber-700 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    <option value="">Select Node...</option>
                                    {state.servers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                                    ))}
                                </select>
                            </div>
                            <button 
                                onClick={handleCreateUser}
                                className="bg-cyber-500 hover:bg-cyber-400 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 h-[38px]"
                            >
                                <Plus size={16} /> Create
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input 
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-cyber-800 border border-cyber-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-cyber-500 outline-none" 
                            />
                        </div>

                        {/* Users Table */}
                        <div className="bg-cyber-800 rounded-xl border border-cyber-700 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-cyber-900 text-gray-400">
                                    <tr>
                                        <th className="p-4">User</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Node</th>
                                        <th className="p-4">Usage</th>
                                        <th className="p-4">Access Key</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cyber-700">
                                    {state.users
                                        .filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map(user => {
                                            const server = state.servers.find(s => s.id === user.serverId);
                                            // Usage is server based if linked, else local plan
                                            const usage = server ? server.dataUsedGB : user.plan.dataUsedGB;
                                            const total = server ? server.totalDataGB : user.plan.totalDataGB;
                                            const percent = total > 0 ? Math.min(100, (usage / total) * 100) : 0;

                                            return (
                                                <tr key={user.id} className="hover:bg-cyber-700/50 transition-colors">
                                                    <td className="p-4 font-bold text-white">{user.username}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs ${user.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                                            {user.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-400">{server?.name || 'Unassigned'}</td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-24 h-1.5 bg-cyber-900 rounded-full overflow-hidden">
                                                                <div className="h-full bg-cyber-500" style={{ width: `${percent}%` }}></div>
                                                            </div>
                                                            <span className="text-xs text-gray-500">{usage.toFixed(1)}GB</span>
                                                        </div>
                                                    </td>
                                                    <td 
                                                        className="p-4 font-mono text-xs text-cyber-400 cursor-pointer select-none group relative"
                                                        onClick={() => handleCopyCode(user.id, user.code)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate max-w-[100px] opacity-80 group-hover:opacity-100 transition-opacity">
                                                                {user.code}
                                                            </span>
                                                            {copiedCodeId === user.id ? (
                                                                <Check size={14} className="text-green-500 animate-in fade-in" />
                                                            ) : (
                                                                <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-cyber-500" />
                                                            )}
                                                        </div>
                                                        {copiedCodeId === user.id && (
                                                            <div className="absolute top-0 right-0 -mt-2 bg-green-900 text-green-200 text-[10px] px-1.5 py-0.5 rounded shadow-lg animate-in fade-in slide-in-from-bottom-1">
                                                                Copied
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right space-x-2">
                                                        <button 
                                                            onClick={() => handleSelectChatUser(user)}
                                                            className="p-1.5 hover:bg-cyber-600 rounded text-blue-400" title="Chat"
                                                        >
                                                            <MessageSquare size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="p-1.5 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded transition-colors" title="Delete User"
                                                        >
                                                            <Trash2 size={16} />
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

                {activeTab === 'servers' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                             <h3 className="text-white font-bold">Network Nodes</h3>
                             <button 
                                onClick={() => { setServerFormData({}); setIsServerModalOpen(true); }}
                                className="bg-cyber-500 hover:bg-cyber-400 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                             >
                                 <Plus size={16} /> Add Node
                             </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {state.servers.map(server => (
                                <div key={server.id} className="bg-cyber-800 rounded-xl border border-cyber-700 p-6 shadow-lg relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-cyber-900 flex items-center justify-center border border-cyber-600">
                                                <Server size={20} className="text-cyber-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white">{server.name}</h4>
                                                <span className={`text-xs ${server.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                                                    ● {server.status.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleDeleteServer(server.id)}
                                                className="p-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors"
                                                title="Delete Node"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => { setServerFormData(server); setIsServerModalOpen(true); }}
                                                className="p-2 hover:bg-cyber-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                title="Configure Node"
                                            >
                                                <Settings size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3 text-sm text-gray-400">
                                        <div className="flex justify-between">
                                            <span>Load:</span>
                                            <span className="text-white">{server.dataUsedGB.toFixed(1)} / {server.totalDataGB} GB</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-cyber-900 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-cyber-500" 
                                                style={{ width: `${Math.min(100, (server.dataUsedGB / server.totalDataGB) * 100)}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between pt-2">
                                            <span>Expiry:</span>
                                            <span className="text-white">{server.daysRemaining} Days</span>
                                        </div>
                                        <p className="text-xs italic bg-cyber-900/50 p-2 rounded border border-cyber-700/50 truncate">
                                            {server.configLink}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Server Modal */}
                        {isServerModalOpen && (
                            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
                                <div className="bg-cyber-800 border border-cyber-600 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                                    <h3 className="text-xl font-bold text-white mb-4">{serverFormData.id ? 'Edit Node' : 'New Node'}</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-500">Node Name</label>
                                            <input 
                                                className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-2 text-white" 
                                                value={serverFormData.name || ''}
                                                onChange={e => setServerFormData({...serverFormData, name: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">VLESS/VMESS Config Link</label>
                                            <input 
                                                className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-2 text-white font-mono text-xs" 
                                                value={serverFormData.configLink || ''}
                                                onChange={e => setServerFormData({...serverFormData, configLink: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Subscription URL (Optional)</label>
                                            <input 
                                                className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-2 text-white font-mono text-xs" 
                                                value={serverFormData.subscriptionUrl || ''}
                                                onChange={e => setServerFormData({...serverFormData, subscriptionUrl: e.target.value})}
                                                placeholder="https://..."
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-500">Total Data (GB)</label>
                                                <input 
                                                    type="number"
                                                    className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-2 text-white" 
                                                    value={serverFormData.totalDataGB || ''}
                                                    onChange={e => setServerFormData({...serverFormData, totalDataGB: Number(e.target.value)})}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500">Days Validity</label>
                                                <input 
                                                    type="number"
                                                    className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-2 text-white" 
                                                    value={serverFormData.totalDays || ''}
                                                    onChange={e => setServerFormData({...serverFormData, totalDays: Number(e.target.value)})}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Status</label>
                                            <select 
                                                 className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-2 text-white"
                                                 value={serverFormData.status || 'active'}
                                                 onChange={e => setServerFormData({...serverFormData, status: e.target.value as any})}
                                            >
                                                <option value="active">Active</option>
                                                <option value="maintenance">Maintenance</option>
                                                <option value="offline">Offline</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Welcome Message (Optional)</label>
                                            <input 
                                                className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-2 text-white" 
                                                value={serverFormData.message || ''}
                                                onChange={e => setServerFormData({...serverFormData, message: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button onClick={() => setIsServerModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                                        <button onClick={handleSaveServer} className="px-4 py-2 bg-cyber-500 text-white rounded-lg hover:bg-cyber-400">Save Node</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className="flex h-[calc(100vh-140px)] gap-4">
                        {/* User List */}
                        <div className="w-64 bg-cyber-800 rounded-xl border border-cyber-700 overflow-y-auto">
                            {state.users.map(u => {
                                const lastMsg = u.messages[u.messages.length - 1];
                                const hasUnread = u.messages.some(m => m.sender === 'user' && !m.read);
                                return (
                                    <div 
                                        key={u.id}
                                        onClick={() => handleSelectChatUser(u)}
                                        className={`p-4 border-b border-cyber-700 cursor-pointer hover:bg-cyber-700 transition-colors ${selectedChatUser?.id === u.id ? 'bg-cyber-700' : ''}`}
                                    >
                                        <div className="flex justify-between">
                                            <span className="font-bold text-white text-sm">{u.username}</span>
                                            {hasUnread && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-1">
                                            {lastMsg ? lastMsg.text : 'No messages'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 bg-cyber-800 rounded-xl border border-cyber-700 flex flex-col overflow-hidden">
                            {selectedChatUser ? (
                                <>
                                    <div className="p-4 border-b border-cyber-700 bg-cyber-900/30 flex justify-between items-center">
                                        <span className="font-bold text-white">{selectedChatUser.username}</span>
                                        <div className="text-xs text-gray-500">ID: {selectedChatUser.id.substring(0,6)}</div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {selectedChatUser.messages.map(msg => (
                                            <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[70%] p-3 rounded-xl text-sm ${
                                                    msg.sender === 'admin' 
                                                        ? 'bg-cyber-500 text-white rounded-br-none' 
                                                        : 'bg-cyber-700 text-gray-200 rounded-bl-none'
                                                }`}>
                                                    <p>{msg.text}</p>
                                                    <p className="text-[10px] opacity-50 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* AI Suggestion */}
                                    {selectedChatUser.messages.length > 0 && selectedChatUser.messages[selectedChatUser.messages.length - 1].sender === 'user' && (
                                        <div className="px-4 py-2 bg-cyber-900/50 border-t border-cyber-700 flex items-center justify-between">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Sparkles size={14} className="text-yellow-400 flex-shrink-0" />
                                                <p className="text-xs text-gray-400 italic truncate">
                                                    {aiSuggestion || "Generate AI reply..."}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    const lastUserMsg = [...selectedChatUser.messages].reverse().find(m => m.sender === 'user');
                                                    if (lastUserMsg) handleGetAiSuggestion(lastUserMsg.text);
                                                }}
                                                className="text-xs text-cyber-400 hover:text-white whitespace-nowrap"
                                            >
                                                Generate
                                            </button>
                                        </div>
                                    )}

                                    <div className="p-4 border-t border-cyber-700 flex gap-2">
                                        <input 
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            className="flex-1 bg-cyber-900 border border-cyber-600 rounded-lg px-4 py-2 text-white focus:border-cyber-500 outline-none"
                                            placeholder="Type message..."
                                            onKeyDown={e => e.key === 'Enter' && handleSendMessage(selectedChatUser.id)}
                                        />
                                        <button 
                                            onClick={() => handleSendMessage(selectedChatUser.id)}
                                            className="bg-cyber-500 hover:bg-cyber-400 text-white p-2 rounded-lg"
                                        >
                                            <Send size={20} />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-500">
                                    Select a conversation
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'broadcasts' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <Megaphone className="text-yellow-400" /> System Broadcast
                        </h3>
                        
                        <div className="bg-cyber-800 p-6 rounded-xl border border-cyber-700 space-y-6">
                            <div>
                                <label className="text-sm text-gray-400 block mb-2">Broadcast Topic</label>
                                <div className="flex gap-2">
                                    <input 
                                        value={broadcastTopic}
                                        onChange={e => setBroadcastTopic(e.target.value)}
                                        className="flex-1 bg-cyber-900 border border-cyber-600 rounded-lg px-4 py-2 text-white"
                                        placeholder="e.g. Server Maintenance"
                                    />
                                    <button 
                                        onClick={handleGenerateBroadcast}
                                        disabled={isGeneratingBroadcast || !broadcastTopic}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isGeneratingBroadcast ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                        AI Draft
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-gray-400 block mb-2">Message Content</label>
                                <textarea 
                                    value={broadcastMessage}
                                    onChange={e => setBroadcastMessage(e.target.value)}
                                    className="w-full h-32 bg-cyber-900 border border-cyber-600 rounded-lg p-4 text-white resize-none"
                                    placeholder="Type your announcement here..."
                                />
                            </div>

                            <button 
                                onClick={handleSendBroadcast}
                                className="w-full bg-cyber-500 hover:bg-cyber-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyber-500/20"
                            >
                                Send to All Users
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                     <div className="max-w-xl mx-auto space-y-8">
                         <h3 className="text-white font-bold flex items-center gap-2 mb-6">
                             <Settings size={24} className="text-cyber-500" /> Admin Settings
                         </h3>

                         <div className="bg-cyber-800 rounded-xl border border-cyber-700 overflow-hidden">
                             <div className="p-4 bg-cyber-900/50 border-b border-cyber-700 flex items-center gap-2">
                                 <Lock size={18} className="text-red-400" />
                                 <h4 className="font-bold text-white">Security Credentials</h4>
                             </div>
                             
                             <div className="p-6 space-y-4">
                                 <div>
                                     <label className="text-xs text-gray-500 uppercase font-bold">Current Password</label>
                                     <input 
                                         type="password"
                                         value={passwordForm.current}
                                         onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                                         className="w-full mt-1 bg-cyber-900 border border-cyber-700 rounded-lg px-4 py-2 text-white focus:border-cyber-500 outline-none"
                                         placeholder="Enter current password"
                                     />
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-4">
                                     <div>
                                         <label className="text-xs text-gray-500 uppercase font-bold">New Password</label>
                                         <input 
                                             type="password"
                                             value={passwordForm.new}
                                             onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                                             className="w-full mt-1 bg-cyber-900 border border-cyber-700 rounded-lg px-4 py-2 text-white focus:border-cyber-500 outline-none"
                                             placeholder="New password"
                                         />
                                     </div>
                                     <div>
                                         <label className="text-xs text-gray-500 uppercase font-bold">Confirm New</label>
                                         <input 
                                             type="password"
                                             value={passwordForm.confirm}
                                             onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                                             className="w-full mt-1 bg-cyber-900 border border-cyber-700 rounded-lg px-4 py-2 text-white focus:border-cyber-500 outline-none"
                                             placeholder="Repeat password"
                                         />
                                     </div>
                                 </div>

                                 <div className="pt-4 flex justify-end">
                                     <button 
                                         onClick={handleChangePassword}
                                         className="bg-cyber-500 hover:bg-cyber-400 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyber-500/20"
                                     >
                                         <Save size={18} /> Update Password
                                     </button>
                                 </div>
                             </div>
                         </div>
                         
                         <div className="bg-yellow-900/10 border border-yellow-600/30 p-4 rounded-xl flex items-start gap-3">
                             <div className="bg-yellow-900/30 p-2 rounded-full">
                                 <Activity size={20} className="text-yellow-500" />
                             </div>
                             <div>
                                 <h5 className="text-yellow-200 font-bold text-sm">System Note</h5>
                                 <p className="text-yellow-200/70 text-xs mt-1">
                                     Changing the administrator password will immediately invalidate the current session. You will be logged out and required to sign in with the new credentials.
                                 </p>
                             </div>
                         </div>
                     </div>
                )}
            </main>
        </div>
    </div>
  );
};
