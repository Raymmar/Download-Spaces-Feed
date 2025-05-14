import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";
import type { Webhook } from "@/types/webhook";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Tweet } from "react-tweet";
import { StatsWidget } from "@/components/StatsWidget";

dayjs.extend(relativeTime);

export default function Home() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<Webhook[]>({
    queryKey: [
      "/api/webhooks",
      selectedUserId ? `?userId=${selectedUserId}` : "",
    ],
  });

  useEffect(() => {
    if (data) {
      const filteredWebhooks = selectedUserId
        ? data.filter((webhook) => webhook.userId === selectedUserId)
        : data;
      setWebhooks(filteredWebhooks.slice(0, 200));
    }
  }, [data, selectedUserId]);

  useEffect(() => {
    refetch();

    const events = new EventSource("/api/events");

    events.onmessage = (event) => {
      const webhook = JSON.parse(event.data);
      setWebhooks((prev) => {
        if (!selectedUserId || webhook.userId === selectedUserId) {
          return [webhook, ...prev.slice(0, 199)];
        }
        return prev;
      });
    };

    events.onerror = (error) => {
      console.error("SSE Error:", error);
      events.close();
    };

    return () => {
      events.close();
    };
  }, [refetch, selectedUserId]);

  const handleCopyUrl = async (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(url);
      toast({
        description: "Media URL copied to clipboard",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        description: "Failed to copy URL to clipboard",
      });
    }
  };

  const handleUserIdClick = (userId: string) => {
    setSelectedUserId(userId);
  };

  const clearFilter = () => {
    setSelectedUserId(null);
  };

  const getTweetId = (url: string) => {
    const matches = url.match(/status\/(\d+)/);
    return matches ? matches[1] : null;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-0 pt-0 pb-0">
      <nav className="w-full border-b px-4 py-4 fixed top-0 left-0 bg-background z-50">
        <div className="mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
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
            <h1 className="text-2xl font-bold whitespace-nowrap">Download Twitter Spaces</h1>
          </div>
          <div className="flex gap-2 w-full sm:w-auto items-center justify-center">
            <a href="https://raymmar.com" target="_blank">
              <Button className="border text-primary hover:bg-primary-50"
                variant="secondary">
                By Raymmar
              </Button>
            </a>
          </div>
        </div>
      </nav>
      <div className="max-w-[1200px] mx-auto mt-[120px] sm:mt-[72px] px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[600px_1fr] lg:[&>*:last-child]:order-none [&>*:last-child]:order-first">
          <ScrollArea>
            {selectedUserId && (
              <div className="pt-4 pr-4">
                <Card>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        EID history for:{" "}
                        <span className="font-mono font-bold">
                          {selectedUserId}
                        </span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearFilter}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
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
                          {(() => {
                            const date = dayjs(webhook.createdAt);
                            const now = dayjs();
                            const diffInDays = now.diff(date, "day");
                            return diffInDays > 2
                              ? date.format("MMM D, YYYY")
                              : date.fromNow();
                          })()}
                        </span>
                        {getTweetId(webhook.tweetUrl) && (
                          <Button
                            variant="outline"
                            asChild
                            size="sm"
                            className="gap-1 h-7 px-2 text-xs"
                          >
                            <a
                              href={webhook.tweetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                              </svg>
                              View
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Space Name:</span>{" "}
                          <span className="break-all">{webhook.spaceName}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Media Type:</span>{" "}
                          <span className="break-all">{webhook.mediaType}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">EID:</span>{" "}
                          <button
                            onClick={() => handleUserIdClick(webhook.userId)}
                            className="font-mono break-all text-primary hover:underline"
                          >
                            {webhook.userId}
                          </button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Media URL:</span>{" "}
                          <button
                            onClick={(e) =>
                              handleCopyUrl(webhook.mediaUrl, e)
                            }
                            className="text-primary hover:underline ml-1 font-mono break-words text-left w-full"
                          >
                            {webhook.mediaUrl}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col pt-2 gap-1">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Download from:
                          </p>
                          <p>{`${webhook.city}, ${webhook.country}`}</p>
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
              <div className="mt-4 text-center">
                <Link href="/privacy">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <Eye className="mr-2 h-4 w-4" />
                    Privacy Policy
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}