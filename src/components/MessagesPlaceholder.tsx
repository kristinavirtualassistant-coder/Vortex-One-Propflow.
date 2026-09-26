import React, { useState } from 'react';
import { MessageSquare, Bell, Search, Send, User } from 'lucide-react';

export default function MessagesPlaceholder() {
  const [activeChat, setActiveChat] = useState(1);
  const [message, setMessage] = useState('');

  const chats = [
    { id: 1, name: 'Sarah Jenkins (Property Mgr)', unread: 2, lastMsg: 'The plumber will arrive tomorrow at 10 AM.', time: '10:42 AM' },
    { id: 2, name: 'Automated Notifications', unread: 0, lastMsg: 'Rent reminder: Your rent is due in 3 days.', time: 'Yesterday' },
    { id: 3, name: 'Dave Smith (Landlord)', unread: 0, lastMsg: 'Thanks for sending the signed lease.', time: 'Oct 12' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Direct Messaging & Alerts</h2>
          <p className="text-slate-500 dark:text-slate-400">Communicate securely with tenants, managers, and receive automated alerts.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex h-[600px]">
        {/* Sidebar */}
        <div className="w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input type="text" placeholder="Search messages..." className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => setActiveChat(chat.id)}
                className={`p-4 border-b border-slate-100 dark:border-slate-800/50 cursor-pointer transition-colors ${activeChat === chat.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-semibold text-sm truncate ${chat.unread > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{chat.name}</h4>
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{chat.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-xs truncate ${chat.unread > 0 ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-500'}`}>{chat.lastMsg}</p>
                  {chat.unread > 0 && <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">{chat.unread}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/50">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                {activeChat === 2 ? <Bell className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{chats.find(c => c.id === activeChat)?.name}</h3>
                <p className="text-xs text-emerald-500 font-medium">Online</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <div className="flex justify-center">
              <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-full font-medium">Yesterday</span>
            </div>
            
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 p-3 rounded-2xl rounded-tl-none max-w-[70%] shadow-sm text-sm">
                Hi! Just wanted to follow up on the maintenance request I submitted for the leaking faucet.
              </div>
            </div>
            
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 p-3 rounded-2xl rounded-tl-none max-w-[70%] shadow-sm text-sm">
                {chats.find(c => c.id === activeChat)?.lastMsg}
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message securely..." 
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
