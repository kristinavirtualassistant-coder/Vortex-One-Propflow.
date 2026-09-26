import React, { useState, useRef, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Bot, User, FileText, Loader2, X } from 'lucide-react';
import Markdown from 'react-markdown';

type Message = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

export default function TenantChatbot({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [leaseContext, setLeaseContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const fetchLeaseDocs = async () => {
      try {
        const q = query(collection(db, 'lease_documents'));
        const querySnapshot = await getDocs(q);
        let contextText = '';
        querySnapshot.forEach((doc) => {
          contextText += `Document Title: ${doc.data().title}\nContent: ${doc.data().content}\n\n`;
        });
        
        // If empty, add a default fallback so the assistant knows
        if (!contextText) {
          contextText = "No specific lease documents found. Provide general tenant advice.";
        }

        setLeaseContext(contextText);
        setDocsLoaded(true);
      } catch (error) {
        console.error("Failed to load lease documents:", error);
        setLeaseContext("Error loading lease documents. Provide general advice.");
        setDocsLoaded(true);
      }
    };
    
    fetchLeaseDocs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !docsLoaded) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', parts: [{ text: userMessage }] }]);
    setLoading(true);

    try {
      // Create a temporary assistant message to stream into
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

      const systemInstruction = `You are a helpful and professional real estate AI assistant for PropertyFlow, specifically helping a tenant. Use the following lease documentation to answer their questions accurately. Do not invent policies not covered in the text. 
      
      LEASE DOCUMENTATION:
      ${leaseContext}
      `;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: messages,
          message: userMessage,
          systemInstruction,
        })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'model') {
                  lastMessage.parts[0].text += data.text;
                }
                return newMessages;
              });
            } catch (e) {
              // Ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === 'model') {
          lastMessage.parts[0].text = "Sorry, I encountered an error. Please try again.";
        }
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] sm:h-[600px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xl flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-indigo-600 text-white relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Lease Assistant</h3>
            <p className="text-xs text-indigo-100 flex items-center gap-1">
              {docsLoaded ? (
                <>Powered by AI & Lease Docs</>
              ) : (
                <><Loader2 className="w-3 h-3 animate-spin" /> Loading Docs...</>
              )}
            </p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
            <FileText className="h-12 w-12 text-slate-400 mb-3" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Have a lease question?</h3>
            <p className="text-sm text-slate-500 max-w-[250px]">I can help clarify terms, payment policies, and rules based on your property's documents.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[85%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                  {msg.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                </div>
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'}`}>
                  <div className="markdown-body prose dark:prose-invert prose-sm max-w-none">
                    <Markdown>{msg.parts[0].text}</Markdown>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || !docsLoaded}
            placeholder="Ask about pets, late fees, parking..."
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading || !docsLoaded}
            className="absolute right-1 top-1 bottom-1 w-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
