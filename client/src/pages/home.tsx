import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import type { Webhook } from "@/types/webhook";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function Home() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);

  const { data, isLoading, refetch } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });

  useEffect(() => {
    if (data) {
      setWebhooks(data);
    }
  }, [data]);

  useEffect(() => {
    refetch();

    const events = new EventSource("/api/events");

    events.onmessage = (event) => {
      const webhook = JSON.parse(event.data);
      setWebhooks((prev) => [webhook, ...prev]);
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
    <div className="min-h-screen bg-gray-50 px-0 pb-0 pt-0">
      <nav className="fixed left-0 top-0 z-50 w-full border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 128 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M64.2814 0.566071C29.1359 0.566071 0.562988 29.139 0.562988 64.2845C0.562988 99.4189 29.1359 127.992 64.2814 127.992C99.4158 127.992 128 99.419 128 64.2734C127.989 29.139 99.4158 0.566071 64.2814 0.566071ZM91.5521 79.9681L68.3977 103.123C67.8655 103.655 67.2139 104.089 66.5079 104.382C65.7803 104.676 65.0309 104.828 64.2815 104.828C63.5322 104.828 62.7719 104.676 62.066 104.382C61.3492 104.089 60.7084 103.666 60.1763 103.123L37.0218 79.9681C34.7628 77.7091 34.7628 74.0383 37.0218 71.7793C39.2808 69.5204 42.9516 69.5204 45.2106 71.7793L58.482 85.0507V29.5313C58.482 26.3384 61.0776 23.7428 64.2705 23.7428C67.4634 23.7428 70.059 26.3384 70.059 29.5313V85.0619L83.3304 71.7905C85.5894 69.5315 89.2602 69.5315 91.5192 71.7905C93.7999 74.0386 93.8111 77.6983 91.5521 79.9681Z"
                fill="#9C64FB"
              />
            </svg>
            <h1 className="text-2xl font-bold">Webhook Receiver</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/docs">
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Documentation
              </Button>
            </Link>
          </div>
        </div>
      </nav>
      <div className="mx-auto mt-[72px] max-w-[700px]">
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
            <div className="space-y-4 p-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id} className="bg-white">
                  <CardContent className="p-4">
                    <div className="mb-2 flex flex-col gap-4">
                      <span className="text-sm text-muted-foreground">
                        {(() => {
                          const date = dayjs(webhook.createdAt);
                          const now = dayjs();
                          const diffInDays = now.diff(date, "day");
                          return diffInDays > 2
                            ? date.format("MMM D, YYYY")
                            : date.fromNow();
                        })()}
                      </span>
                      <pre className="whitespace-pre-wrap font-mono text-sm">
                        {JSON.stringify(webhook.payload, null, 2)}
                      </pre>
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