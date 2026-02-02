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
import { Send, MessageSquare, CheckCheck, Trash2, Search, UserPlus, Users, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  dept?: string;
  year?: string;
}

interface Message {
  id: number;
  name: string;
  email: string;
  to_email?: string;
  message: string;
  created_at: string;
  read: boolean;
  reply?: string;
  replied_at?: string;
  replied_by?: string;
  admin_initiated?: boolean;
  user_role?: string;
  user_dept?: string;
  subject?: string;
}

const AdminMessages = () => {
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [devBypass, setDevBypass] = useState<boolean>(false);
  // Store the *email* of the selected student to identify the conversation
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // New User Dialog
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
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

    const isDev = (import.meta && (import.meta as any).env && (import.meta as any).env.DEV) || false;

    if (permissionsLoading) return;

    const isAdmin = currentUser?.role === 'admin';
    const canAccess = isAdmin || permissions.can_manage_messages;
    if (!canAccess) {
      if (!isDev || !devBypass) {
        toast.error("You don't have permission to access messages");
        navigate(currentUser?.role === 'office_bearer' ? "/office-bearer" : "/admin");
        return;
      }
    }
    load();
  }, [devBypass, permissions, permissionsLoading]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedEmail, msgs]);

  // Refresh interval
  useEffect(() => {
    const handleUpdate = () => load();
    window.addEventListener('adminMessage', handleUpdate);
    window.addEventListener('messageReply', handleUpdate);
    return () => {
      window.removeEventListener('adminMessage', handleUpdate);
      window.removeEventListener('messageReply', handleUpdate);
    };
  }, []);

  const load = () => {
    try {
      const json = localStorage.getItem('admin_messages');
      const arr = json ? JSON.parse(json) : [];
      setMsgs(arr);
    } catch (e) {
      console.error(e);
      setMsgs([]);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.getUsers();
      if (res.success && res.users) {
        // Filter to only show students and office bearers (not admins)
        const filteredUsers = res.users.filter((u: any) => u.role !== 'admin');
        setUsers(filteredUsers);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenNewChat = () => {
    setShowNewChatDialog(true);
    loadUsers();
  };

  const startConversation = (user: User) => {
    setSelectedEmail(user.email);
    setShowNewChatDialog(false);

    // We don't necessarily need to create a message immediately if the UI handles empty states,
    // but to be safe and consistent with previous logic, we can checking if one exists.
    // Actually, simply selecting the email is enough. If they send a message, it will created.
  };

  // Group messages by student email to form "Conversations"
  const conversations = useMemo(() => {
    const grouped: Record<string, Message[]> = {};

    msgs.forEach(m => {
      // Determine the "Student" side of the conversation
      // If I sent it (as admin), the student is the recipient (to_email)
      // If student sent it, the student is the sender (email)
      // We assume admins are sending TO students.

      const adminEmail = currentUser?.email;
      let studentEmail = m.email; // Default assume sender is student

      // If the message was sent BY the current admin (or any admin really, but let's stick to current logic which doesn't distinct admins deeply yet)
      // If m.email matches 'admin' logic or just based on context. 
      // Simplified: If the message has a to_email, use likely that as the target if sender is admin.
      // But for safety, let's group by: if m.email is mine, group by to_email. Else group by m.email.

      // Better heuristic: Messages usually have `user_role` attached if student sent them? 
      // Or we can just group by the email that IS NOT the current user's email.

      if (m.email === adminEmail && m.to_email) {
        studentEmail = m.to_email;
      }

      if (!grouped[studentEmail]) {
        grouped[studentEmail] = [];
      }
      grouped[studentEmail].push(m);
    });

    // Convert to array and sort by latest message
    return Object.entries(grouped).map(([email, userMsgs]) => {
      // Find the latest message for preview
      const latest = userMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      // Try to find user details from any message that has them
      const userDetailsMsg = userMsgs.find(m => m.name && m.email === email);
      const name = userDetailsMsg?.name || latest.name;
      const role = userDetailsMsg?.user_role;
      const dept = userDetailsMsg?.user_dept;

      // Count unread (only messages FROM student that are !read)
      // Messages from admin (m.email == currentUser.email) don't count as unread
      const unreadCount = userMsgs.filter(m => m.email === email && !m.read).length;

      return {
        email,
        name,
        role,
        dept,
        latestMessage: latest,
        unreadCount,
        allMessages: userMsgs
      };
    }).sort((a, b) => new Date(b.latestMessage.created_at).getTime() - new Date(a.latestMessage.created_at).getTime());
  }, [msgs, currentUser]);

  const filteredConversations = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConversation = useMemo(() => {
    if (!selectedEmail) return null;
    return conversations.find(c => c.email === selectedEmail) || {
      email: selectedEmail,
      name: users.find(u => u.email === selectedEmail)?.name || "Unknown User",
      role: users.find(u => u.email === selectedEmail)?.role,
      dept: users.find(u => u.email === selectedEmail)?.dept,
      allMessages: []
    };
  }, [selectedEmail, conversations, users]);

  // Flatten messages for the chat view (handle legacy 'reply' fields)
  const chatHistory = useMemo(() => {
    if (!selectedConversation?.allMessages) return [];

    const flat: any[] = [];
    selectedConversation.allMessages.forEach(m => {
      // Main message
      flat.push({
        id: m.id,
        text: m.message,
        sender: m.email,
        name: m.name,
        time: m.created_at,
        isMe: m.email === currentUser?.email,
        original: m // Keep ref for updates
      });

      // Legacy reply check
      if (m.reply) {
        flat.push({
          id: `reply-${m.id}`,
          text: m.reply,
          sender: currentUser?.email, // Assume replied by current/admin
          name: m.replied_by || 'Admin',
          time: m.replied_at || m.created_at,
          isMe: true,
          isLegacyReply: true
        });
      }
    });

    return flat.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [selectedConversation, currentUser]);

  const markRead = (email: string) => {
    // Mark ALL messages from this user as read
    const updated = msgs.map(m => {
      if (m.email === email && !m.read) {
        return { ...m, read: true };
      }
      return m;
    });
    setMsgs(updated);
    localStorage.setItem('admin_messages', JSON.stringify(updated));
  };

  useEffect(() => {
    if (selectedEmail) {
      markRead(selectedEmail);
    }
  }, [selectedEmail]); // Run when selection changes

  const sendReply = () => {
    if (!replyText.trim() || !selectedEmail) return;

    // Create a NEW message object for the reply
    const newMsg: Message = {
      id: Date.now(),
      name: currentUser?.name || 'Admin',
      email: currentUser?.email || 'admin@example.com',
      to_email: selectedEmail,
      message: replyText.trim(),
      created_at: new Date().toISOString(),
      read: false, // User hasn't read it yet
      admin_initiated: true // Flag to indicate admin sent this
    };

    const updated = [...msgs, newMsg];
    setMsgs(updated);
    localStorage.setItem('admin_messages', JSON.stringify(updated));
    setReplyText("");

    // Notify
    window.dispatchEvent(new Event('adminMessage'));
    toast.success('Message sent');
  };

  const handleApprove = (msgId: number) => {
    // For approval, we still use the legacy "reply" method on the specific permission request message
    // because that's likely how the UI expects to link the approval to the request.
    const approvalMsg = "✅ Permission Request Approved";

    const updated = msgs.map(m =>
      m.id === msgId
        ? {
          ...m,
          reply: approvalMsg,
          replied_at: new Date().toISOString(),
          replied_by: currentUser?.name || 'Admin',
          read: true
        }
        : m
    );

    setMsgs(updated);
    localStorage.setItem('admin_messages', JSON.stringify(updated));

    // Add to notifications
    try {
      const msg = msgs.find(m => m.id === msgId);
      if (msg) {
        const replyNotifications = JSON.parse(localStorage.getItem('message_replies') || '[]');
        replyNotifications.push({
          id: Date.now(),
          message_id: msgId,
          email: msg.email,
          name: msg.name,
          original_message: msg.message,
          reply: approvalMsg,
          replied_by: currentUser?.name || 'Admin',
          replied_at: new Date().toISOString(),
          read: false
        });
        localStorage.setItem('message_replies', JSON.stringify(replyNotifications));
        window.dispatchEvent(new Event('messageReply'));
      }
    } catch (e) { console.error(e); }

    toast.success('Permission Approved');
  };

  const deleteConversation = (email: string) => {
    if (!confirm("Are you sure you want to delete this entire conversation?")) return;

    const updated = msgs.filter(m => m.email !== email && m.to_email !== email);
    setMsgs(updated);
    localStorage.setItem('admin_messages', JSON.stringify(updated));
    if (selectedEmail === email) setSelectedEmail(null);
    toast.success("Conversation deleted");
  };

  return (
    <main className="flex-1 p-2 md:p-4 bg-background w-full h-screen">
      <div className="w-full h-full flex flex-col">
        <div className="mb-4">
          <BackButton to="/admin" />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground mb-1">Messages</h1>
            <p className="text-sm text-muted-foreground">WhatsApp-style messaging interface</p>
          </div>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden h-[calc(100vh-180px)]">
          {/* Conversations Sidebar */}
          <Card className="w-96 flex flex-col border-border/50 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <Button onClick={handleOpenNewChat} className="w-full gap-2">
                <UserPlus className="w-4 h-4" />
                New Conversation
              </Button>
            </div>

            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
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
                  <p>No conversations found</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredConversations.map(convo => (
                    <button
                      key={convo.email}
                      onClick={() => setSelectedEmail(convo.email)}
                      className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${selectedEmail === convo.email ? 'bg-muted' : ''
                        } ${convo.unreadCount > 0 ? 'bg-primary/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-12 h-12 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {convo.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="font-semibold text-foreground truncate">{convo.name}</div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(convo.latestMessage.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground truncate mb-1">
                            {convo.role && <Badge variant="outline" className="text-xs mr-2">{convo.role}</Badge>}
                            {convo.email}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-muted-foreground truncate flex-1">
                              {convo.latestMessage.message.replace(/\*\*/g, '')}
                            </div>
                            {convo.unreadCount > 0 && (
                              <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0">
                                {convo.unreadCount}
                              </Badge>
                            )}
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
          {selectedEmail ? (
            <Card className="flex-1 flex flex-col border-border/50 bg-card overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {(selectedConversation?.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-foreground">{selectedConversation?.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      {selectedConversation?.email}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteConversation(selectedEmail!)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {chatHistory.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div key={`${msg.id}-${idx}`} className={`flex w-full ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${msg.isMe
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                          : 'bg-muted rounded-2xl rounded-tl-sm'
                        } px-4 py-3 shadow-sm`}>

                        {/* Subject / Permission Header */}
                        {msg.original?.subject && !msg.isMe && (
                          <div className="font-bold text-xs mb-1 uppercase tracking-wider opacity-70">
                            {msg.original.subject}
                          </div>
                        )}

                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>

                        {/* Permission Actions */}
                        {!msg.isMe && !msg.isLegacyReply && !msg.original?.reply && msg.original?.message?.includes("**PERMISSION REQUEST**") && (
                          <div className="mt-3 pt-2 border-t border-border/20">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleApprove(msg.id)}
                              className="w-full bg-white/20 hover:bg-white/30 text-white border-0 h-8 text-xs"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Approve Request
                            </Button>
                          </div>
                        )}

                        <div className={`text-[10px] mt-1 text-right ${msg.isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(msg.time).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Input */}
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
                  <Button
                    onClick={sendReply}
                    disabled={!replyText.trim()}
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 flex items-center justify-center border-border/50 bg-card">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a student to message</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Start New Conversation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {loadingUsers ? (
                <div className="p-4 text-center">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {users.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase())).map(u => (
                    <button
                      key={u.id}
                      onClick={() => startConversation(u)}
                      className="w-full text-left p-2 hover:bg-muted rounded flex items-center gap-3"
                    >
                      <Avatar>
                        <AvatarFallback>{u.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AdminMessages;
