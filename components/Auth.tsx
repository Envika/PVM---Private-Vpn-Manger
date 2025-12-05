import React, { useState } from 'react';
import { Lock, Terminal, Copy, Check } from 'lucide-react';

interface AuthProps {
  onAdminLogin: (password: string) => boolean;
  onUserLogin: (code: string) => void;
  detectedTgId?: string | null;
}

export const Auth: React.FC<AuthProps> = ({ onAdminLogin, onUserLogin, detectedTgId }) => {
  const [mode, setMode] = useState<'login' | 'admin'>('login');
  const [inputCode, setInputCode] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  const handleUserLogin = () => {
    if (inputCode.length < 24) return;
    onUserLogin(inputCode);
  };

  const handleAdminLogin = () => {
    const success = onAdminLogin(adminPass);
    if (!success) {
        alert("Access Denied: Invalid Credentials");
    }
  };

  const handleCopyId = () => {
      if (detectedTgId) {
          navigator.clipboard.writeText(detectedTgId);
          setCopiedId(true);
          setTimeout(() => setCopiedId(false), 2000);
      }
  };

  return (
    <div className="min-h-screen bg-cyber-900 flex items-center justify-center p-4 font-mono relative overflow-hidden">
      {/* Background Grid */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
            backgroundImage: `linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)`,
            backgroundSize: '30px 30px'
        }}
      ></div>

      <div className="bg-cyber-800 border border-cyber-700 p-8 rounded-2xl shadow-2xl max-w-md w-full relative z-10 backdrop-blur-sm">
        <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-cyber-700 rounded-full flex items-center justify-center border-2 border-cyber-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                <Terminal className="text-cyber-400" size={32} />
            </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-white mb-2 tracking-widest">GHOST LAYER</h2>
        <p className="text-center text-gray-500 text-sm mb-8">SECURE TUNNEL ACCESS</p>

        {detectedTgId && mode === 'login' && (
             <div className="mb-6 bg-cyber-900/80 border border-cyber-500/30 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                 <p className="text-xs text-cyber-400 font-bold mb-2 uppercase">Telegram Identity Detected</p>
                 <div 
                    onClick={handleCopyId}
                    className="flex items-center justify-between bg-cyber-800 rounded p-2 border border-cyber-700 cursor-pointer hover:border-cyber-500 transition-colors group"
                 >
                     <code className="text-sm text-white">{detectedTgId}</code>
                     {copiedId ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500 group-hover:text-cyber-400" />}
                 </div>
                 <p className="text-[10px] text-gray-500 mt-2">
                     Send this ID to the administrator to request access.
                 </p>
             </div>
        )}

        {mode === 'login' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
                <label className="text-xs text-cyber-400 uppercase font-bold ml-1">Access Code</label>
                <div className="relative mt-1">
                    <input 
                        type="text" 
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        placeholder="Paste your 24-char key"
                        className="w-full bg-cyber-900 border border-cyber-700 rounded-lg px-4 py-3 text-white outline-none focus:border-cyber-500 focus:ring-1 focus:ring-cyber-500 transition-all text-center tracking-widest"
                    />
                    <Lock className="absolute right-3 top-3.5 text-gray-600" size={18} />
                </div>
            </div>
            
            <button 
                onClick={handleUserLogin}
                className="w-full bg-cyber-500 hover:bg-cyber-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-cyber-500/20 active:scale-95"
            >
                CONNECT
            </button>

            <div className="pt-4 border-t border-cyber-700 flex justify-center text-xs text-gray-400">
                <button onClick={() => setMode('admin')} className="hover:text-white transition-colors">Admin Portal</button>
            </div>
          </div>
        )}

        {mode === 'admin' && (
             <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-center text-xs text-red-400 mb-4">
                    ADMINISTRATIVE ACCESS
                </div>
                <div>
                    <label className="text-xs text-cyber-400 uppercase font-bold ml-1">Password</label>
                    <input 
                        type="password" 
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        placeholder="Enter admin password"
                        className="w-full bg-cyber-900 border border-cyber-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all mt-1"
                    />
                </div>
                
                <button 
                    onClick={handleAdminLogin}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all"
                >
                    AUTHENTICATE
                </button>

                <button onClick={() => setMode('login')} className="w-full text-xs text-gray-500 hover:text-white mt-4">
                   Cancel
               </button>
            </div>
        )}

      </div>
    </div>
  );
};