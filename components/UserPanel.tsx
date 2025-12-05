
import React, { useState, useEffect, useRef } from 'react';
import { UserData, Message, AppState } from '../types';
import { BotLogic, generateUUID } from '../services/storage';
import {  
    Wifi, Calendar, Download, Send, MessageSquare, 
    Shield, Activity, LogOut, Copy, Check, Info, Server, AlertTriangle, Link as LinkIcon
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface UserPanelProps {
  user: UserData;
  fullState: AppState; // Needed to get base config
  onUpdateUser: (updatedUser: UserData) => void;
  onLogout: () => void;
}

export const UserPanel: React.FC<UserPanelProps> = ({ user, fullState, onUpdateUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'support'>('home');
  const [msgText, setMsgText] = useState('');
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedSub, setCopiedSub] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const assignedServer = fullState.servers.find(s => s.id === user.serverId);

  useEffect(() => {
      // Auto-scroll to bottom of chat
      if (activeTab === 'support' && messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }

      // Safe mark read logic
      if (activeTab === 'support') {
          const hasUnread = user.messages.some(m => m.sender === 'admin' && !m.read);
          if (hasUnread) {
               const updatedMessages = user.messages.map(m => 
                  m.sender === 'admin' ? { ...m, read: true } : m
              );
              // Directly update to avoid render loop if not handled upstream, 
              // but here we trust the callback to update the parent.
              onUpdateUser({ ...user, messages: updatedMessages });
          }
      }
  }, [activeTab, user.messages]);

  const handleSendMessage = () => {
    if (!msgText.trim()) return;
    
    // We can simulate sending message via BotLogic locally first for UI responsiveness
    // In a real bot, this would API call.
    const newMessage: Message = {
      id: generateUUID(),
      sender: 'user',
      text: msgText,
      timestamp: Date.now(),
      read: false
    };
    onUpdateUser({ ...user, messages: [...user.messages, newMessage] });
    setMsgText('');
  };

  const handleCopyLink = () => {
      if (!assignedServer) return;
      const link = `${assignedServer.configLink}#${user.username}`;
      navigator.clipboard.writeText(link);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleCopySub = () => {
      if (!assignedServer || !assignedServer.subscriptionUrl) return;
      navigator.clipboard.writeText(assignedServer.subscriptionUrl);
      setCopiedSub(true);
      setTimeout(() => setCopiedSub(false), 2000);
  };

  // Determine which stats to show (Shared Server Stats if bound, otherwise fallback/empty)
  const stats = assignedServer ? {
      totalData: assignedServer.totalDataGB,
      usedData: assignedServer.dataUsedGB,
      totalDays: assignedServer.totalDays,
      daysRemaining: assignedServer.daysRemaining
  } : {
      totalData: 0,
      usedData: 0,
      totalDays: 1,
      daysRemaining: 0
  };

  const dataPercentage = stats.totalData > 0 ? Math.min(100, (stats.usedData / stats.totalData) * 100) : 0;
  
  const dataChart = [
      { name: 'Used', value: stats.usedData, color: '#3b82f6' },
      { name: 'Remaining', value: stats.totalData - stats.usedData, color: '#1e293b' }
  ];

  const daysChart = [
      { name: 'Remaining', value: stats.daysRemaining, color: '#10b981' },
      { name: 'Passed', value: stats.totalDays - stats.daysRemaining, color: '#1e293b' }
  ];

  const hasAccess = user.status === 'active' && assignedServer && assignedServer.status === 'active';

  return (
    <div className="flex h-screen bg-cyber-900 text-gray-200 font-mono relative overflow-hidden">
        {/* Mobile-first bottom nav structure */}
        <div className="flex-1 flex flex-col h-full max-w-md mx-auto w-full bg-cyber-900 border-x border-cyber-800 shadow-2xl relative z-10">
            
            {/* Header */}
            <header className="p-6 flex justify-between items-center bg-cyber-800/80 backdrop-blur border-b border-cyber-700 sticky top-0 z-20">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-cyber-700 flex items-center justify-center border border-cyber-500">
                        <Shield className="text-cyber-500" size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-white tracking-wide">{user.username}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded ${hasAccess ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                            {hasAccess ? 'SECURED' : 'DISCONNECTED'}
                        </span>
                    </div>
                </div>
                <button onClick={onLogout} className="text-gray-500 hover:text-white">
                    <LogOut size={20} />
                </button>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide pb-24">
                
                {activeTab === 'home' && (
                    <>  
                        {/* Server Info Card */}
                        {assignedServer ? (
                            <div className="bg-cyber-800 rounded-xl border border-cyber-700 p-4 shadow-lg relative overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Server size={18} className="text-cyber-accent" />
                                        <span className="font-bold text-white text-sm">{assignedServer.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full ${assignedServer.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        <span className="text-[10px] text-gray-400">{assignedServer.status.toUpperCase()}</span>
                                    </div>
                                </div>
                                <div className="bg-cyber-900/50 rounded-lg p-3 border border-cyber-700/50 font-mono text-xs text-gray-300 space-y-2">
                                    <p className="text-cyber-400 italic">"{assignedServer.message}"</p>
                                    <div className="flex justify-between border-t border-cyber-700 pt-2">
                                        <span>Node Capacity:</span>
                                        <span>{stats.totalData} GB</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Node Expiry:</span>
                                        <span>{stats.daysRemaining} Days</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-center gap-3">
                                <AlertTriangle className="text-red-500" />
                                <div className="text-sm text-red-300">No Server Assigned. Contact Admin.</div>
                            </div>
                        )}

                        {/* Status Cards */}
                        {assignedServer && (
                            <div className="grid grid-cols-2 gap-4">
                                {/* Data Usage */}
                                <div className="bg-cyber-800 rounded-2xl p-4 border border-cyber-700 flex flex-col items-center shadow-lg relative overflow-hidden group h-48">
                                    <div className="absolute inset-0 bg-cyber-500/5 group-hover:bg-cyber-500/10 transition-colors"></div>
                                    <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2 z-10">Data Used</h3>
                                    <div className="h-24 w-24 relative z-10">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={dataChart} innerRadius={35} outerRadius={45} 
                                                    paddingAngle={5} dataKey="value" stroke="none"
                                                >
                                                    {dataChart.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                                            <span className="text-lg font-bold text-white">{Math.round(dataPercentage)}%</span>
                                        </div>
                                    </div>
                                    <div className="mt-auto text-center z-10">
                                        <span className="text-xl font-bold text-white">{stats.usedData.toFixed(1)}</span>
                                        <span className="text-xs text-gray-500"> GB</span>
                                    </div>
                                </div>

                                {/* Days Remaining */}
                                <div className="bg-cyber-800 rounded-2xl p-4 border border-cyber-700 flex flex-col items-center shadow-lg relative overflow-hidden group h-48">
                                    <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors"></div>
                                    <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2 z-10">Validity</h3>
                                    <div className="h-24 w-24 relative z-10">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={daysChart} innerRadius={35} outerRadius={45} 
                                                    paddingAngle={5} dataKey="value" stroke="none"
                                                >
                                                    {daysChart.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                                            <span className="text-lg font-bold text-white">{stats.daysRemaining}</span>
                                        </div>
                                    </div>
                                    <div className="mt-auto text-center z-10">
                                        <span className="text-xl font-bold text-white">{stats.daysRemaining}</span>
                                        <span className="text-xs text-gray-500"> Days</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Connection Button */}
                        <div className="space-y-3">
                            {/* Primary: Copy Config */}
                            <div className="bg-gradient-to-br from-cyber-800 to-cyber-900 rounded-2xl p-1 border border-cyber-700 shadow-xl">
                                <div className="bg-cyber-900/50 rounded-xl p-6 flex flex-col items-center text-center space-y-4">
                                    <h3 className="text-lg font-bold text-white">V2Ray Configuration</h3>
                                    <p className="text-sm text-gray-400">Import this connection key into your client.</p>
                                    
                                    <button 
                                        onClick={handleCopyLink}
                                        disabled={!hasAccess}
                                        className={`w-full py-4 rounded-xl flex items-center justify-center space-x-2 transition-all transform active:scale-95 font-bold ${
                                            hasAccess
                                                ? copiedConfig ? 'bg-green-600 text-white' : 'bg-cyber-500 hover:bg-cyber-400 text-white shadow-lg shadow-cyber-500/30' 
                                                : 'bg-cyber-800 text-gray-500 cursor-not-allowed border border-cyber-700'
                                        }`}
                                    >
                                        {hasAccess ? (
                                            copiedConfig ? <><Check size={20} /><span>Copied!</span></> : <><Copy size={20} /><span>Copy Access Key</span></>
                                        ) : (
                                            <><Shield size={20} /><span>Subscription Inactive</span></>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Secondary: Copy Subscription (If available) */}
                            {hasAccess && assignedServer?.subscriptionUrl && (
                                <button 
                                    onClick={handleCopySub}
                                    className={`w-full py-3 rounded-xl flex items-center justify-center space-x-2 border border-cyber-700 hover:bg-cyber-800 transition-colors ${copiedSub ? 'text-green-400' : 'text-cyber-400'}`}
                                >
                                    {copiedSub ? <Check size={18} /> : <LinkIcon size={18} />}
                                    <span className="text-sm font-bold">Copy Full Subscription Link</span>
                                </button>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'support' && (
                    <div className="flex flex-col h-full h-[70vh] bg-cyber-800 rounded-2xl border border-cyber-700 overflow-hidden">
                        <div className="bg-cyber-900/50 p-4 border-b border-cyber-700">
                            <h3 className="font-bold text-white">Support Chat</h3>
                            <p className="text-xs text-gray-500">Direct line to admin</p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {user.messages.length === 0 && (
                                <div className="text-center text-gray-600 mt-10">
                                    <MessageSquare className="mx-auto mb-2 opacity-50" size={32} />
                                    <p>No messages yet. Ask us anything.</p>
                                </div>
                            )}
                            {user.messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                                        msg.sender === 'user' 
                                            ? 'bg-cyber-500 text-white rounded-tr-none' 
                                            : 'bg-cyber-700 text-gray-200 rounded-tl-none'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-3 bg-cyber-900 border-t border-cyber-700 flex gap-2">
                            <input 
                                type="text" 
                                value={msgText}
                                onChange={(e) => setMsgText(e.target.value)}
                                placeholder="Type your issue..."
                                className="flex-1 bg-cyber-800 text-white rounded-xl px-4 py-2 outline-none border border-cyber-700 focus:border-cyber-500 text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button 
                                onClick={handleSendMessage}
                                className="bg-cyber-500 hover:bg-cyber-400 text-white p-2 rounded-xl transition-colors"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="h-16 bg-cyber-800 border-t border-cyber-700 flex items-center justify-around px-6 absolute bottom-0 w-full z-20">
                <button 
                    onClick={() => setActiveTab('home')}
                    className={`flex flex-col items-center space-y-1 ${activeTab === 'home' ? 'text-cyber-400' : 'text-gray-500'}`}
                >
                    <Wifi size={20} />
                    <span className="text-[10px] font-bold">DASHBOARD</span>
                </button>
                <button 
                    onClick={() => setActiveTab('support')}
                    className={`flex flex-col items-center space-y-1 ${activeTab === 'support' ? 'text-cyber-400' : 'text-gray-500'}`}
                >
                    <MessageSquare size={20} />
                    <span className="text-[10px] font-bold">SUPPORT</span>
                    {user.messages.some(m => m.sender === 'admin' && !m.read) && (
                        <span className="absolute top-3 ml-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                </button>
            </nav>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
             <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyber-500/5 rounded-full blur-[100px]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyber-accent/5 rounded-full blur-[100px]"></div>
        </div>
    </div>
  );
};
