import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Eye, Send, AlertCircle, CheckCircle2, XCircle, UserCheck } from "lucide-react";

type DecisionType = "selected" | "rejected";

type EmailLogStatus = "sent" | "pending";

interface Candidate {
  id: number;
  name: string;
  email: string;
  decision?: string;
  status: string;
  user_id?: number;
  email_status?: EmailLogStatus;
  sent_at?: string | null;
  already_sent?: boolean;
}

interface EmailPreview {
  email: string;
  name: string;
  subject: string;
  html: string;
  emailType: string;
}

const defaultSubject = (type: DecisionType) =>
  type === "selected"
    ? "🎉 Congratulations, {{name}}!"
    : "Interview Result - {{name}}";

const defaultBody = (type: DecisionType) =>
  type === "selected"
    ? "Dear {{name}},\n\nCongratulations! You have been selected.\n\nYour registered email is {{email}}.\n\nRegards,\nSM Volunteers Team"
    : "Dear {{name}},\n\nWe regret to inform you that you were not selected this round.\n\nYour registered email is {{email}}.\n\nRegards,\nSM Volunteers Team";

export default function InterviewEmailPanelManual() {
  const [flow, setFlow] = useState<DecisionType>("selected");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const [searchQuery, setSearchQuery] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState(defaultSubject("selected"));
  const [bodyTemplate, setBodyTemplate] = useState(defaultBody("selected"));

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<EmailPreview | null>(null);

  const [confirmSending, setConfirmSending] = useState(false);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `/api/interviews/admin/email-candidates?type=${flow}`
      );
      if (response.success) {
        setCandidates(response.candidates || []);
      } else {
        toast.error(response?.message || "Failed to load candidates");
      }
    } catch (err: any) {
      console.error("Error fetching candidates:", err);
      toast.error(err?.message || "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedIds([]);
    setSubjectTemplate(defaultSubject(flow));
    setBodyTemplate(defaultBody(flow));
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [candidates, searchQuery]);

  const totals = useMemo(() => {
    const sent = filteredCandidates.filter((c) => c.already_sent).length;
    const pending = filteredCandidates.filter((c) => !c.already_sent).length;
    return { sent, pending, total: filteredCandidates.length };
  }, [filteredCandidates]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectable = filteredCandidates
        .filter((c) => !c.already_sent)
        .map((c) => c.id);
      setSelectedIds(selectable);
    } else {
      setSelectedIds([]);
    }
  };

  const toggleCandidate = (candidateId: number, alreadySent?: boolean) => {
    if (alreadySent) return;
    setSelectedIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  const openPreviewForCandidate = async (candidateId: number) => {
    setPreviewLoading(true);
    try {
      const response = await api.post("/api/interviews/admin/preview-email", {
        candidateId,
        type: flow,
        subject: subjectTemplate,
        body: bodyTemplate,
      });
      if (response.success) {
        setPreviewData(response.preview);
        setPreviewOpen(true);
      } else {
        toast.error(response?.message || "Failed to preview email");
      }
    } catch (err: any) {
      console.error("Preview email error:", err);
      toast.error(err?.message || "Failed to load email preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendFlow = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one candidate");
      return;
    }

    // Preview first (manual compose requirement)
    await openPreviewForCandidate(selectedIds[0]);
  };

  const confirmSend = async () => {
    setConfirmSending(true);
    try {
      const response = await api.post("/api/interviews/admin/send-outcome-emails", {
        candidateIds: selectedIds,
        type: flow,
        subject: subjectTemplate,
        body: bodyTemplate,
      });

      if (response.success) {
        toast.success(
          `Processed emails. Sent: ${response.sentCount}, Skipped: ${response.skippedCount}, Failed: ${response.failedCount}`
        );
        setPreviewOpen(false);
        setSelectedIds([]);
        fetchCandidates();
      } else {
        toast.error(response?.message || "Failed to send emails");
      }
    } catch (err: any) {
      console.error("Send emails error:", err);
      toast.error(err?.message || "Failed to send emails");
    } finally {
      setConfirmSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{totals.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{totals.pending}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Management
              </CardTitle>
              <CardDescription>
                Manual send only. Use variables `{{name}}` and `{{email}}`.
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button
                variant={flow === "selected" ? "default" : "outline"}
                onClick={() => setFlow("selected")}
                className="font-bold"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Selected Candidates
              </Button>
              <Button
                variant={flow === "rejected" ? "default" : "outline"}
                onClick={() => setFlow("rejected")}
                className="font-bold"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejected Candidates
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Template</Label>
              <Input
                id="subject"
                value={subjectTemplate}
                onChange={(e) => setSubjectTemplate(e.target.value)}
                placeholder="e.g. Interview Result - {{name}}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body Template</Label>
            <Textarea
              id="body"
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={7}
              placeholder="Dear {{name}}, Your email is {{email}}..."
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button
                onClick={handleSendFlow}
                disabled={flow !== "selected" || selectedIds.length === 0 || previewLoading || confirmSending}
                className="gap-2"
                variant={flow === "selected" ? "default" : "outline"}
              >
                <Send className="w-4 h-4" />
                Send Selected ({selectedIds.length})
              </Button>
              <Button
                onClick={handleSendFlow}
                disabled={flow !== "rejected" || selectedIds.length === 0 || previewLoading || confirmSending}
                className="gap-2"
                variant={flow === "rejected" ? "default" : "outline"}
              >
                <Send className="w-4 h-4" />
                Send Rejected ({selectedIds.length})
              </Button>
              {selectedIds.length > 0 && (
                <Button variant="outline" onClick={() => setSelectedIds([])}>
                  Clear Selection
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              Preview opens first; send happens only after confirmation.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
          <CardDescription>
            Already sent emails are locked (checkbox disabled).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading candidates...</p>
          ) : filteredCandidates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No candidates found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedIds.length ===
                            filteredCandidates.filter((c) => !c.already_sent).length &&
                          filteredCandidates.length > 0
                        }
                        onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((candidate) => {
                    const alreadySent = Boolean(candidate.already_sent);
                    return (
                      <TableRow key={candidate.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSet.has(candidate.id)}
                            onCheckedChange={(checked) => toggleCandidate(candidate.id, alreadySent)}
                            disabled={alreadySent}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{candidate.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{candidate.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{candidate.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {alreadySent ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-sm font-semibold">Already Sent</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-red-600">
                              <XCircle className="w-4 h-4" />
                              <span className="text-sm font-semibold">Not Sent</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={previewLoading}
                            className="gap-1"
                            onClick={() => openPreviewForCandidate(candidate.id)}
                          >
                            <Eye className="w-4 h-4" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>Review the composed email before sending.</DialogDescription>
          </DialogHeader>

          {previewData ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preview-to">To</Label>
                <Input id="preview-to" value={previewData.email} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preview-subject">Subject</Label>
                <Input id="preview-subject" value={previewData.subject} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preview-body">Body</Label>
                <div
                  className="mt-1 p-4 border rounded-lg bg-muted/50 max-h-64 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: previewData.html }}
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  This preview is generated for the first selected candidate. Clicking <b>Confirm Send</b> will send to all selected candidates.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">No preview loaded.</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={confirmSending}>
              Close
            </Button>
            <Button onClick={confirmSend} disabled={!selectedIds.length || confirmSending}>
              {confirmSending ? "Sending..." : "Confirm Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

