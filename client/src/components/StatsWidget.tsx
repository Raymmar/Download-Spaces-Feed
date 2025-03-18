import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export function StatsWidget() {
  const { data: webhookCount, isLoading: isCountLoading } = useQuery<number>({
    queryKey: ["/api/webhooks/count"],
    // Refetch every 30 seconds
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Webhooks Received</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            {isCountLoading
              ? "Loading..."
              : webhookCount !== undefined
                ? Number(webhookCount).toLocaleString("en-US")
                : "Error"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}