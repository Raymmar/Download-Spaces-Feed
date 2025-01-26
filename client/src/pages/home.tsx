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
  
  const { data, isLoading } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });

  useEffect(() => {
    if (data) {
      setWebhooks(data);
    }
  }, [data]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    
    events.onmessage = (event) => {
      const webhook = JSON.parse(event.data);
      setWebhooks(prev => [webhook, ...prev]);
    };

    return () => events.close();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Webhook Feed</h1>
          <Link href="/docs">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              API Docs
            </Button>
          </Link>
        </div>

        <ScrollArea className="h-[calc(100vh-8rem)] rounded-lg border">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium text-primary">
                        {webhook.spaceName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(webhook.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p>{`${webhook.city}, ${webhook.region}, ${webhook.country}`}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">User ID</p>
                        <p className="font-mono">{webhook.userId}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Links</p>
                        <div className="flex gap-2">
                          <a
                            href={webhook.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Tweet
                          </a>
                          <a
                            href={webhook.playlistUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Playlist
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
