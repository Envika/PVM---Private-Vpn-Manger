import React, { useState, useEffect } from 'react';
import { AppState, UserData, Message, SignUpRequest } from '../types';
import { generateSecureCode, simulateDailyUpdate, saveState } from '../services/storage';
import { 
    Users, DollarSign, Activity, MessageSquare, Plus, RefreshCw, 
    Trash2, Send, AlertCircle, CheckCircle, XCircle, Search 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { suggestReply } from '../services/gemini';

interface AdminPanelProps {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ state, onUpdate, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'requests' | 'messages'>('dashboard');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Stats
  const totalUsers = state.users.length;
  const paidUsers = state.users.filter(u => u.status === 'active').length;
  const unpaidUsers = state.users.filter(u => u.status === 'pending_payment' || u.status === 'expired').length;
  
  const chartData = [
    { name: 'Active', value: paidUsers, color: '#10b981' },
    { name: 'Inactive', value: unpaidUsers, color: '#ef4444' },
    { name: 'Total', value: totalUsers, color: '#3b82f6' },
  ];

  const handleCreateUser = () => {
    if (!newUserUsername) return;
    const newUser: UserData = {
      id: crypto.randomUUID(),
      username: newUserUsername.startsWith('@') ? newUserUsername : `@${newUserUsername}`,
      code: generateSecureCode(),
      status: 'pending_payment',
      plan: { totalDays: 30, daysRemaining: 30, totalDataGB: 50, dataUsedGB: 0 },
      messages: [],
      joinedAt: Date.now()
    };
    onUpdate({ ...state, users: [newUser, ...state.users] });
    setNewUserUsername('');
    setActiveTab('users');
  };

  const handleSimulateUpdate = () => {
    const newState = simulateDailyUpdate(state);
    onUpdate(newState);
    saveState(newState); // Force save
  };

  const handleApproveRequest = (req: SignUpRequest) => {
    const newUser: UserData = {
        id: crypto.randomUUID(),
        username: req.username,
        code: generateSecureCode(),
        status: 'pending_payment',
        plan: { totalDays: 30, daysRemaining: 30, totalDataGB: 50, dataUsedGB: 0 },
        messages: [],
        joinedAt: Date.now()
    };
    
    const updatedRequests = state.requests.filter(r => r.id !== req.id);
    onUpdate({ ...state, users: [newUser, ...state.users], requests: updatedRequests });
  };

  const handleRejectRequest = (id: string) => {
    const updatedRequests = state.requests.filter(r => r.id !== id);
    onUpdate({ ...state, requests: updatedRequests });
  };

  const handleSendMessage = async (userId: string) => {
    if (!replyText) return;
    const updatedUsers = state.users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          messages: [...u.messages, { id: crypto.randomUUID(), sender: 'admin', text: replyText, timestamp: Date.now(), read: false } as Message]
        };
      }
      return u;
    });
    onUpdate({ ...state, users: updatedUsers });
    setReplyText('');
    
    // Update local selected user so UI refreshes immediately if looking at details
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

  // Filter users
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
            { id: 'requests', icon: Plus, label: 'Requests', count: state.requests.length },
            { id: 'messages', icon: MessageSquare, label: 'Messages' }
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
                onClick={handleSimulateUpdate}
                className="w-full flex items-center justify-center space-x-2 bg-cyber-700 hover:bg-cyber-600 text-xs py-2 rounded mb-2 text-gray-300"
            >
                <RefreshCw size={14} />
                <span>Simulate Daily Cron</span>
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
             <div className="text-xs text-gray-500">System Status: ONLINE</div>
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
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
                    <p className="text-gray-400 text-sm">Paid Active</p>
                    <h3 className="text-3xl font-bold text-cyber-accent mt-2">{paidUsers}</h3>
                  </div>
                  <CheckCircle className="text-cyber-accent opacity-80" />
                </div>
              </div>
              <div className="bg-cyber-800 p-6 rounded-xl border border-cyber-700 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-400 text-sm">Unpaid / Expired</p>
                    <h3 className="text-3xl font-bold text-cyber-danger mt-2">{unpaidUsers}</h3>
                  </div>
                  <AlertCircle className="text-cyber-danger opacity-80" />
                </div>
              </div>
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-cyber-800 p-6 rounded-xl border border-cyber-700 shadow-lg h-80">
                <h3 className="text-lg font-bold mb-4">User Distribution</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} 
                        itemStyle={{ color: '#e2e8f0' }}
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
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="@username" 
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        className="bg-cyber-900 border border-cyber-700 rounded-lg px-4 py-2 focus:ring-1 focus:ring-cyber-500 outline-none"
                    />
                    <button 
                        onClick={handleCreateUser}
                        className="bg-cyber-500 hover:bg-cyber-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
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
                      <th className="p-4 font-medium">Remaining</th>
                      <th className="p-4 font-medium hidden md:table-cell">Access Code</th>
                      <th className="p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-700">
                    {filteredUsers.map(user => (
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
                            <div className="flex flex-col">
                                <span>{user.plan.daysRemaining} days</span>
                                <span className="text-gray-500 text-xs">{(user.plan.totalDataGB - user.plan.dataUsedGB).toFixed(1)}GB left</span>
                            </div>
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
                    ))}
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
                    <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white">Close</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="bg-cyber-900 p-4 rounded-lg">
                            <label className="text-gray-500 text-xs uppercase block mb-1">Access Code (Send to User)</label>
                            <code className="text-xl text-cyber-400 font-mono break-all select-all">{selectedUser.code}</code>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                             <div className="bg-cyber-900 p-4 rounded-lg">
                                <label className="text-gray-500 text-xs uppercase block mb-1">Status</label>
                                <select 
                                    value={selectedUser.status}
                                    onChange={(e) => {
                                        const updatedUser = { ...selectedUser, status: e.target.value as any };
                                        setSelectedUser(updatedUser);
                                        const allUsers = state.users.map(u => u.id === selectedUser.id ? updatedUser : u);
                                        onUpdate({ ...state, users: allUsers });
                                    }}
                                    className="bg-cyber-800 border border-cyber-700 text-white text-sm rounded focus:ring-cyber-500 block w-full p-2"
                                >
                                    <option value="active">Active</option>
                                    <option value="pending_payment">Pending Payment</option>
                                    <option value="expired">Expired</option>
                                    <option value="banned">Banned</option>
                                </select>
                            </div>
                            <div className="bg-cyber-900 p-4 rounded-lg">
                                <label className="text-gray-500 text-xs uppercase block mb-1">Days Remaining</label>
                                <input 
                                    type="number" 
                                    value={selectedUser.plan.daysRemaining}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        const updatedUser = { ...selectedUser, plan: { ...selectedUser.plan, daysRemaining: val } };
                                        setSelectedUser(updatedUser);
                                        const allUsers = state.users.map(u => u.id === selectedUser.id ? updatedUser : u);
                                        onUpdate({ ...state, users: allUsers });
                                    }}
                                    className="bg-transparent text-white font-bold w-full outline-none border-b border-cyber-700 focus:border-cyber-500"
                                />
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
                             {/* AI Suggestion Button */}
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
                      <div className="text-center text-gray-500 py-10">No pending sign-up requests.</div>
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
                                onClick={() => handleRejectRequest(req.id)}
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
          
          {/* Messages Overview Tab */}
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

        </main>
      </div>
    </div>
  );
};