import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays,
  CheckCircle,
  UserPlus
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';

// Mock notifications for demonstration
const mockNotifications = [
  {
    id: 1,
    type: 'application_received',
    title: 'New application received',
    message: 'Aman Rauniyar applied for Java Developer',
    timestamp: new Date(2023, 4, 24, 10, 30),
    read: false,
    entityId: 71, // candidateId
    jobId: 26
  },
  {
    id: 2,
    type: 'application_received',
    title: 'New application received',
    message: 'Manoj Kumar applied for Java Developer',
    timestamp: new Date(2023, 4, 24, 10, 15),
    read: false,
    entityId: 72, // candidateId
    jobId: 26
  },
  {
    id: 3,
    type: 'application_processed',
    title: 'Application processed',
    message: 'Rajesh Singh\'s application has been processed',
    timestamp: new Date(2023, 4, 23, 16, 45),
    read: true,
    entityId: 73, // candidateId
    jobId: 25
  },
  {
    id: 4,
    type: 'submission_created',
    title: 'Submission created',
    message: 'Aman Rauniyar submitted to Citi Bank',
    timestamp: new Date(2023, 4, 23, 9, 10),
    read: true,
    entityId: 77, // submissionId
    jobId: 26
  },
  {
    id: 5,
    type: 'application_received',
    title: 'New application received',
    message: 'Vikram Patel applied for Business Analyst',
    timestamp: new Date(2023, 4, 22, 14, 20),
    read: true,
    entityId: 74, // candidateId
    jobId: 25
  }
];

// In a real implementation, we would fetch this from the API
const useNotifications = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      // In a real implementation, this would be an API call
      // return fetch('/api/notifications').then(res => res.json());
      return Promise.resolve(mockNotifications);
    }
  });

  return {
    notifications: data || [],
    isLoading,
    error
  };
};

// Get the appropriate route for a notification
const getNotificationRoute = (notification: any) => {
  switch(notification.type) {
    case 'application_received':
      return `/candidates/${notification.entityId}`;
    case 'application_processed':
      return `/candidates/${notification.entityId}`;
    case 'submission_created':
      return `/submissions/${notification.entityId}`;
    default:
      return '/';
  }
};

// Get the appropriate icon for a notification
const getNotificationIcon = (type: string) => {
  switch(type) {
    case 'application_received':
      return <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-300" />;
    case 'application_processed':
      return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-300" />;
    case 'submission_created':
      return <CalendarDays className="h-4 w-4 text-purple-600 dark:text-purple-300" />;
    default:
      return <CalendarDays className="h-4 w-4 text-gray-600 dark:text-gray-300" />;
  }
};

// Get the appropriate background color for a notification icon
const getNotificationIconBg = (type: string) => {
  switch(type) {
    case 'application_received':
      return 'bg-blue-100 dark:bg-blue-900';
    case 'application_processed':
      return 'bg-green-100 dark:bg-green-900';
    case 'submission_created':
      return 'bg-purple-100 dark:bg-purple-900';
    default:
      return 'bg-gray-100 dark:bg-gray-800';
  }
};

const NotificationItem = ({ notification }: { notification: any }) => {
  return (
    <Link href={getNotificationRoute(notification)}>
      <div className="border-b border-border last:border-0 cursor-pointer hover:bg-accent transition-colors">
        <div className="p-4 flex items-start gap-3">
          <div className={`${getNotificationIconBg(notification.type)} p-2 rounded-full flex-shrink-0`}>
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{notification.title}</p>
              {!notification.read && (
                <Badge variant="default" className="text-[10px] h-5 px-1.5">New</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
            <p className="text-xs text-muted-foreground mt-1">{format(notification.timestamp, 'MMM d, yyyy h:mm a')}</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

const NotificationsPage = () => {
  const { notifications, isLoading } = useNotifications();
  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Stay updated with recent activities and applications</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All
                <Badge variant="outline" className="ml-2">{notifications.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="unread">
                Unread
                <Badge variant="outline" className="ml-2">{unreadNotifications.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="read">
                Read
                <Badge variant="outline" className="ml-2">{readNotifications.length}</Badge>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-start gap-3 p-4 border-b border-border">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length > 0 ? (
                <div>
                  {notifications.map(notification => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications found
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="unread">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="flex items-start gap-3 p-4 border-b border-border">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : unreadNotifications.length > 0 ? (
                <div>
                  {unreadNotifications.map(notification => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No unread notifications
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="read">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="flex items-start gap-3 p-4 border-b border-border">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : readNotifications.length > 0 ? (
                <div>
                  {readNotifications.map(notification => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No read notifications
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPage;