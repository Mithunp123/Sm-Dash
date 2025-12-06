import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { Send, MessageSquare, ArrowLeft } from "lucide-react";

const AdminMessages = () => {
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [devBypass, setDevBypass] = useState<boolean>(false);
  const [filterIdx, setFilterIdx] = useState<number>(0);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const filterStatuses = ["all", "unread", "read", "replied"];

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const user = auth.getUser();
    const isDev = (import.meta && (import.meta as any).env && (import.meta as any).env.DEV) || false;
    
    // Wait for permissions to load
    if (permissionsLoading) return;

    const isAdmin = user?.role === 'admin';
    const canAccess = isAdmin || permissions.can_manage_messages;
    if (!canAccess) {
      if (!isDev || !devBypass) {
        toast.error("You don't have permission to access messages");
        navigate(user?.role === 'office_bearer' ? "/office-bearer" : "/admin");
        return;
      }
    }
    load();
  }, [devBypass, permissions, permissionsLoading]);

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

  const markRead = (id: number) => {
    const updated = msgs.map(m => m.id === id ? { ...m, read: true } : m);
    setMsgs(updated);
    localStorage.setItem('admin_messages', JSON.stringify(updated));
    toast.success('Marked read');
  };

  const remove = (id: number) => {
    const updated = msgs.filter(m => m.id !== id);
    setMsgs(updated);
    localStorage.setItem('admin_messages', JSON.stringify(updated));
    toast.success('Deleted');
  };

  const handleReply = (msg: any) => {
    setSelectedMessage(msg);
    setReplyText("");
    setShowReplyModal(true);
  };

  const sendReply = () => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply message');
      return;
    }
    
    if (!selectedMessage) return;

    // Store reply in the message
    const updated = msgs.map(m => 
      m.id === selectedMessage.id 
        ? { 
            ...m, 
            reply: replyText.trim(),
            replied_at: new Date().toISOString(),
            replied_by: auth.getUser()?.name || 'Admin',
            reply_read: false // Mark reply as unread for the user
          } 
        : m
    );
    setMsgs(updated);
    localStorage.setItem('admin_messages', JSON.stringify(updated));
    
    // Store reply notification for the user who sent the message
    try {
      const replyNotifications = JSON.parse(localStorage.getItem('message_replies') || '[]');
      replyNotifications.push({
        id: Date.now(),
        message_id: selectedMessage.id,
        email: selectedMessage.email,
        name: selectedMessage.name,
        original_message: selectedMessage.message,
        reply: replyText.trim(),
        replied_by: auth.getUser()?.name || 'Admin',
        replied_at: new Date().toISOString(),
        read: false
      });
      localStorage.setItem('message_replies', JSON.stringify(replyNotifications));
      
      // Dispatch event for reply notification
      window.dispatchEvent(new Event('messageReply'));
    } catch (e) {
      console.error('Error storing reply notification:', e);
    }
    
    toast.success('Reply sent!');
    setShowReplyModal(false);
    setReplyText("");
    setSelectedMessage(null);
    
    // Dispatch event to update notifications
    window.dispatchEvent(new Event('adminMessage'));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <div className="hidden lg:block sticky top-[57px] h-[calc(100vh-57px)] bg-white shadow-sm">
          <Sidebar />
        </div>
        <div className="flex-1 p-6">
        {(typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('localhost')) && !(auth.isAuthenticated() && auth.hasRole('admin')) && !devBypass && (
          <div className="max-w-6xl mx-auto mb-4">
            <div className="p-4 rounded bg-yellow-50 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Dev mode: admin access required</div>
                  <div className="text-sm text-muted-foreground">You are not logged in as admin. For local testing you can continue as an admin (dev only).</div>
                </div>
                <div>
                  <Button onClick={() => setDevBypass(true)}>Continue as admin (dev)</Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Admin Messages</h1>
            <div className="flex gap-2">
              {filterStatuses.map((status, idx) => (
                <Button
                  key={idx}
                  variant={filterIdx === idx ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterIdx(idx)}
                  className="capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {msgs.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No messages</CardTitle>
              </CardHeader>
              <CardContent>There are no messages from users.</CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {msgs.filter(m => {
              if (filterIdx === 0) return true; // all
              if (filterIdx === 1) return !m.read; // unread
              if (filterIdx === 2) return m.read && !m.reply; // read (but not replied)
              if (filterIdx === 3) return m.reply; // replied
              return true;
            }).map(m => (
              <Card key={m.id} className={!m.read ? 'border-l-4 border-blue-500' : ''}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-semibold">{m.name}</div>
                        <span className="text-sm text-muted-foreground">({m.email})</span>
                        {!m.read && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500 text-white">Unread</span>
                        )}
                        {m.read && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-500 text-white">Read</span>
                        )}
                        {m.reply && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500 text-white">Replied</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">{new Date(m.created_at).toLocaleString()}</div>
                      <div className="mt-2 p-3 bg-muted rounded-lg">{m.message}</div>
                      {m.reply && (
                        <div className="mt-3 p-3 bg-primary/10 border-l-4 border-primary rounded-lg">
                          <div className="text-sm font-semibold text-primary mb-1">
                            Reply from {m.replied_by || 'Admin'}
                            {m.replied_at && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {new Date(m.replied_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="text-sm">{m.reply}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleReply(m)}
                        className="gap-2"
                        disabled={!!m.reply}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {m.reply ? 'Replied' : 'Reply'}
                      </Button>
                      {!m.read && <Button size="sm" onClick={() => markRead(m.id)}>Mark read</Button>}
                      <Button variant="ghost" size="sm" onClick={() => remove(m.id)}>Delete</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        </div>
      </div>
      <Footer />

      {/* Reply Modal */}
      <Dialog open={showReplyModal} onOpenChange={setShowReplyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to {selectedMessage?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Original Message</Label>
              <div className="p-3 bg-muted rounded-lg text-sm mt-2">
                {selectedMessage?.message}
              </div>
            </div>
            <div>
              <Label>Your Reply *</Label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full border rounded-md px-3 py-2 min-h-24 mt-2"
                placeholder="Type your reply here..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowReplyModal(false);
                setReplyText("");
                setSelectedMessage(null);
              }}>
                Cancel
              </Button>
              <Button onClick={sendReply} disabled={!replyText.trim()} className="gap-2">
                <Send className="w-4 h-4" />
                Send Reply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMessages;
