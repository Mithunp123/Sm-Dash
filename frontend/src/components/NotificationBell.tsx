import { useState, useEffect } from "react";
import { Bell, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { format } from "date-fns";

const NotificationBell = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      return;
    }

    const checkNotifications = async () => {
      try {
        const notifs: any[] = [];
        let totalUnread = 0;

        // Check for running events (events happening today) - for all users
        try {
          const currentYear = new Date().getFullYear().toString();
          const eventsResponse = await api.getPublicEvents(currentYear);
          if (eventsResponse && eventsResponse.success && eventsResponse.events) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const runningEvents = eventsResponse.events.filter((event: any) => {
              try {
                const eventDate = new Date(event.date);
                eventDate.setHours(0, 0, 0, 0);
                const daysDiff = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff === 0; // Only today's events (running events)
              } catch {
                return false;
              }
            });

            if (runningEvents.length > 0) {
              const dismissed = JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');
              runningEvents.forEach((event: any) => {
                const eventId = `event-${event.id}`;
                if (!dismissed.includes(eventId)) {
                  const eventDate = new Date(event.date);
                  notifs.push({
                    id: eventId,
                    type: 'event',
                    title: `Running Event: ${event.title}`,
                    description: `Event Date: ${format(eventDate, "MMM dd, yyyy")}`,
                    count: 0,
                    link: '/',
                    date: event.date
                  });
                  totalUnread += 1; // Count as unread
                }
              });
            }
          }
        } catch (eventError: any) {
          // Silently handle connection errors - backend might not be running
          // Only log if it's not a connection error
          if (eventError?.message && !eventError.message.includes('Failed to fetch') && !eventError.message.includes('ERR_CONNECTION_REFUSED')) {
            console.error('Error loading running events:', eventError);
          }
          // Don't show error to user if backend is not available
        }

        // Admin-specific notifications
        if (auth.hasRole('admin')) {
          // Check for unread messages
          const messagesJson = localStorage.getItem('admin_messages');
          const messages = messagesJson ? JSON.parse(messagesJson) : [];
          const unreadMessages = messages.filter((m: any) => !m.read);

          // Check for pending volunteer submissions
          const volunteersJson = localStorage.getItem('volunteer_submissions');
          const volunteers = volunteersJson ? JSON.parse(volunteersJson) : [];
          const pendingVolunteers = volunteers.filter((v: any) => (v.status || 'pending') === 'pending');

          totalUnread += unreadMessages.length + pendingVolunteers.length;

          if (unreadMessages.length > 0) {
            notifs.push({
              id: 'messages',
              type: 'message',
              title: `${unreadMessages.length} New Message${unreadMessages.length > 1 ? 's' : ''}`,
              description: 'You have unread messages',
              count: unreadMessages.length,
              link: '/admin/messages'
            });
          }

          if (pendingVolunteers.length > 0) {
            notifs.push({
              id: 'volunteers',
              type: 'volunteer',
              title: `${pendingVolunteers.length} Pending Volunteer${pendingVolunteers.length > 1 ? 's' : ''}`,
              description: 'Volunteer registrations awaiting approval',
              count: pendingVolunteers.length,
              link: '/admin/volunteers?filter=pending'
            });
          }
        }

        // Student-specific notifications
        if (auth.hasRole('student')) {
          // Check for message replies
          const user = auth.getUser();
          if (user && user.email) {
            const repliesJson = localStorage.getItem('message_replies');
            const replies = repliesJson ? JSON.parse(repliesJson) : [];
            const unreadReplies = replies.filter((r: any) =>
              r.email === user.email && !r.read
            );

            totalUnread += unreadReplies.length;

            if (unreadReplies.length > 0) {
              notifs.push({
                id: 'message_replies',
                type: 'reply',
                title: `${unreadReplies.length} New Reply${unreadReplies.length > 1 ? 's' : ''}`,
                description: 'You have replies to your messages',
                count: unreadReplies.length,
                link: '/student/messages'
              });
            }
          }
        }

        setUnreadCount(totalUnread);
        setNotifications(notifs);
      } catch (e) {
        console.error('Error checking notifications:', e);
      }
    };

    checkNotifications();
    // Check every 30 seconds (reduced frequency to avoid spamming when backend is down)
    const interval = setInterval(checkNotifications, 10000);

    // Also listen for storage changes
    window.addEventListener('storage', checkNotifications);
    window.addEventListener('volunteerSubmission', checkNotifications);
    window.addEventListener('adminMessage', checkNotifications);
    window.addEventListener('messageReply', checkNotifications);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkNotifications);
      window.removeEventListener('volunteerSubmission', checkNotifications);
      window.removeEventListener('adminMessage', checkNotifications);
      window.removeEventListener('messageReply', checkNotifications);
    };
  }, [location.pathname]);

  if (!auth.isAuthenticated()) {
    return null;
  }

  const handleNotificationClick = (notif: any) => {
    // Determine if it needs to be "dismissed" (stored as read locally)
    if (notif.id.toString().startsWith('event-') || notif.type === 'event') {
      try {
        const dismissed = JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');
        if (!dismissed.includes(notif.id)) {
          dismissed.push(notif.id);
          localStorage.setItem('dismissed_notifications', JSON.stringify(dismissed));
        }
      } catch (e) {
        console.error("Error saving dismissed notification", e);
      }
    } else if (notif.type === 'message') {
      // Mark all unread messages as read
      try {
        const messages = JSON.parse(localStorage.getItem('admin_messages') || '[]');
        const updatedMessages = messages.map((m: any) => ({ ...m, read: true }));
        localStorage.setItem('admin_messages', JSON.stringify(updatedMessages));
        window.dispatchEvent(new Event('adminMessage'));
      } catch (e) {
        console.error("Error marking messages as read", e);
      }
    } else if (notif.type === 'reply') {
      // Mark all unread replies for this user as read
      try {
        const user = auth.getUser();
        if (user && user.email) {
          const replies = JSON.parse(localStorage.getItem('message_replies') || '[]');
          const updatedReplies = replies.map((r: any) => {
            if (r.email === user.email) {
              return { ...r, read: true };
            }
            return r;
          });
          localStorage.setItem('message_replies', JSON.stringify(updatedReplies));
          window.dispatchEvent(new Event('messageReply'));
        }
      } catch (e) {
        console.error("Error marking replies as read", e);
      }
    }

    // For messages, we assume the page itself will handle marking as read upon open
    // But we trigger a re-check anyway
    navigate(notif.link);

    // Quick update local state to make it feel responsive
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-foreground hover:text-primary hover:bg-primary/10"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No new notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors relative group"
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notif.description}
                      </p>
                      {notif.type === 'event' && notif.date && (
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3 text-blue-600" />
                          <span className="text-xs text-blue-600 font-medium">
                            {format(new Date(notif.date), "MMM dd, yyyy")}
                          </span>
                        </div>
                      )}
                    </div>
                    {notif.count > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {notif.count}
                      </span>
                    )}
                    {notif.type === 'event' && (
                      <span className="ml-2 bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        <Calendar className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {(notifications.length > 0) && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => navigate('/admin')}
            >
              View All
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;

