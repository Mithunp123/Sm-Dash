
import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Send, Loader2, Trash, Edit2, Copy, Clock, Search, CheckCheck, ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildImageUrl } from "@/utils/imageUtils";

interface Contact {
    id: number;
    name: string;
    email: string;
    role: string;
    photo_url?: string;
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

const StudentMessagesTab = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [contactSearch, setContactSearch] = useState("");
    const [msgText, setMsgText] = useState("");

    // Permission Request State
    const [permOpen, setPermOpen] = useState(false);
    const [permType, setPermType] = useState<"Meeting" | "Event">("Meeting");
    const [permDate, setPermDate] = useState(new Date().toISOString().split('T')[0]);
    const [permReason, setPermReason] = useState("");

    const scrollRef = useRef<HTMLDivElement>(null);
    const user = auth.getUser();

    useEffect(() => {
        loadContacts();
    }, []);

    useEffect(() => {
        if (selectedContact) {
            loadHistory(selectedContact.id);
        }
    }, [selectedContact]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

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

    const loadHistory = async (contactId: number) => {
        setLoadingMessages(true);
        try {
            const res = await api.getMessageHistory(contactId);
            if (res.success) {
                setMessages(res.messages || []);
            }
        } catch (e) {
            console.error('Error loading history:', e);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSendMessage = async (textOverride?: string) => {
        const text = textOverride || msgText;
        if (!text.trim() || !selectedContact) return;

        try {
            const res = await api.sendChatMessage({
                recipientId: selectedContact.id,
                message: text.trim()
            });

            if (res.success) {
                if (!textOverride) setMsgText("");
                loadHistory(selectedContact.id);
            }
        } catch (e) {
            toast.error("Failed to send message");
        }
    };

    const handleSendPermissionRequest = () => {
        if (!permReason.trim() || !selectedContact) {
            toast.error("Please provide a reason");
            return;
        }

        const message = `**PERMISSION REQUEST**\n\n**Type:** ${permType}\n**Date:** ${permDate}\n**Reason:** ${permReason}`;
        handleSendMessage(message);
        setPermOpen(false);
        setPermReason("");
        setPermDate(new Date().toISOString().split('T')[0]);
        toast.success("Permission request sent!");
    };

    const deleteMessage = async (msgId: number) => {
        if (!confirm("Delete this message?")) return;
        try {
            const res = await api.deleteChatMessage(msgId);
            if (res.success) {
                setMessages(prev => prev.filter(m => m.id !== msgId));
                toast.success("Message deleted");
            }
        } catch (e) {
            toast.error("Failed to delete message");
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(contactSearch.toLowerCase())
    );

    return (
        <div className="flex gap-4 h-[calc(100vh-250px)] relative">
            {/* Contacts List */}
            <Card className={`${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-border/50`}>
                <div className="p-4 border-b border-border/50">
                    <h3 className="font-semibold text-foreground mb-3">Contacts</h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
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
                            Loading...
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
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={contact.photo_url ? buildImageUrl(contact.photo_url) : undefined} />
                                        <AvatarFallback>{contact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-foreground truncate">{contact.name}</div>
                                        <div className="text-[10px] text-muted-foreground capitalize">
                                            {contact.role.replace('_', ' ')}
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
                    <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden -ml-2 h-8 w-8 flex-shrink-0"
                                onClick={() => setSelectedContact(null)}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <Avatar className="h-10 w-10 flex-shrink-0">
                                <AvatarImage src={selectedContact.photo_url ? buildImageUrl(selectedContact.photo_url) : undefined} />
                                <AvatarFallback>{selectedContact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <h2 className="font-semibold text-foreground truncate">{selectedContact.name}</h2>
                                <p className="text-xs text-muted-foreground capitalize truncate">
                                    {selectedContact.role.replace('_', ' ')}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 shrink-0 hidden sm:flex"
                            onClick={() => setPermOpen(true)}
                        >
                            <Clock className="w-4 h-4" />
                            <span className="hidden lg:inline">Request Permission</span>
                            <span className="lg:hidden">Request</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="sm:hidden shrink-0"
                            onClick={() => setPermOpen(true)}
                        >
                            <Clock className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                        {loadingMessages ? (
                            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <MessageSquare className="w-12 h-12 opacity-10 mb-2" />
                                <p>No messages yet. Start chatting!</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] md:max-w-[75%] relative group ${msg.sender_id === user?.id
                                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                                        : 'bg-muted rounded-2xl rounded-tl-sm'
                                        } px-4 py-2 shadow-sm`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                        <div className={`text-[9px] mt-1 text-right opacity-70`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {msg.sender_id === user?.id && (
                                            <button
                                                onClick={() => deleteMessage(msg.id)}
                                                className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-destructive"
                                            >
                                                <Trash className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t border-border/50 bg-card">
                        <div className="flex gap-2">
                            <Textarea
                                placeholder="Type your message..."
                                value={msgText}
                                onChange={(e) => setMsgText(e.target.value)}
                                rows={2}
                                className="flex-1 resize-none h-12 min-h-12"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                            />
                            <Button
                                onClick={() => handleSendMessage()}
                                disabled={!msgText.trim()}
                                className="h-12 px-4"
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card className="hidden md:flex flex-1 items-center justify-center border-border/50">
                    <div className="text-center text-muted-foreground">
                        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <p className="text-lg font-medium">Select a contact to start messaging</p>
                    </div>
                </Card>
            )}

            {/* Permission Dialog */}
            <Dialog open={permOpen} onOpenChange={setPermOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Permission</DialogTitle>
                        <DialogDescription>
                            Send a request for leave or special permission.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={permType} onValueChange={(v: any) => setPermType(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
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
                                placeholder="Details..."
                                value={permReason}
                                onChange={(e) => setPermReason(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPermOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendPermissionRequest}>Submit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StudentMessagesTab;
