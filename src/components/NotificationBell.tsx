import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";

const NotificationBell = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      return;
    }

    const checkNotifications = () => {
      try {
        const notifs: any[] = [];
        let totalUnread = 0;

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

          totalUnread = unreadMessages.length + pendingVolunteers.length;

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
    // Check every 5 seconds
    const interval = setInterval(checkNotifications, 5000);

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
  }, []);

  if (!auth.isAuthenticated()) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-white hover:text-white hover:bg-white/10"
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
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    navigate(notif.link);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notif.description}
                      </p>
                    </div>
                    {notif.count > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {notif.count}
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

