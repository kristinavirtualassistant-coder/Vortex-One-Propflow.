import React, { useState } from 'react';
import { MessageSquare, Search, Send, User } from 'lucide-react';

export default function MessageCenter() {
  const [activeChat, setActiveChat] = useState(1);
  const [newMessage, setNewMessage] = useState('');

  const contacts = [
    { id: 1, name: 'Alice Smith', unit: 'Apt 4B', role: 'Tenant', unread: 2 },
    { id: 2, name: 'Bob Johnson', unit: 'Suite 102', role: 'Tenant', unread: 0 },
    { id: 3, name: 'Acme Plumbing', unit: 'Vendor', role: 'Contractor', unread: 0 },
    { id: 4, name: 'Sarah Landlord', unit: 'Owner', role: 'Landlord', unread: 1 },
  ];

  const messages = [
    { id: 1, senderId: 1, text: 'Hi, I noticed the water pressure is low today.', time: '10:30 AM', isMe: false },
    { id: 2, senderId: 'me', text: 'Thanks for letting us know Alice. I will have a technician check the main valve.', time: '10:45 AM', isMe: true },
    { id: 3, senderId: 1, text: 'Perfect, thank you!', time: '10:46 AM', isMe: false },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex h-[600px]">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-800/50">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white mb-3">Messages</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.map(contact => (
            <div 
              key={contact.id}
              onClick={() => setActiveChat(contact.id)}
              className={`p-4 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${
                activeChat === contact.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{contact.name}</h4>
                {contact.unread > 0 && (
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {contact.unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {contact.role} • {contact.unit}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-2/3 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{contacts.find(c => c.id === activeChat)?.name}</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Online</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                msg.isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-tl-none'
              }`}>
                <p className="text-sm">{msg.text}</p>
                <p className={`text-[10px] mt-1 text-right ${msg.isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <form 
            onSubmit={(e) => { e.preventDefault(); if(newMessage.trim()) setNewMessage(''); }}
            className="flex gap-2 relative"
          >
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..." 
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="absolute right-1 top-1 bottom-1 w-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
