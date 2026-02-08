import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Edit2, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DeveloperCredit from '@/components/DeveloperCredit';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/BackButton';
import { auth } from '@/lib/auth';

interface FeedbackQuestion {
  id: number;
  question_text: string;
  question_type: string;
  event_id: number | null;
  is_enabled?: number;
  event_title: string | null;
  event_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Meeting {
  id: number;
  title: string;
  date: string;
}

export default function ManageQuestions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ question_text: '', question_type: 'rating', event_id: '', is_enabled: true });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    // Check authentication and role
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const userRole = auth.getRole();
    if (userRole !== 'admin' && userRole !== 'office_bearer') {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to manage feedback questions',
        variant: 'destructive',
      });
      navigate(userRole === 'student' ? '/student' : '/');
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [questionsRes, meetingsRes] = await Promise.all([
        api.getFeedbackQuestions(),
        api.getMeetings(),
      ]);

      if (questionsRes.success) {
        setQuestions(questionsRes.questions || []);
      }
      if (meetingsRes.success) {
        setMeetings(meetingsRes.meetings || []);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (question?: FeedbackQuestion) => {
    if (question) {
      setEditingId(question.id);
      setFormData({
        question_text: question.question_text,
        question_type: question.question_type,
        event_id: question.event_id?.toString() || '',
        is_enabled: question.is_enabled === 0 ? false : true,
      });
    } else {
      setEditingId(null);
      setFormData({ question_text: '', question_type: 'rating', event_id: '', is_enabled: true });
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.question_text.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Question text is required',
          variant: 'destructive',
        });
        return;
      }

      const event_id = formData.event_id ? parseInt(formData.event_id) : undefined;
      const is_enabled = !!formData.is_enabled;

      let response;
      if (editingId) {
        response = await api.updateFeedbackQuestion(
          editingId,
          formData.question_text,
          formData.question_type,
          event_id,
          is_enabled
        );
      } else {
        response = await api.createFeedbackQuestion(
          formData.question_text,
          formData.question_type,
          event_id,
          is_enabled
        );
      }

      if (response.success) {
        toast({
          title: 'Success',
          description: editingId ? 'Question updated' : 'Question created',
        });
        setIsOpen(false);
        loadData();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save question',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await api.deleteFeedbackQuestion(deleteId);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Question deleted',
        });
        loadData();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete question',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent">
      <DeveloperCredit />

      <main className="flex-1 p-2 md:p-4 bg-transparent">
        <div className="w-full">

          {/* Page Header */}
          <div className="mb-6">
            <BackButton to="/admin" />
          </div>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white">Feedback Questions</h1>
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground opacity-70">Manage questions and responses</p>
            </div>
            <Button
              onClick={() => handleOpen()}
              className="gap-2 h-11 px-6 rounded-2xl shadow-lg shadow-primary/20 font-bold w-full sm:w-auto mt-2 sm:mt-0"
            >
              <Plus className="w-4 h-4" />
              New Question
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading questions...</p>
            </div>
          ) : questions.length === 0 ? (
            <Card className="p-12 text-center border-none bg-card/40 backdrop-blur-md shadow-xl rounded-3xl">
              <p className="text-muted-foreground font-bold italic mb-6">No feedback questions yet</p>
              <Button
                onClick={() => handleOpen()}
                className="gap-2 bg-primary hover:bg-primary/90 rounded-2xl h-12 px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                Create First Question
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {questions.map(question => (
                <div key={question.id} className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${question.is_enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`} />

                  <div className="p-5 pl-7 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between sm:justify-start gap-3">
                        <h3 className="font-semibold text-lg text-foreground leading-tight">
                          {question.question_text}
                        </h3>
                        {question.is_enabled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 uppercase tracking-wide">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border uppercase tracking-wide">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                          {question.question_type === 'rating' ? (
                            <>
                              <span className="text-amber-500">⭐</span> Rating Scale
                            </>
                          ) : (
                            <>
                              <span className="text-blue-500">📝</span> Text Response
                            </>
                          )}
                        </span>

                        {question.event_title ? (
                          <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/5 text-blue-600 dark:text-blue-400 border border-blue-500/10">
                            📅 {question.event_title}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/5 text-purple-600 dark:text-purple-400 border border-purple-500/10">
                            📋 General Feedback
                          </span>
                        )}

                        <span className="px-2 py-1">
                          Created: {new Date(question.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                      <Button
                        variant={question.is_enabled ? "outline" : "default"}
                        size="sm"
                        onClick={async () => {
                          try {
                            await api.toggleFeedbackQuestion(question.id);
                            loadData();
                          } catch (e: any) {
                            toast({ title: 'Error', description: e.message || 'Failed to toggle question', variant: 'destructive' });
                          }
                        }}
                        className={`h-8 text-xs ${!question.is_enabled ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      >
                        {question.is_enabled ? 'Disable' : 'Enable'}
                      </Button>

                      <div className="flex bg-muted/50 rounded-md border border-border/50 p-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpen(question)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <div className="w-px bg-border/50 my-1" />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(question.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div >
          )}

          {/* Create/Edit Dialog */}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Edit Question' : 'Create New Question'}
                </DialogTitle>
                <DialogDescription>
                  {editingId ? 'Update the feedback question' : 'Create a new feedback question'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Question Text *
                  </label>
                  <Textarea
                    value={formData.question_text}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        question_text: e.target.value,
                      }))
                    }
                    placeholder="Enter the feedback question..."
                    className="min-h-[100px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Question Type
                  </label>
                  <select
                    value={formData.question_type}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        question_type: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="rating">⭐ Rating Scale (1-5 stars)</option>
                    <option value="text">📝 Text Response</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Event/Meeting (Optional)
                  </label>
                  <select
                    value={formData.event_id}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        event_id: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- General Feedback (All Students) --</option>
                    {meetings.map(meeting => (
                      <option key={meeting.id} value={meeting.id.toString()}>
                        {meeting.title} ({new Date(meeting.date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    If you select an event, only students who attended will see this question
                  </p>
                </div>
                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={!!formData.is_enabled}
                      onChange={e => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-foreground">Enabled</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">If disabled, students will still be able to view previously submitted responses (admins only) but won't be able to submit new responses for this question.</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {editingId ? 'Update' : 'Create'} Question
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogTitle>Delete Question</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this question? This action cannot be undone.
              </AlertDialogDescription>
              <div className="flex gap-3 justify-end">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div >
      </main >

    </div >
  );
}
