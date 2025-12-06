import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Star, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DeveloperCredit from '@/components/DeveloperCredit';
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
      <div className="min-h-screen flex flex-col">
        <Header />
        <DeveloperCredit />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin mb-4">
              <Star className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-gray-600">Loading feedback questions...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <DeveloperCredit />
        <main className="flex-1 p-4 md:p-8 bg-background">
          <div className="max-w-2xl mx-auto py-12">
            <Button
              variant="ghost"
              onClick={() => navigate('/student')}
              className="mb-6 gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <Card className="p-8 text-center gradient-card">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                No Feedback Available
              </h2>
              <p className="text-gray-600 mb-6">
                There are currently no feedback questions to answer. Please check back later.
              </p>
              <Button onClick={() => navigate('/student')}>
                Back to Dashboard
              </Button>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      <main className="flex-1 p-4 md:p-8 bg-background">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/student')}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Student Feedback</h1>
            <p className="text-muted-foreground">
              Your feedback helps us improve. Please rate each question honestly.
            </p>
          </div>

          <div className="space-y-8">
            {questionGroups.length === 0 ? (
              <Card className="p-8 text-center gradient-card">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  No Feedback Available
                </h2>
                <p className="text-gray-600 mb-6">
                  There are currently no feedback questions to answer.
                </p>
              </Card>
            ) : (
              questionGroups.map(group => (
              <div key={group.key} className="space-y-4">
                {/* Event Header */}
                <div className="border-l-4 border-blue-500 pl-4 py-2">
                  <h2 className="text-xl font-bold text-gray-800">
                    {group.isEvent ? '📅 ' : '📋 '}{group.title}
                  </h2>
                  {group.isEvent && group.date && (
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(group.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  )}
                </div>

                {/* Questions */}
                {group.questions.map((question, qIdx) => (
                  <Card key={question.id} className="p-6 gradient-card border-border/50">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">
                            Q{qIdx + 1}. {question.question_text}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {/* Star Rating */}
                    <div className="mb-6">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(rating => (
                          <button
                            key={rating}
                            onClick={() => handleRatingChange(question.id, rating)}
                            className="group relative"
                            title={ratingLabels[rating - 1]}
                          >
                            <Star
                              className={`w-8 h-8 transition-colors ${
                                (responses[question.id]?.rating || 0) >= rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300 group-hover:text-yellow-200'
                              }`}
                            />
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mb-2">
                              {ratingLabels[rating - 1]}
                            </span>
                          </button>
                        ))}
                      </div>
                      {responses[question.id]?.rating && (
                        <p className="text-sm text-gray-600 mt-2">
                          You selected: <span className="font-semibold">{ratingLabels[responses[question.id].rating - 1]}</span>
                        </p>
                      )}
                    </div>

                    {/* Suggestions Text Area */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Suggestions (Optional)
                      </label>
                      <Textarea
                        placeholder="Share any additional comments or suggestions..."
                        value={responses[question.id]?.feedbackText || ''}
                        onChange={e => handleFeedbackTextChange(question.id, e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                  </Card>
                ))}
              </div>
            ))
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8 justify-end">
            <Button
              variant="outline"
              onClick={() => navigate('/student')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitFeedback}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
