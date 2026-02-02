import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Send, Loader2, Smile, Trash, Edit2, Copy, Reply, MoreVertical, CheckCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
} from "@/components/ui/context-menu";

interface Contact {
    id: number;
    name: string;
    email: string;
    role: string;
}

const StudentMessagesTab = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [contactSearch, setContactSearch] = useState("");
    const [msgText, setMsgText] = useState("");
    const [msgSubject, setMsgSubject] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    // Permission Request State
    const [permOpen, setPermOpen] = useState(false);
    const [permType, setPermType] = useState<"Meeting" | "Event">("Meeting");
    const [permDate, setPermDate] = useState(new Date().toISOString().split('T')[0]);
    const [permReason, setPermReason] = useState("");

    // Edit State
    const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
    const [editText, setEditText] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);

    useEffect(() => {
        const loadContacts = async () => {
            setLoadingContacts(true);
            try {
                const res = await api.getContacts();
                if (res.success && res.contacts) {
                    setContacts(res.contacts);
                }
            } catch (e) {
                console.error('Error loading contacts:', e);
            } finally {
                setLoadingContacts(false);
            }
        };
        loadContacts();
    }, []);

    // Listen for message updates
    useEffect(() => {
        const handleUpdate = () => setRefreshKey(k => k + 1);
        window.addEventListener('adminMessage', handleUpdate);
        window.addEventListener('messageReply', handleUpdate);
        return () => {
            window.removeEventListener('adminMessage', handleUpdate);
            window.removeEventListener('messageReply', handleUpdate);
        };
    }, []);

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(contactSearch.toLowerCase())
    );

    const user = auth.getUser();

    const messages = useMemo(() => {
        if (!user || !selectedContact) return [];
        try {
            const msgsJson = localStorage.getItem('admin_messages');
            const msgs = msgsJson ? JSON.parse(msgsJson) : [];

            // Get messages between current user and selected contact ONLY
            const convoMsgs = msgs.filter((m: any) => {
                // Check if deleted for this user
                if (m.deleted_for && m.deleted_for.includes(user.email)) return false;

                // Message from current user TO this specific contact
                const sentToContact = m.email === user.email && m.to_email === selectedContact.email;

                // Message from this specific contact TO current user
                const receivedFromContact = m.email === selectedContact.email && m.to_email === user.email;

                return sentToContact || receivedFromContact;
            });

            const allMessages: any[] = [];
            convoMsgs.forEach((msg: any) => {
                const isSent = msg.email === user.email;
                if (!msg.is_deleted_everyone) {
                    allMessages.push({
                        ...msg,
                        id: msg.id,
                        type: isSent ? 'sent' : 'received',
                        message: msg.message,
                        time: msg.created_at,
                        subject: msg.subject,
                        from: isSent ? 'You' : msg.name,
                        reactions: msg.reactions || {}
                    });
                } else if (msg.is_deleted_everyone) {
                    allMessages.push({
                        ...msg,
                        id: msg.id,
                        type: isSent ? 'sent' : 'received',
                        message: '🚫 This message was deleted',
                        time: msg.created_at,
                        isDeleted: true,
                        from: isSent ? 'You' : msg.name
                    });
                }

                // Legacy reply handling (if any, though we prefer new message objects now)
                if (msg.reply) {
                    allMessages.push({
                        id: `reply-${msg.id}`,
                        type: isSent ? 'received' : 'sent',
                        message: msg.reply,
                        time: msg.replied_at,
                        from: msg.replied_by || 'Admin',
                        isReply: true
                    });
                }
            });

            return allMessages.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        } catch (e) {
            return [];
        }
    }, [user, selectedContact, refreshKey]);

    const handleSendToContact = () => {
        if (!msgText.trim() || !user || !selectedContact) return;

        const newMsg = {
            id: Date.now(),
            name: user.name,
            email: user.email,
            to_name: selectedContact.name,
            to_email: selectedContact.email,
            subject: msgSubject,
            message: msgText.trim(),
            created_at: new Date().toISOString(),
            read: false,
            reactions: {},
            deleted_for: []
        };

        try {
            const existing = JSON.parse(localStorage.getItem('admin_messages') || '[]');
            existing.push(newMsg);
            localStorage.setItem('admin_messages', JSON.stringify(existing));
            window.dispatchEvent(new Event('adminMessage'));
            toast.success('Message sent!');
            setMsgText('');
            setMsgSubject('');
            setRefreshKey(k => k + 1);
        } catch (e) {
            toast.error('Failed to send message');
        }
    };

    const handleSendPermissionRequest = () => {
        if (!permReason.trim() || !user || !selectedContact) {
            toast.error("Please provide a reason");
            return;
        }

        const subject = `Permission Request: ${permType} on ${permDate}`;
        const message = `**PERMISSION REQUEST**\n\n**Type:** ${permType}\n**Date:** ${permDate}\n**Reason:** ${permReason}`;

        const newMsg = {
            id: Date.now(),
            name: user.name,
            email: user.email,
            to_name: selectedContact.name,
            to_email: selectedContact.email,
            subject: subject,
            message: message,
            created_at: new Date().toISOString(),
            read: false,
            reactions: {},
            deleted_for: []
        };

        try {
            const existing = JSON.parse(localStorage.getItem('admin_messages') || '[]');
            existing.push(newMsg);
            localStorage.setItem('admin_messages', JSON.stringify(existing));
            window.dispatchEvent(new Event('adminMessage'));
            toast.success('Permission request sent!');
            setPermOpen(false);
            setPermReason("");
            setPermDate(new Date().toISOString().split('T')[0]);
            setRefreshKey(k => k + 1);
        } catch (e) {
            toast.error('Failed to send request');
        }
    };

    const updateMessage = (msgId: number, updateFn: (msg: any) => any) => {
        try {
            const msgs = JSON.parse(localStorage.getItem('admin_messages') || '[]');
            const updated = msgs.map((m: any) => {
                if (m.id === msgId) {
                    return updateFn(m);
                }
                return m;
            });
            localStorage.setItem('admin_messages', JSON.stringify(updated));
            setRefreshKey(k => k + 1);
            window.dispatchEvent(new Event('adminMessage'));
        } catch (e) { console.error(e); }
    };

    const handleReaction = (msgId: number, emoji: string) => {
        updateMessage(msgId, (msg) => {
            const reactions = msg.reactions || {};
            const userEmail = user?.email || 'unknown';

            // Toggle reaction
            if (!reactions[emoji]) reactions[emoji] = [];

            if (reactions[emoji].includes(userEmail)) {
                reactions[emoji] = reactions[emoji].filter((e: string) => e !== userEmail);
                if (reactions[emoji].length === 0) delete reactions[emoji];
            } else {
                reactions[emoji].push(userEmail);
            }

            return { ...msg, reactions };
        });
    };

    const handleDeleteForMe = (msgId: number) => {
        updateMessage(msgId, (msg) => {
            const deletedFor = msg.deleted_for || [];
            if (!deletedFor.includes(user?.email)) {
                deletedFor.push(user?.email);
            }
            return { ...msg, deleted_for: deletedFor };
        });
        toast.success("Message deleted for you");
    };

    const handleDeleteForEveryone = (msgId: number) => {
        updateMessage(msgId, (msg) => ({ ...msg, is_deleted_everyone: true }));
        toast.success("Message deleted for everyone");
    };

    const handleEditSave = () => {
        if (!editingMsgId || !editText.trim()) return;
        updateMessage(editingMsgId, (msg) => ({ ...msg, message: editText.trim(), edited: true }));
        setIsEditOpen(false);
        toast.success("Message edited");
    };

    return (
        <div className="flex gap-4 flex-1">
            {/* Contacts List */}
            <Card className="w-80 flex flex-col border-border/50">
                <div className="p-4 border-b border-border/50">
                    <h3 className="font-semibold text-foreground mb-3">Contacts</h3>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search contacts..."
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingContacts ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Loading contacts...
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p>No contacts found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {filteredContacts.map(contact => (
                                <button
                                    key={contact.id}
                                    onClick={() => setSelectedContact(contact)}
                                    className={`w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 ${selectedContact?.id === contact.id ? 'bg-muted' : ''
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-semibold text-primary">
                                            {contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-foreground truncate">{contact.name}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Badge variant="outline" className="text-xs px-1 py-0">
                                                {contact.role === 'admin' ? 'Admin' : 'Office Bearer'}
                                            </Badge>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Chat View */}
            {selectedContact ? (
                <Card className="flex-1 flex flex-col border-border/50">
                    {/* Chat Header */}
                    <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                                {selectedContact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">{selectedContact.name}</h2>
                            <p className="text-sm text-muted-foreground">
                                {selectedContact.role === 'admin' ? 'Administrator' : 'Office Bearer'}
                            </p>
                        </div>
                        <div className="ml-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary"
                                onClick={() => setPermOpen(true)}
                            >
                                <Clock className="w-4 h-4" />
                                Request Permission
                            </Button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-muted/10 to-muted/30">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                    <MessageSquare className="w-10 h-10 opacity-30" />
                                </div>
                                <p className="text-lg font-medium">No messages yet</p>
                                <p className="text-sm">Send a message to {selectedContact.name}</p>
                            </div>
                        ) : (
                            messages.map((msg: any) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <ContextMenu>
                                        <ContextMenuTrigger>
                                            <div
                                                className={`max-w-[70%] relative ${msg.type === 'sent'
                                                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                                                    : 'bg-muted rounded-2xl rounded-tl-sm'
                                                    } px-4 py-3 shadow-sm group min-w-[120px]`}
                                            >
                                                {/* Header info */}
                                                {!msg.isDeleted && msg.type === 'received' && (
                                                    <p className="text-xs font-semibold text-primary mb-1">{msg.from}</p>
                                                )}
                                                {/* Subject if any */}
                                                {!msg.isDeleted && msg.subject && msg.type === 'sent' && (
                                                    <p className="text-xs font-semibold opacity-80 mb-1">📌 {msg.subject}</p>
                                                )}

                                                {/* Message Content */}
                                                <p className={`text-sm whitespace-pre-wrap ${msg.isDeleted ? 'italic opacity-60' : ''}`}>{msg.message}</p>

                                                {/* Meta Info */}
                                                <div className="flex items-center justify-end gap-1 mt-1">
                                                    {msg.edited && !msg.isDeleted && <span className="text-[10px] opacity-70 italic mr-1">edited</span>}
                                                    <p className={`text-[10px] ${msg.type === 'sent' ? 'opacity-70' : 'text-muted-foreground'}`}>
                                                        {new Date(msg.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    {msg.type === 'sent' && (
                                                        <span className="opacity-70">
                                                            {msg.read ? <CheckCheck className="w-3 h-3" /> : <CheckCheck className="w-3 h-3 opacity-50" />}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Reactions Display */}
                                                {!msg.isDeleted && msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                    <div className="absolute -bottom-3 right-0 flex gap-0.5 bg-background border rounded-full px-1 py-0.5 shadow-sm scale-90">
                                                        {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                                                            <span key={emoji} className="text-xs leading-none" title={users.join(', ')}>{emoji}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </ContextMenuTrigger>

                                        {!msg.isDeleted && (
                                            <ContextMenuContent className="w-48">
                                                <ContextMenuSub>
                                                    <ContextMenuSubTrigger inset>
                                                        <Smile className="w-4 h-4 mr-2" />
                                                        React
                                                    </ContextMenuSubTrigger>
                                                    <ContextMenuSubContent className="w-auto p-1">
                                                        <div className="flex gap-1">
                                                            {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                                                <Button
                                                                    key={emoji}
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 hover:bg-muted"
                                                                    onClick={() => handleReaction(msg.id, emoji)}
                                                                >
                                                                    {emoji}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </ContextMenuSubContent>
                                                </ContextMenuSub>

                                                <ContextMenuItem inset onClick={() => {
                                                    navigator.clipboard.writeText(msg.message);
                                                    toast.success("Copied to clipboard");
                                                }}>
                                                    <Copy className="w-4 h-4 mr-2" />
                                                    Copy
                                                </ContextMenuItem>

                                                {msg.type === 'sent' && (
                                                    <ContextMenuItem inset onClick={() => {
                                                        setEditingMsgId(msg.id);
                                                        setEditText(msg.message);
                                                        setIsEditOpen(true);
                                                    }}>
                                                        <Edit2 className="w-4 h-4 mr-2" />
                                                        Edit
                                                    </ContextMenuItem>
                                                )}

                                                <ContextMenuSeparator />

                                                <ContextMenuItem inset className="text-red-500 focus:text-red-500" onClick={() => handleDeleteForMe(msg.id)}>
                                                    <Trash className="w-4 h-4 mr-2" />
                                                    Delete for Me
                                                </ContextMenuItem>

                                                {msg.type === 'sent' && (
                                                    <ContextMenuItem inset className="text-red-500 focus:text-red-500" onClick={() => handleDeleteForEveryone(msg.id)}>
                                                        <Trash className="w-4 h-4 mr-2" />
                                                        Delete for Everyone
                                                    </ContextMenuItem>
                                                )}
                                            </ContextMenuContent>
                                        )}
                                    </ContextMenu>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Message Input */}
                    <div className="p-4 border-t border-border/50 bg-card">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-auto gap-2 border-primary/20 text-muted-foreground hover:text-primary hover:bg-primary/5"
                                onClick={() => setPermOpen(true)}
                            >
                                <Clock className="w-4 h-4" />
                                Permission
                            </Button>
                            <Textarea
                                placeholder="Type your message..."
                                value={msgText}
                                onChange={(e) => setMsgText(e.target.value)}
                                rows={2}
                                className="flex-1 resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && msgText.trim()) {
                                        e.preventDefault();
                                        handleSendToContact();
                                    }
                                }}
                            />
                            <Button
                                onClick={handleSendToContact}
                                disabled={!msgText.trim()}
                                className="h-auto px-4"
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card className="flex-1 flex items-center justify-center border-border/50">
                    <div className="text-center text-muted-foreground">
                        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">Select a contact</p>
                        <p className="text-sm">Choose an Admin or Office Bearer to start messaging</p>
                    </div>
                </Card>
            )}

            {/* Permission Dialog */}
            <Dialog open={permOpen} onOpenChange={setPermOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Permission / Leave</DialogTitle>
                        <DialogDescription>
                            Send a request to notify that you cannot attend a scheduled meeting or event.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Request Type</Label>
                            <Select value={permType} onValueChange={(v: any) => setPermType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Meeting">Meeting Absence</SelectItem>
                                    <SelectItem value="Event">Event Absence</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input
                                type="date"
                                value={permDate}
                                onChange={(e) => setPermDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Textarea
                                placeholder="Why can't you attend? Please provide details."
                                value={permReason}
                                onChange={(e) => setPermReason(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPermOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendPermissionRequest}>Submit Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Message Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Message</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[100px]"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleEditSave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StudentMessagesTab;
