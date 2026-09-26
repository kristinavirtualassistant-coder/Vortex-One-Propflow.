import React, { useState } from 'react';
import { Send, MessageSquare, Phone, Mail } from 'lucide-react';

export default function CustomerSupport() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([
    { sender: 'support', text: 'Hello! How can we help you today?' }
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setMessages(prev => [...prev, { sender: 'user', text: message }]);
    setMessage('');
    
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        sender: 'support', 
        text: 'Thank you for reaching out. A support representative will be with you shortly.' 
      }]);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Support</h2>
        <p className="text-slate-500 dark:text-slate-400">We're here to help. Get in touch with our support team.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Live Chat</h3>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form onSubmit={handleSend} className="flex gap-2">
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..." 
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="submit" className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors">
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-center">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Phone className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Call Us</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Mon-Fri, 9am-6pm EST</p>
            <a href="tel:1-800-555-0199" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">1-800-555-0199</a>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-center">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Email Support</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">We'll reply within 24 hours</p>
            <a href="mailto:support@propflow.com" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">support@propflow.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
