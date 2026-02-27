import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Send, FileText, Users, Calendar, X, Code, Eye, Search, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

type DraftType = 'volunteer' | 'office_bearer';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const MailSender = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [draftType, setDraftType] = useState<DraftType>('volunteer');
    const [subject, setSubject] = useState("");
    const [htmlBody, setHtmlBody] = useState("");
    const [selectedRecipients, setSelectedRecipients] = useState<User[]>([]);
    const [sending, setSending] = useState(false);
    const [sliderValue, setSliderValue] = useState([50]);
    const [previewMode, setPreviewMode] = useState(false);
    const [showUserSelector, setShowUserSelector] = useState(true);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [templates, setTemplates] = useState<Record<string, any>>({});
    const [selectedRoleTemplate, setSelectedRoleTemplate] = useState<string>('volunteer');

    // Load users and templates on mount
    useEffect(() => {
        if (isOpen) {
            loadUsers();
            loadTemplates();
        }
    }, [isOpen]);

    // Load templates
    const loadTemplates = async () => {
        try {
            const response = await api.getEmailTemplates();
            if (response.success) {
                setTemplates(response.templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    };

    // Load users for selection
    const loadUsers = async () => {
        try {
            setLoadingUsers(true);
            const response = await api.getMailUsersList();
            if (response.success) {
                setAllUsers(response.users || []);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoadingUsers(false);
        }
    };

    // Filter users based on search
    const filteredUsers = searchQuery.trim() === '' 
        ? allUsers 
        : allUsers.filter(u => 
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            u.email.toLowerCase().includes(searchQuery.toLowerCase())
          );

    // Load draft template
    const loadDraft = (type: DraftType) => {
        setDraftType(type);
        setSelectedRoleTemplate(type);
        if (templates[type]) {
            setSubject(templates[type].subject);
            setHtmlBody(templates[type].html);
        }
    };

    // Toggle user selection
    const toggleUserSelection = (user: User) => {
        if (selectedRecipients.find(r => r.id === user.id)) {
            setSelectedRecipients(selectedRecipients.filter(r => r.id !== user.id));
        } else {
            setSelectedRecipients([...selectedRecipients, user]);
        }
    };

    // Select all filtered users
    const selectAllFiltered = () => {
        const newSelections = [...selectedRecipients];
        filteredUsers.forEach(user => {
            if (!newSelections.find(r => r.id === user.id)) {
                newSelections.push(user);
            }
        });
        setSelectedRecipients(newSelections);
    };

    // Remove selected recipient
    const removeRecipient = (id: number) => {
        setSelectedRecipients(selectedRecipients.filter(r => r.id !== id));
    };

    // Generate preview with personalization
    const getPersonalizedPreview = (sampleName: string = "John Doe") => {
        const previewHtml = htmlBody
            .replace(/\[Name\]/g, sampleName)
            .replace(/\[name\]/g, sampleName)
            .replace(/\{name\}/g, sampleName)
            .replace(/{{name}}/g, sampleName);
        return previewHtml;
    };

    // Handle send
    const handleSend = async () => {
        if (!subject.trim()) {
            toast.error("Please fill in subject");
            return;
        }

        if (!htmlBody.trim()) {
            toast.error("Please fill in email body");
            return;
        }

        if (selectedRecipients.length === 0) {
            toast.error("Please select at least one recipient");
            return;
        }

        try {
            setSending(true);
            
            // Prepare recipients data (include name for personalization)
            const recipientData = selectedRecipients.map(r => ({
                email: r.email,
                name: r.name
            }));

            const response = await api.sendBulkEmail({
                recipients: recipientData,
                subject,
                body: htmlBody,
                html: true,
                priority: sliderValue[0],
                type: draftType
            });

            if (response.success) {
                toast.success(`✅ Email sent successfully to ${selectedRecipients.length} recipient(s)`);
                if (response.stats?.failedRecipients?.length > 0) {
                    toast.warning(`⚠️ ${response.stats.failedRecipients.length} emails failed to send`);
                }
                
                // Reset form
                setIsOpen(false);
                setSelectedRecipients([]);
                setSubject("");
                setHtmlBody("");
                setSearchQuery("");
                setSliderValue([50]);
                setShowUserSelector(true);
            } else {
                toast.error(response.message || "Failed to send email");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <Button
                onClick={() => setIsOpen(true)}
                className="gap-2 h-10 rounded-md font-semibold text-sm px-4 bg-primary text-primary-foreground"
            >
                <Mail className="w-4 h-4" />
                Mail Sender
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Mail className="w-5 h-5" />
                            Send Emails
                        </DialogTitle>
                        <DialogDescription>
                            Select recipients and send personalized emails
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* LEFT: User Selection */}
                            {showUserSelector && (
                                <div className="space-y-4 lg:col-span-1 border-r pr-4">
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-sm">📋 Select Recipients</h3>
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by name or email..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-8 h-9"
                                            />
                                        </div>
                                    </div>

                                    {/* Selected count and quick actions */}
                                    <div className="space-y-2">
                                        <div className="text-xs text-foreground/70">
                                            {selectedRecipients.length} of {allUsers.length} selected
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={selectAllFiltered}
                                                className="w-full text-xs h-8"
                                                disabled={loadingUsers}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setSelectedRecipients([])}
                                                className="w-full text-xs h-8"
                                                disabled={selectedRecipients.length === 0}
                                            >
                                                Unselect All
                                            </Button>
                                        </div>
                                    </div>

                                    {/* User list */}
                                    {loadingUsers ? (
                                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Loading users...
                                        </div>
                                    ) : (
                                        <ScrollArea className="h-[400px] border rounded-lg p-2">
                                            <div className="space-y-1">
                                                {filteredUsers.length > 0 ? (
                                                    filteredUsers.map((user) => {
                                                        const isSelected = selectedRecipients.some(r => r.id === user.id);
                                                        return (
                                                            <div
                                                                key={user.id}
                                                                className={`p-2 rounded cursor-pointer transition-colors ${
                                                                    isSelected 
                                                                        ? 'bg-primary/20 border border-primary/50' 
                                                                        : 'hover:bg-muted'
                                                                }`}
                                                                onClick={() => toggleUserSelection(user)}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Checkbox
                                                                        checked={isSelected}
                                                                        onChange={() => toggleUserSelection(user)}
                                                                        className="w-4 h-4"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-medium truncate">{user.name}</p>
                                                                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                                                    </div>
                                                                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-center py-8 text-muted-foreground text-xs">
                                                        No users found
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    )}

                                    {/* Selected recipients preview */}
                                    {selectedRecipients.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-semibold">Selected Recipients:</p>
                                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                                {selectedRecipients.map((r) => (
                                                    <div
                                                        key={r.id}
                                                        className="flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded text-xs"
                                                    >
                                                        <span className="truncate max-w-[100px]">{r.name}</span>
                                                        <button
                                                            onClick={() => removeRecipient(r.id)}
                                                            className="hover:text-destructive"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* RIGHT: Email Composer */}
                            <div className={showUserSelector ? "lg:col-span-2" : "lg:col-span-3"}>
                                <div className="space-y-4">
                                    {/* Role & Template Selection */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">📋 Select Role</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                type="button"
                                                variant={selectedRoleTemplate === 'volunteer' ? 'default' : 'outline'}
                                                onClick={() => loadDraft('volunteer')}
                                                className="text-xs h-10 font-semibold"
                                            >
                                                Volunteer
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={selectedRoleTemplate === 'office_bearer' ? 'default' : 'outline'}
                                                onClick={() => loadDraft('office_bearer')}
                                                className="text-xs h-10 font-semibold"
                                            >
                                                Office Bearer
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Default: Volunteer | Switch role to change template
                                        </p>
                                    </div>

                                    {/* Subject and Body */}
                                    <div className="pt-2 border-t space-y-4">

                                    {/* Subject */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">Subject *</Label>
                                        <Input
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="Email subject (use [Name] for personalization)"
                                            className="h-9 text-sm bg-muted/40"
                                            readOnly
                                        />
                                        <p className="text-xs text-muted-foreground">Auto-loaded from template</p>
                                    </div>

                                    {/* Body */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold">Body (HTML) *</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPreviewMode(!previewMode)}
                                                className="h-7 text-xs gap-1"
                                            >
                                                <Eye className="w-3 h-3" />
                                                {previewMode ? "Edit" : "Preview"}
                                            </Button>
                                        </div>

                                        {previewMode ? (
                                            <div className="border rounded-lg p-4 bg-muted/50 min-h-[300px]">
                                                <div 
                                                    className="prose prose-sm max-w-none text-foreground"
                                                    dangerouslySetInnerHTML={{ __html: getPersonalizedPreview() }}
                                                />
                                            </div>
                                        ) : (
                                            <Textarea
                                                value={htmlBody}
                                                onChange={(e) => setHtmlBody(e.target.value)}
                                                placeholder="Enter HTML email body... Use [Name] for personalization"
                                                rows={12}
                                                className="resize-none font-mono text-xs"
                                            />
                                        )}
                                        
                                        <p className="text-xs text-muted-foreground">
                                            Use <code className="bg-muted px-1 py-0.5 rounded">[Name]</code> to personalize with recipient names
                                        </p>
                                    </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                            className="font-semibold text-sm"
                            disabled={sending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSend}
                            disabled={sending || selectedRecipients.length === 0}
                            className="gap-2 font-semibold text-sm"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending to {selectedRecipients.length}...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send to {selectedRecipients.length} Recipient{selectedRecipients.length !== 1 ? 's' : ''}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default MailSender;
