import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Star, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DeveloperCredit from '@/components/DeveloperCredit';
import { BackButton } from '@/components/BackButton';
import { auth } from '@/lib/auth';

interface FeedbackQuestion {
  id: number;
  question_text: string;
  question_type: string;
  event_id: number | null;
  event_title: string | null;
  event_date: string | null;
  created_at: string;
}

interface FeedbackResponse {
  questionId: number;
  rating: number;
  feedbackText: string;
}

export default function StudentFeedback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [responses, setResponses] = useState<Record<number, FeedbackResponse>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check authentication
    if (!auth.isAuthenticated() || !auth.hasRole('student')) {
      navigate("/login");
      return;
    }
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const response = await api.getFeedbackQuestions();
      if (response.success) {
        setQuestions(response.questions || []);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load feedback questions',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load feedback questions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (questionId: number, rating: number) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        rating,
      },
    }));
  };

  const handleFeedbackTextChange = (questionId: number, text: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        feedbackText: text,
      },
    }));
  };

  const submitFeedback = async () => {
    try {
      setSubmitting(true);

      // Validate that all questions have been answered
      const unanswered = questions.filter(q => !responses[q.id]?.rating);
      if (unanswered.length > 0) {
        toast({
          title: 'Incomplete Feedback',
          description: `Please rate all ${unanswered.length} question(s) before submitting`,
          variant: 'destructive',
        });
        return;
      }

      // Submit all responses
      const submissionPromises = questions.map(q => {
        const response = responses[q.id];
        return api.submitFeedbackResponse(
          q.id,
          response.rating,
          response.feedbackText || undefined
        );
      });

      const results = await Promise.all(submissionPromises);

      const allSuccess = results.every(r => r.success);
      if (allSuccess) {
        toast({
          title: 'Success',
          description: 'Your feedback has been submitted successfully!',
        });
        // Reset form
        setResponses({});
        // Optionally navigate back
        setTimeout(() => navigate('/student'), 2000);
      } else {
        toast({
          title: 'Error',
          description: 'Some feedback items failed to submit. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit feedback',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  // Group questions by event
  const groupedQuestions = questions.reduce((groups: Record<string, FeedbackQuestion[]>, question) => {
    const key = question.event_id ? `event_${question.event_id}` : 'general';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(question);
    return groups;
  }, {});

  const questionGroups = Object.entries(groupedQuestions).map(([key, qList]) => ({
    key,
    isEvent: key.startsWith('event_'),
    title: qList[0]?.event_title || 'General Feedback',
    date: qList[0]?.event_date,
    questions: qList,
  }));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent min-h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4 inline-block p-4 rounded-full bg-primary/10">
            <Star className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground font-bold animate-pulse">Loading feedback questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full">
      <DeveloperCredit />
      <div className="container mx-auto p-4 md:p-8 w-full">
        {/* Header Section */}
        <div className="max-w-4xl mx-auto space-y-8 mb-8">
          <div className="flex flex-col gap-2">
            <div className="mb-2">
              <BackButton />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-foreground">Student Feedback</h1>
              <p className="text-muted-foreground font-bold tracking-tight">Your voice matters! Help us improve the volunteering experience.</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {questionGroups.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2 border-border bg-muted/20 rounded-[2rem]">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Star className="w-10 h-10 text-primary opacity-50" />
              </div>
              <h2 className="text-2xl font-black text-muted-foreground uppercase tracking-widest italic mb-2">
                All Caught Up
              </h2>
              <p className="text-muted-foreground font-medium">
                There are currently no feedback questions awaiting your response.
              </p>
            </Card>
          ) : (
            questionGroups.map(group => (
              <div key={group.key} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                {/* Group Header */}
                <div className="flex items-center gap-4 py-2">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm ${group.isEvent ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' : 'bg-orange-500/10 border-orange-500/20 text-orange-600'}`}>
                    {group.isEvent ? <Star className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">
                      {group.title}
                    </h2>
                    {group.isEvent && group.date && (
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                        <Star className="w-3 h-3" />
                        {new Date(group.date).toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Questions */}
                {group.questions.map((question, qIdx) => (
                  <Card key={question.id} className="overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl group">
                    <div className="p-6 md:p-8">
                      <div className="flex items-start gap-4 mb-6">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                          {qIdx + 1}
                        </span>
                        <h3 className="text-lg font-bold text-foreground leading-snug pt-1">
                          {question.question_text}
                        </h3>
                      </div>

                      {/* Star Rating Grid */}
                      <div className="bg-muted/30 rounded-2xl p-6 mb-6">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4 block">Your Rating</label>
                        <div className="flex flex-wrap gap-4 items-center justify-center sm:justify-start">
                          {[1, 2, 3, 4, 5].map(rating => (
                            <button
                              key={rating}
                              onClick={() => handleRatingChange(question.id, rating)}
                              className="group/star relative transition-all duration-200 hover:-translate-y-1 focus:outline-none"
                              title={ratingLabels[rating - 1]}
                            >
                              <Star
                                className={`w-10 h-10 transition-all duration-300 ${(responses[question.id]?.rating || 0) >= rating
                                  ? 'fill-amber-400 text-amber-400 drop-shadow-md scale-110'
                                  : 'text-muted-foreground/30 group-hover/star:text-amber-300/50'
                                  }`}
                              />
                              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-0 group-hover/star:opacity-100 transition-opacity">
                                {ratingLabels[rating - 1]}
                              </span>
                            </button>
                          ))}
                        </div>
                        {responses[question.id]?.rating && (
                          <div className="mt-4 pt-4 border-t border-border/50 text-center sm:text-left">
                            <span className="text-sm font-medium text-muted-foreground">You rated this: </span>
                            <span className="text-sm font-black text-amber-500 uppercase tracking-wide">{ratingLabels[responses[question.id].rating - 1]}</span>
                          </div>
                        )}
                      </div>

                      {/* Suggestions Text Area */}
                      <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">
                          Additional Comments (Optional)
                        </label>
                        <Textarea
                          placeholder="Share your thoughts..."
                          value={responses[question.id]?.feedbackText || ''}
                          onChange={e => handleFeedbackTextChange(question.id, e.target.value)}
                          className="min-h-[100px] bg-background border-2 border-border focus:border-primary/50 focus:ring-0 rounded-xl resize-y"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ))
          )}

          {/* Action Buttons */}
          {questionGroups.length > 0 && (
            <div className="sticky bottom-4 z-20 flex gap-4 justify-end bg-background/80 backdrop-blur-lg p-4 rounded-2xl border border-border/50 shadow-2xl">
              <Button
                variant="outline"
                onClick={() => navigate('/student')}
                disabled={submitting}
                className="font-bold rounded-xl h-12 px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={submitFeedback}
                disabled={submitting}
                className="font-bold rounded-xl h-12 px-8 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
