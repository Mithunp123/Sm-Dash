
import { useEffect, useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { BackButton } from "@/components/BackButton";
import { Send, MessageSquare, Trash2, Search, UserPlus, Users, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildImageUrl } from "@/utils/imageUtils";

interface Conversation {
  contact_id: number;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  contact_photo?: string;
  last_message: string;
  last_message_time: string;
  is_read: number;
  sender_id: number;
  unreadCount?: number;
}

interface ChatMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  message: string;
  is_read: number;
  created_at: string;
  sender_name: string;
  recipient_name: string;
}

const AdminMessages = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedContact, setSelectedContact] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // New User Dialog
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const { permissions, loading: permissionsLoading } = usePermissions();
  const currentUser = auth.getUser();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (permissionsLoading) return;

    loadConversations();
  }, [permissionsLoading]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedContact]);

  const loadConversations = async () => {
    try {
      const res = await api.getConversations();
      if (res.success) {
        setConversations(res.conversations || []);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load conversations");
    }
  };

  const loadHistory = async (contactId: number) => {
    try {
      setLoading(true);
      const res = await api.getMessageHistory(contactId);
      if (res.success) {
        setMessages(res.messages || []);
        // Refresh conversations to update unread status
        loadConversations();
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load message history");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (convo: Conversation) => {
    setSelectedContact(convo);
    loadHistory(convo.contact_id);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.getUsers();
      if (res.success && res.users) {
        setUsers(res.users.filter((u: any) => u.id !== currentUser?.id));
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const startConversation = (user: any) => {
    const existing = conversations.find(c => c.contact_id === user.id);
    if (existing) {
      handleSelectContact(existing);
    } else {
      const newConvo: Conversation = {
        contact_id: user.id,
        contact_name: user.name,
        contact_email: user.email,
        contact_role: user.role,
        last_message: "",
        last_message_time: new Date().toISOString(),
        is_read: 1,
        sender_id: currentUser?.id
      };
      setSelectedContact(newConvo);
      setMessages([]);
    }
    setShowNewChatDialog(false);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedContact) return;

    try {
      const res = await api.sendChatMessage({
        recipientId: selectedContact.contact_id,
        message: replyText.trim()
      });

      if (res.success) {
        setReplyText("");
        loadHistory(selectedContact.contact_id);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to send message");
    }
  };

  const deleteMessage = async (msgId: number) => {
    if (!confirm("Delete this message?")) return;
    try {
      const res = await api.deleteChatMessage(msgId);
      if (res.success) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
      }
    } catch (e) {
      toast.error("Failed to delete message");
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex-1 p-2 md:p-4 bg-background w-full h-screen">
      <div className="w-full h-full flex flex-col">
        <div className="mb-4">
          <BackButton to="/admin" />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground mb-1">Messages</h1>
            <p className="text-sm text-muted-foreground">Internal messaging system</p>
          </div>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden h-[calc(100vh-180px)]">
          {/* Conversations Sidebar */}
          <Card className="w-96 flex flex-col border-border/50 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <Button onClick={() => { setShowNewChatDialog(true); loadUsers(); }} className="w-full gap-2">
                <UserPlus className="w-4 h-4" />
                New Conversation
              </Button>
            </div>

            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No conversations</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredConversations.map(convo => (
                    <button
                      key={convo.contact_id}
                      onClick={() => handleSelectContact(convo)}
                      className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${selectedContact?.contact_id === convo.contact_id ? 'bg-muted' : ''
                        } ${convo.is_read === 0 && convo.sender_id !== currentUser?.id ? 'bg-primary/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-12 h-12 flex-shrink-0">
                          <AvatarImage src={convo.contact_photo ? buildImageUrl(convo.contact_photo) : undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {convo.contact_name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="font-semibold text-foreground truncate">{convo.contact_name}</div>
                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(convo.last_message_time).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground truncate font-medium">
                            {convo.last_message}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Chat View */}
          {selectedContact ? (
            <Card className="flex-1 flex flex-col border-border/50 bg-card overflow-hidden">
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {selectedContact.contact_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-foreground">{selectedContact.contact_name}</div>
                    <div className="text-xs text-muted-foreground">{selectedContact.contact_email}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No messages yet.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] group relative ${msg.sender_id === currentUser?.id
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                        : 'bg-muted rounded-2xl rounded-tl-sm'
                        } px-4 py-2 shadow-sm`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <div className={`text-[9px] mt-1 text-right opacity-70`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {msg.sender_id === currentUser?.id && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-border/50 bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={sendReply} disabled={!replyText.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 flex items-center justify-center border-border/50 bg-card">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p>Select a conversation to start messaging</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {users.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase())).map(u => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-md transition-colors"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.photo_url ? buildImageUrl(u.photo_url) : undefined} />
                      <AvatarFallback>{u.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div className="text-sm font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{u.role.replace('_', ' ')}</div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AdminMessages;
