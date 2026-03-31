import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ChatMessage } from '@/lib/store';
import { 
  Send, Search, MoreVertical, Phone, Video, 
  Check, CheckCheck, User as UserIcon, MessageSquare 
} from 'lucide-react';
import api from '@/lib/api';
import { io } from 'socket.io-client';

interface ChatInterfaceProps {
  currentUser: User;
  initialPartnerId?: string;
}

export default function ChatInterface({ currentUser, initialPartnerId }: ChatInterfaceProps) {
  const [partners, setPartners] = useState<User[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // Setup Socket connection
    socketRef.current = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000');
    socketRef.current.emit('join', currentUser.id);

    // Fetch Partners
    api.get('/auth/users').then(res => {
      const allUsers = res.data;
      const others = allUsers.filter((u: User) => u.id !== currentUser.id);
      setPartners(others);
      
      if (initialPartnerId) {
        const initP = others.find((u: User) => u.id === initialPartnerId);
        if (initP) setSelectedPartner(initP);
      }
    }).catch(console.error);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [currentUser.id, initialPartnerId]);

  useEffect(() => {
    if (selectedPartner) {
      api.get(`/chat/${selectedPartner.id}`).then(res => {
        setMessages(res.data);
      }).catch(console.error);
    }
  }, [selectedPartner]);

  useEffect(() => {
    if (!socketRef.current) return;
    const handleReceiveMessage = (message: ChatMessage) => {
      if (selectedPartner && (message.senderId === selectedPartner.id || message.receiverId === selectedPartner.id)) {
        setMessages(prev => [...prev, message]);
      }
    };
    socketRef.current.on('receive_message', handleReceiveMessage);
    return () => {
      socketRef.current.off('receive_message', handleReceiveMessage);
    };
  }, [selectedPartner]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedPartner) return;

    const text = inputText.trim();
    setInputText('');

    try {
      const res = await api.post('/chat', { receiverId: selectedPartner.id, text });
      setMessages(prev => [...prev, res.data]);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const filteredPartners = partners.filter(p => 
    p.organization?.toLowerCase().includes(searchQuery.toLowerCase())
  );


  return (
    <div className="flex h-[calc(100vh-120px)] bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xl">
      {/* Sidebar */}
      <div className="w-80 border-r border-border/50 flex flex-col bg-muted/20">
        <div className="p-4 bg-muted/40 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex gap-4 text-muted-foreground">
              <MessageSquare className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
              <MoreVertical className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search or start new chat" 
              className="w-full bg-background border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredPartners.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            filteredPartners.map(p => {
              return (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPartner(p)}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/10 ${selectedPartner?.id === p.id ? 'bg-muted/80' : ''}`}
                >
                  <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-medium truncate text-sm">{p.organization}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      Start chatting with {p.organization}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background/40">
        {selectedPartner ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{selectedPartner.organization}</h4>
                  <p className="text-[10px] text-primary">online</p>
                </div>
              </div>
              <div className="flex gap-6 text-muted-foreground">
                <Video className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
                <Phone className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
                <Search className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
                <MoreVertical className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90"
            >
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div 
                    key={m.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm relative group ${
                      m.senderId === currentUser.id 
                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                        : 'bg-card text-foreground rounded-tl-none border border-border/50'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${
                        m.senderId === currentUser.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        <span className="text-[9px]">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {m.senderId === currentUser.id && (
                          m.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-muted/40 border-t border-border/50">
              <form onSubmit={handleSendMessage} className="flex items-center gap-4">
                <input 
                  type="text" 
                  placeholder="Type a message" 
                  className="flex-1 bg-background border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/50 shadow-inner"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button 
                  type="submit" 
                  disabled={!inputText.trim()}
                  className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 opacity-20" />
            </div>
            <h3 className="text-xl font-medium mb-2 text-foreground">WhatsApp Hub</h3>
            <p className="max-w-md text-sm">Select a contact to start chatting. Send and receive messages in real-time across the FoodLoop sync network.</p>
            <div className="mt-8 flex items-center gap-2 text-xs opacity-50">
              <CheckCheck className="w-4 h-4 text-primary" /> End-to-end Socket Connection
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
