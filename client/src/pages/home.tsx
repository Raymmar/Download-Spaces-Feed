import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Webhook } from "@/types/webhook";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { StatsWidget } from "@/components/StatsWidget";

dayjs.extend(relativeTime);

export default function Home() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });

  useEffect(() => {
    if (data) {
      setWebhooks(data.slice(0, 200));
    }
  }, [data]);

  useEffect(() => {
    refetch();

    const events = new EventSource("/api/events");

    events.onmessage = (event) => {
      const webhook = JSON.parse(event.data);
      setWebhooks((prev) => [webhook, ...prev.slice(0, 199)]);
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
    <div className="min-h-screen bg-gray-50 px-0 pt-0 pb-0">
      <nav className="w-full border-b px-4 py-4 fixed top-0 left-0 bg-background z-50">
        <div className="mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Webhook Receiver</h1>
          </div>
        </div>
      </nav>
      <div className="max-w-[1200px] mx-auto mt-[120px] sm:mt-[72px] px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[600px_1fr] lg:[&>*:last-child]:order-none [&>*:last-child]:order-first">
          <ScrollArea>
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
              <div className="space-y-4 pt-4 pr-4">
                {webhooks.map((webhook) => (
                  <Card key={webhook.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-muted-foreground">
                          {dayjs(webhook.createdAt).fromNow()}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">User ID:</span>{" "}
                          <span className="break-all">{webhook.userId}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Location:</span>{" "}
                          <span className="break-all">{`${webhook.city}, ${webhook.country}`}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
          <div>
            <div className="lg:sticky lg:top-[88px]">
              <StatsWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}