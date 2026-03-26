import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import DeveloperCredit from '@/components/DeveloperCredit';
import { BackButton } from '@/components/BackButton';
import { auth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Calendar, Loader2, ArrowRight, Settings, TrendingUp, DollarSign, Inbox } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const BillsEventSelector = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [financeSummary, setFinanceSummary] = useState<{ [key: number]: any }>({});

  // Check auth
  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    loadEvents();
  }, []);

  // Load events
  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/events', {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        // Filter events that have finance_enabled = 1
        const financeEvents = (data.events || []).filter((e: any) => e.finance_enabled === 1);
        setEvents(financeEvents);
        
        // Load finance summary for each event
        financeEvents.forEach(event => {
          loadFinanceSummary(event.id);
        });
      } else {
        toast.error(data.message || 'Failed to load events');
      }
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Error loading events');
    } finally {
      setLoading(false);
    }
  };

  // Load finance summary for specific event
  const loadFinanceSummary = async (eventId: number) => {
    try {
      const response = await fetch(`/api/fundraising/summary/${eventId}`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setFinanceSummary(prev => ({
          ...prev,
          [eventId]: {
            totalFunds: data.total_raised || 0,
            totalExpenses: data.total_expenses || 0,
            balance: (data.total_raised || 0) - (data.total_expenses || 0),
            collections: data.collections_count || 0,
            expenses: data.expenses_count || 0
          }
        }));
      }
    } catch (error) {
      console.error('Error loading finance summary:', error);
      // Silent fail - not critical
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <DeveloperCredit />
      <main className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <BackButton />
          <h1 className="text-4xl font-bold mt-4 mb-2 flex items-center gap-3">
            <Calendar className="w-8 h-8" />
            Event List
          </h1>
          <p className="text-muted-foreground text-lg">Choose the event for finance tracking.</p>
        </div>

        {/* Events Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {events.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">No events found</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Create an event to start managing bills and expenses
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Finance Enabled Events</CardTitle>
                <CardDescription>
                  Select an event to manage its bills and expenses, or view fundraising collections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.map((event, index) => {
                    const summary = financeSummary[event.id] || { totalFunds: 0, totalExpenses: 0, balance: 0, collections: 0, expenses: 0 };
                    const balanceColor = summary.balance >= 0 ? 'text-green-600' : 'text-red-600';
                    
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="bg-muted/30 hover:bg-muted/60 transition-colors">
                          <CardContent className="pt-6">
                            {/* Header with Event Title and Status */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div className="md:col-span-1">
                                <h3 className="font-bold text-lg mb-1">{event.title}</h3>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {event.date} • {event.year}
                                </p>
                              </div>

                              {/* Finance Summary */}
                              <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                <div className="bg-background p-3 rounded-lg border border-green-200 dark:border-green-900">
                                  <Label className="text-xs text-muted-foreground">Funds Raised</Label>
                                  <p className="font-bold text-green-600">₹ {summary.totalFunds.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{summary.collections} entries</p>
                                </div>
                                <div className="bg-background p-3 rounded-lg border border-red-200 dark:border-red-900">
                                  <Label className="text-xs text-muted-foreground">Expenses</Label>
                                  <p className="font-bold text-red-600">₹ {summary.totalExpenses.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{summary.expenses} bills</p>
                                </div>
                                <div className={`bg-background p-3 rounded-lg border ${summary.balance >= 0 ? 'border-green-200 dark:border-green-900' : 'border-red-200 dark:border-red-900'}`}>
                                  <Label className="text-xs text-muted-foreground">Balance</Label>
                                  <p className={`font-bold ${balanceColor}`}>₹ {summary.balance.toLocaleString()}</p>
                                  <Badge className="mt-2" variant={summary.balance >= 0 ? "default" : "destructive"}>
                                    {summary.balance >= 0 ? 'Surplus' : 'Deficit'}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex flex-wrap gap-2 border-t pt-4">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => navigate(`/bills/event/${event.id}`)}
                                className="gap-1 flex-1 md:flex-initial"
                              >
                                <Inbox className="w-4 h-4" />
                                Bills
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/admin/events/${event.id}/funds`)}
                                className="gap-1 flex-1 md:flex-initial"
                              >
                                <TrendingUp className="w-4 h-4" />
                                Fundraising
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/admin/events/${event.id}`)}
                                className="gap-1 flex-1 md:flex-initial"
                              >
                                <ArrowRight className="w-4 h-4" />
                                Details
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default BillsEventSelector;
