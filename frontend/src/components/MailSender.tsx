import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send, FileText, Users, Calendar, X, Code, Eye } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type DraftType = 'interview' | 'meeting' | 'other';

const MailSender = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [draftType, setDraftType] = useState<DraftType>('interview');
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [htmlBody, setHtmlBody] = useState("");
    const [recipients, setRecipients] = useState<string[]>([]);
    const [recipientInput, setRecipientInput] = useState("");
    const [sending, setSending] = useState(false);
    const [sliderValue, setSliderValue] = useState([50]); // For priority/urgency slider
    const [useHtml, setUseHtml] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    // Pre-defined drafts with HTML support
    const drafts: Record<DraftType, { subject: string; body: string; html: string }> = {
        interview: {
            subject: "Interview Schedule - SM Volunteers",
            body: `Dear Candidate,

We are pleased to inform you that you have been selected for an interview with SM Volunteers.

Interview Details:
- Date: [Date]
- Time: [Time]
- Venue: [Location]
- Interviewer: [Name]

Please arrive 10 minutes early and bring all necessary documents.

Best regards,
SM Volunteers Team`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1E3A8A; border-bottom: 2px solid #1E3A8A; padding-bottom: 10px;">Interview Schedule - SM Volunteers</h2>
  <p>Dear Candidate,</p>
  <p>We are pleased to inform you that you have been selected for an interview with SM Volunteers.</p>
  <div style="background-color: #F8FAFC; padding: 15px; border-left: 4px solid #1E3A8A; margin: 20px 0;">
    <h3 style="color: #334155; margin-top: 0;">Interview Details:</h3>
    <ul style="color: #0F172A;">
      <li><strong>Date:</strong> [Date]</li>
      <li><strong>Time:</strong> [Time]</li>
      <li><strong>Venue:</strong> [Location]</li>
      <li><strong>Interviewer:</strong> [Name]</li>
    </ul>
  </div>
  <p>Please arrive 10 minutes early and bring all necessary documents.</p>
  <p>Best regards,<br><strong>SM Volunteers Team</strong></p>
</div>`
        },
        meeting: {
            subject: "Meeting Invitation - SM Volunteers",
            body: `Dear Team Member,

You are cordially invited to attend our upcoming meeting.

Meeting Details:
- Date: [Date]
- Time: [Time]
- Venue: [Location]
- Agenda: [Agenda Items]

Your presence is important for the success of this meeting.

Best regards,
SM Volunteers Team`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1E3A8A; border-bottom: 2px solid #1E3A8A; padding-bottom: 10px;">Meeting Invitation - SM Volunteers</h2>
  <p>Dear Team Member,</p>
  <p>You are cordially invited to attend our upcoming meeting.</p>
  <div style="background-color: #F8FAFC; padding: 15px; border-left: 4px solid #1E3A8A; margin: 20px 0;">
    <h3 style="color: #334155; margin-top: 0;">Meeting Details:</h3>
    <ul style="color: #0F172A;">
      <li><strong>Date:</strong> [Date]</li>
      <li><strong>Time:</strong> [Time]</li>
      <li><strong>Venue:</strong> [Location]</li>
      <li><strong>Agenda:</strong> [Agenda Items]</li>
    </ul>
  </div>
  <p>Your presence is important for the success of this meeting.</p>
  <p>Best regards,<br><strong>SM Volunteers Team</strong></p>
</div>`
        },
        other: {
            subject: "Notification - SM Volunteers",
            body: `Dear Member,

This is to inform you about an important update from SM Volunteers.

[Your message here]

Thank you for your continued support.

Best regards,
SM Volunteers Team`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1E3A8A; border-bottom: 2px solid #1E3A8A; padding-bottom: 10px;">Notification - SM Volunteers</h2>
  <p>Dear Member,</p>
  <p>This is to inform you about an important update from SM Volunteers.</p>
  <div style="background-color: #F8FAFC; padding: 15px; margin: 20px 0;">
    <p style="color: #0F172A;">[Your message here]</p>
  </div>
  <p>Thank you for your continued support.</p>
  <p>Best regards,<br><strong>SM Volunteers Team</strong></p>
</div>`
        }
    };

    const loadDraft = (type: DraftType) => {
        setDraftType(type);
        const draft = drafts[type];
        setSubject(draft.subject);
        setBody(draft.body);
        setHtmlBody(draft.html);
    };

    const handleAddRecipient = () => {
        const email = recipientInput.trim();
        if (email && email.includes('@')) {
            if (!recipients.includes(email)) {
                setRecipients([...recipients, email]);
                setRecipientInput("");
            } else {
                toast.error("Email already added");
            }
        } else {
            toast.error("Please enter a valid email address");
        }
    };

    const handleRemoveRecipient = (email: string) => {
        setRecipients(recipients.filter(e => e !== email));
    };

    const handleSend = async () => {
        if (!subject.trim()) {
            toast.error("Please fill in subject");
            return;
        }

        if (useHtml && !htmlBody.trim()) {
            toast.error("Please fill in HTML body");
            return;
        }

        if (!useHtml && !body.trim()) {
            toast.error("Please fill in body");
            return;
        }

        if (recipients.length === 0) {
            toast.error("Please add at least one recipient");
            return;
        }

        try {
            setSending(true);
            const response = await api.sendBulkEmail({
                recipients,
                subject,
                body: useHtml ? htmlBody : body,
                html: useHtml,
                priority: sliderValue[0],
                type: draftType
            });

            if (response.success) {
                toast.success(`Email sent successfully to ${recipients.length} recipient(s)`);
                setIsOpen(false);
                setRecipients([]);
                setSubject("");
                setBody("");
                setHtmlBody("");
                setRecipientInput("");
                setSliderValue([50]);
                setUseHtml(false);
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
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="w-5 h-5" />
                            Mail Sender - SMTP
                        </DialogTitle>
                        <DialogDescription>
                            Send emails using SMTP. Select a draft template or create your own with HTML customization.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Draft Type Selector */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Select Draft Type</Label>
                            <div className="grid grid-cols-3 gap-3">
                                <Button
                                    type="button"
                                    variant={draftType === 'interview' ? 'default' : 'outline'}
                                    onClick={() => loadDraft('interview')}
                                    className="h-12 rounded-md font-semibold text-sm flex flex-col items-center gap-1"
                                >
                                    <Users className="w-4 h-4" />
                                    Interview
                                </Button>
                                <Button
                                    type="button"
                                    variant={draftType === 'meeting' ? 'default' : 'outline'}
                                    onClick={() => loadDraft('meeting')}
                                    className="h-12 rounded-md font-semibold text-sm flex flex-col items-center gap-1"
                                >
                                    <Calendar className="w-4 h-4" />
                                    Meeting
                                </Button>
                                <Button
                                    type="button"
                                    variant={draftType === 'other' ? 'default' : 'outline'}
                                    onClick={() => loadDraft('other')}
                                    className="h-12 rounded-md font-semibold text-sm flex flex-col items-center gap-1"
                                >
                                    <FileText className="w-4 h-4" />
                                    Other
                                </Button>
                            </div>
                        </div>

                        {/* Priority Slider */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold text-foreground">Priority / Urgency</Label>
                                <span className="text-sm text-muted-foreground font-medium">{sliderValue[0]}%</span>
                            </div>
                            <Slider
                                value={sliderValue}
                                onValueChange={setSliderValue}
                                max={100}
                                step={1}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Low</span>
                                <span>Medium</span>
                                <span>High</span>
                            </div>
                        </div>

                        {/* Recipients */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Recipients *</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="Enter email address"
                                    value={recipientInput}
                                    onChange={(e) => setRecipientInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
                                    className="h-10 rounded-md"
                                />
                                <Button
                                    type="button"
                                    onClick={handleAddRecipient}
                                    className="h-10 rounded-md font-semibold text-sm px-4"
                                >
                                    Add
                                </Button>
                            </div>
                            {recipients.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {recipients.map((email) => (
                                        <div
                                            key={email}
                                            className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-md text-sm"
                                        >
                                            <span>{email}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRecipient(email)}
                                                className="hover:bg-primary/20 rounded p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Subject */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Subject *</Label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Email subject"
                                className="h-10 rounded-md"
                            />
                        </div>

                        {/* Body - Plain Text or HTML */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold text-foreground">Body *</Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant={!useHtml ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setUseHtml(false)}
                                        className="h-8 rounded-md text-xs"
                                    >
                                        Plain Text
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={useHtml ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setUseHtml(true)}
                                        className="h-8 rounded-md text-xs gap-1"
                                    >
                                        <Code className="w-3 h-3" />
                                        HTML
                                    </Button>
                                    {useHtml && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPreviewMode(!previewMode)}
                                            className="h-8 rounded-md text-xs gap-1"
                                        >
                                            <Eye className="w-3 h-3" />
                                            {previewMode ? "Edit" : "Preview"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {useHtml ? (
                                previewMode ? (
                                    <Card className="p-4 border-border/50">
                                        <div 
                                            className="prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: htmlBody }}
                                        />
                                    </Card>
                                ) : (
                                    <Textarea
                                        value={htmlBody}
                                        onChange={(e) => setHtmlBody(e.target.value)}
                                        placeholder="Enter HTML code for email body..."
                                        rows={15}
                                        className="resize-none rounded-md font-mono text-sm"
                                    />
                                )
                            ) : (
                                <Textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder="Email body (plain text)"
                                    rows={10}
                                    className="resize-none rounded-md"
                                />
                            )}

                            {useHtml && (
                                <p className="text-xs text-muted-foreground">
                                    💡 Tip: Use HTML to create professional email templates with colors, formatting, and styling.
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                            className="h-10 rounded-md font-semibold text-sm px-4"
                            disabled={sending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSend}
                            disabled={sending}
                            className="h-10 rounded-md font-semibold text-sm px-4 gap-2"
                        >
                            <Send className="w-4 h-4" />
                            {sending ? "Sending..." : "Send Email"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default MailSender;
