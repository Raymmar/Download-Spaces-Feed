import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import type { Webhook } from "@/types/webhook";

export default function Home() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);

  const { data, isLoading, refetch } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });

  // Update webhooks when data changes
  useEffect(() => {
    if (data) {
      setWebhooks(data);
    }
  }, [data]);

  // Set up SSE and refetch on mount to ensure we have latest data
  useEffect(() => {
    // Refetch on mount to ensure we have latest data
    refetch();

    const events = new EventSource("/api/events");

    events.onmessage = (event) => {
      const webhook = JSON.parse(event.data);
      setWebhooks(prev => [webhook, ...prev]);
    };

    events.onerror = (error) => {
      console.error("SSE Error:", error);
      events.close();
    };

    return () => {
      events.close();
    };
  }, [refetch]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Spaces Feed</h1>
          <div className="flex gap-2">
            <a href="https://chromewebstore.google.com/detail/download-twitter-spaces/hjgpigfbmdlajibmebhndhjiiohodgfi" target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.003h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.366zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"/>
                </svg>
                Download on Chrome
              </Button>
            </a>
            <Link href="/docs">
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                What is this?
              </Button>
            </Link>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-8rem)] rounded-lg border">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No webhooks received yet.
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2 mb-2">
                      <span className="text-sm text-muted-foreground">
                        {new Date(webhook.createdAt).toLocaleString()}
                      </span>
                      <span className="font-medium text-primary">
                        {webhook.spaceName}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p>{`${webhook.city}, ${webhook.region}, ${webhook.country}`}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Extension ID</p>
                        <p className="font-mono">{webhook.userId}</p>
                      </div>
                      <div className="col-span-2">
                        <div className="flex gap-2">
                          <a
                            href={webhook.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View on X
                          </a>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}