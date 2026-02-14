
import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Send, Loader2, Trash, Edit2, Copy, Clock, Search, CheckCheck, ArrowLeft, Reply, X, Mic, Smile, Paperclip, Image as ImageIcon, FileText, ChevronDown, Info, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildImageUrl } from "@/utils/imageUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// Contact Item Component with Swipe-to-Delete
const ContactItem = ({ contact, isSelected, onSelect, onDelete }: {
    contact: Contact;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}) => {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [hasSwiped, setHasSwiped] = useState(false);
    const startX = useRef(0);
    const startY = useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        setIsDragging(false);
        setHasSwiped(false);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = startX.current - currentX;
        const diffY = Math.abs(startY.current - currentY);

        // Only start dragging if horizontal movement is greater than vertical
        if (Math.abs(diffX) > diffY && Math.abs(diffX) > 5) {
            setIsDragging(true);
            setHasSwiped(true);
            if (diffX > 0 && diffX < 150) {
                e.preventDefault(); // Prevent scrolling
                setSwipeOffset(diffX);
            }
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        if (swipeOffset > 100) {
            // Auto-delete if swiped far enough
            onDelete();
            setSwipeOffset(0);
        } else if (swipeOffset > 40) {
            setSwipeOffset(80);
        } else {
            setSwipeOffset(0);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        startX.current = e.clientX;
        startY.current = e.clientY;
        setIsDragging(false);
        setHasSwiped(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (e.buttons !== 1) return; // Only when mouse button is pressed

        const diffX = startX.current - e.clientX;
        const diffY = Math.abs(startY.current - e.clientY);

        if (Math.abs(diffX) > diffY && Math.abs(diffX) > 5) {
            setIsDragging(true);
            setHasSwiped(true);
            if (diffX > 0 && diffX < 150) {
                setSwipeOffset(diffX);
            }
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (swipeOffset > 100) {
            // Auto-delete if swiped far enough
            onDelete();
            setSwipeOffset(0);
        } else if (swipeOffset > 40) {
            setSwipeOffset(80);
        } else {
            setSwipeOffset(0);
        }
    };

    const handleClick = () => {
        if (hasSwiped || swipeOffset > 0) {
            // If we swiped, close the swipe instead of selecting
            setSwipeOffset(0);
            setHasSwiped(false);
        } else {
            // Normal click - select contact
            onSelect();
        }
    };

    return (
        <div className="relative overflow-hidden">
            <div
                className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center transition-transform"
                style={{ transform: `translateX(${80 - swipeOffset}px)` }}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                        setSwipeOffset(0);
                    }}
                    className="text-white"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
            <button
                onClick={handleClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                    if (isDragging) {
                        setIsDragging(false);
                        if (swipeOffset < 40) {
                            setSwipeOffset(0);
                        }
                    }
                }}
                className={`w-full p-3 text-left hover:bg-muted/50 transition-all select-none ${isSelected ? 'bg-muted' : ''}`}
                style={{ transform: `translateX(-${swipeOffset}px)`, transition: isDragging ? 'none' : 'transform 0.2s ease-out' }}
            >
                <div className="flex items-center gap-3">
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
                </div>
            </button>
        </div>
    );
};

const StudentMessagesTab = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [contactSearch, setContactSearch] = useState("");
    const [msgText, setMsgText] = useState("");
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

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
                setReplyingTo(null);
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

    const handleReply = (msg: ChatMessage) => {
        setReplyingTo(msg);
        // Focus on input would be nice but not critical
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(contactSearch.toLowerCase())
    );

    return (
        <div className="flex gap-4 h-[calc(100vh-250px)] relative">
            {/* Contacts List */}
            <Card className={`${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden rounded-2xl shadow-xl`}>
                <div className="p-4 border-b border-border/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-lg">SM Messages</h2>
                        <p className="text-xs text-muted-foreground">Service Motto Volunteers</p>
                    </div>
                </div>
                <div className="p-4 border-b border-border/50">
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
                <ScrollArea className="flex-1">
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
                                <ContactItem
                                    key={contact.id}
                                    contact={contact}
                                    isSelected={selectedContact?.id === contact.id}
                                    onSelect={() => setSelectedContact(contact)}
                                    onDelete={() => {
                                        // Remove contact from local state (you may want to call an API here)
                                        setContacts(prev => prev.filter(c => c.id !== contact.id));
                                        if (selectedContact?.id === contact.id) {
                                            setSelectedContact(null);
                                        }
                                        toast.success("Contact removed");
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </Card>

            {/* Chat View */}
            {selectedContact ? (
                <Card className="flex-1 flex flex-col border-border/50 bg-card overflow-hidden">
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
                            className="gap-2 shrink-0"
                            onClick={() => setPermOpen(true)}
                        >
                            <Clock className="w-4 h-4" />
                            <span className="hidden lg:inline">Request Permission</span>
                            <span className="lg:hidden">Request</span>
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0b141a]/95 relative" ref={scrollRef} style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'overlay', backgroundSize: '300px' }}>
                        {loadingMessages ? (
                            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#8696a0]" /></div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <div className="bg-[#1f2c34] p-4 rounded-xl text-center shadow-sm">
                                    <p className="text-[#e9edef] text-sm">No messages here yet...</p>
                                    <p className="text-[#8696a0] text-xs mt-1">Send a message to start the conversation.</p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex w-full mb-2 ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`relative px-3 py-1.5 shadow-sm text-sm rounded-lg max-w-[85%] md:max-w-[60%] group flex flex-wrap gap-x-2 items-end
                                        ${msg.sender_id === user?.id
                                            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                                            : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                                        }`}
                                    >
                                        <p className="whitespace-pre-wrap leading-relaxed pb-1 break-words font-normal text-[15px]">{msg.message}</p>
                                        <div className={`flex items-center gap-1 text-[10px] h-4 ml-auto text-[#8696a0]`}>
                                            <span className="shrink-0">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                            {msg.sender_id === user?.id && (
                                                <CheckCheck className={`w-3.5 h-3.5 shrink-0 ${msg.is_read ? 'text-[#e9edef]' : 'text-[#8696a0]'}`} />
                                            )}
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-bl-lg text-[#e9edef] hover:bg-black/20 focus:opacity-100 outline-none"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40 bg-[#233138] border-[#233138] text-[#e9edef]">
                                                <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer" onClick={() => handleReply(msg)}>
                                                    <Reply className="w-4 h-4 mr-2" /> Reply
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer" onClick={() => toast.message("Message Info", { description: `Sent: ${new Date(msg.created_at).toLocaleString()}\nRead: ${msg.is_read ? 'Yes' : 'No'}` })}>
                                                    <Info className="w-4 h-4 mr-2" /> Info
                                                </DropdownMenuItem>
                                                {msg.sender_id === user?.id && (
                                                    <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer text-red-400 focus:text-red-400" onClick={() => deleteMessage(msg.id)}>
                                                        <Trash className="w-4 h-4 mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-3 bg-[#202c33] flex flex-col gap-2">
                        {replyingTo && (
                            <div className="bg-[#2a3942] rounded-lg p-2 flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-primary font-medium">Replying to {replyingTo.sender_name}</div>
                                    <div className="text-xs text-[#8696a0] truncate">{replyingTo.message}</div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center px-4 py-2">
                                <input
                                    placeholder="Type a message"
                                    value={msgText}
                                    onChange={(e) => setMsgText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    className="flex-1 bg-transparent border-none outline-none text-[#e9edef] placeholder:text-[#8696a0] text-sm"
                                />
                            </div>
                            {msgText.trim() ? (
                                <Button onClick={() => handleSendMessage()} className="h-10 w-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white p-0 flex items-center justify-center shadow-sm">
                                    <Send className="w-5 h-5 ml-0.5" />
                                </Button>
                            ) : (
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-[#8696a0]">
                                    <Mic className="w-6 h-6" />
                                </Button>
                            )}
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
