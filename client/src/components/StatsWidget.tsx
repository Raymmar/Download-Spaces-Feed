import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Legend,
  ComposedChart,
  Bar,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define types for our data models
type ChartDataPoint = {
  date: string;      // Display date (e.g., "Mar 18")
  dateKey: string;   // Standardized date key for lookups (e.g., "3-18")
  users: number;     // User count for this date
  downloads: number; // Download count for this date
};

type ActiveUserResponse = {
  date: string;      // Date from DB in ISO format (e.g., "2025-02-01")
  userCount: number; // User count for this date
};

// Create a date key formatter to standardize date formats across datasets
const formatDateKey = (date: Date): string => {
  return `${date.getMonth()+1}-${date.getDate()}`; // Format as "M-D" (e.g., "3-18")
};

// Define the type for our stats response
type WebhookStats = {
  total: number;
  today: {
    count: number;
    previous: number;
    change: number | null;
    label: string;
    comparisonLabel: string;
  };
  week: {
    count: number;
    previous: number;
    change: number | null;
    label: string;
    comparisonLabel: string;
  };
  month: {
    count: number;
    previous: number;
    change: number | null;
    label: string;
    comparisonLabel: string;
  };
  rolling?: {
    last7days: {
      count: number;
      dailyAverage: number;
      previousAverage: number;
      change: number | null;
      label: string;
      comparisonLabel: string;
    };
    last30days: {
      count: number;
      dailyAverage: number;
      previousAverage: number;
      change: number | null;
      label: string;
      comparisonLabel: string;
    };
  };
};

// Component to display change indicator
function ChangeIndicator({ change }: { change: number | null }) {
  if (change === null) {
    return <MinusIcon className="h-4 w-4 text-gray-500" />;
  }

  if (change > 0) {
    return (
      <div className="flex items-center text-green-500 whitespace-nowrap">
        <ArrowUpIcon className="mr-1 h-4 w-4 flex-shrink-0" />
        <span>+{change.toFixed(1)}%</span>
      </div>
    );
  } else if (change < 0) {
    return (
      <div className="flex items-center text-red-500 whitespace-nowrap">
        <ArrowDownIcon className="mr-1 h-4 w-4 flex-shrink-0" />
        <span>{change.toFixed(1)}%</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center text-gray-500 whitespace-nowrap">
        <MinusIcon className="mr-1 h-4 w-4 flex-shrink-0" />
        <span>0%</span>
      </div>
    );
  }
}

export function StatsWidget() {
  
  const { data: webhookCount } = useQuery<number>({
    queryKey: ["/api/webhooks/count"],
  });

  const { data: webhookStats, isLoading: statsLoading } =
    useQuery<WebhookStats>({
      queryKey: ["/api/webhooks/stats"],
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchInterval: 10000, // Refetch every 10 seconds
      staleTime: 0, // Consider data stale immediately
    });

  // Fetch daily download data from the API
  const { data: dailyDownloads } = useQuery<{ date: string; downloads: string; }[]>({
    queryKey: ["/api/webhooks/daily"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  // Fetch active user data from our new API endpoint
  const { data: activeUserData, isLoading: usersLoading } = useQuery<ActiveUserResponse[]>({
    queryKey: ["/api/users/active"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  // Convert API data into chart-compatible format
  const chartData: ChartDataPoint[] = (activeUserData || []).map((item) => {
    // Parse the API date (format: 2025-02-01)
    const parsedDate = new Date(item.date);
    
    // Create a standardized date display format for the chart
    const displayDate = parsedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    
    // Create a standard date key for lookup between datasets
    const dateKey = formatDateKey(parsedDate);
    
    return {
      date: displayDate, // For display (e.g., "Mar 18")
      dateKey,           // For internal matching (e.g., "3-18")
      users: item.userCount,
      downloads: 0,      // Default to 0 downloads
    };
  }).filter(data => data.users > 0);
  
  // Process chart data by adding download information from real database data
  const processedChartData = (chartData.length > 0) 
    ? [...chartData].map(point => ({
        ...point, // This will copy all properties including dateKey
        downloads: 0 // Default to 0 downloads
      }))
    : [];
  
  // Add real download data directly from the API
  if (dailyDownloads?.length) {
    console.log("Daily downloads data:", dailyDownloads);
    
    // Create a date map for quick lookup from the API data using our standardized key format
    const downloadMap = new Map<string, number>();
    
    // Process the API download data
    dailyDownloads.forEach(item => {
      try {
        // Parse the API date (format: 2025-03-18)
        const apiDate = new Date(item.date);
        if (isNaN(apiDate.getTime())) {
          console.warn(`Invalid date format in download data: ${item.date}`);
          return;
        }
        
        // Create standardized date key (same format for both datasets)
        const dateKey = formatDateKey(apiDate);
        
        const downloads = parseInt(item.downloads, 10);
        
        // If we already have a value for this date key, add to it
        const existingValue = downloadMap.get(dateKey) || 0;
        downloadMap.set(dateKey, existingValue + downloads);
      } catch (error) {
        console.error(`Error processing download data entry:`, item, error);
      }
    });
    
    // Apply the real download data using our standardized dateKey
    processedChartData.forEach((point, index) => {
      const downloadCount = downloadMap.get(point.dateKey);
      if (downloadCount !== undefined) {
        processedChartData[index].downloads = downloadCount;
      }
    });
    
    console.log("Processed chart data with real downloads:", processedChartData);
    
    // Log matches/mismatches for debugging
    const downloadKeys: string[] = [];
    downloadMap.forEach((_, key) => downloadKeys.push(key));
    
    console.log("Download date keys available:", downloadKeys);
    console.log("Chart date keys:", processedChartData.map(p => p.dateKey));
    
    // Log matches between the two datasets
    const matchCount = processedChartData.filter(p => downloadMap.has(p.dateKey)).length;
    console.log(`Matched ${matchCount} out of ${processedChartData.length} dates with download data`);
  }
  
  return (
    <div className="space-y-4">
      <Card className="mt-4">
        <CardContent className="p-6">
          <p className="text-muted-foreground pb-4">
            This website displays live activity from the{" "}
            <a href="https://chromewebstore.google.com/detail/download-twitter-spaces/hjgpigfbmdlajibmebhndhjiiohodgfi">
              Download Twitter Spaces{" "}
            </a>{" "}
            Chrome Extension.
          </p>
          {
            <Button variant="default">
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.003h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.366zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
              </svg>
              Install Extension
            </Button>
          }
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Active Users & Downloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processedChartData}>
                <XAxis
                  dataKey="date"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={30}
                  tickFormatter={(value) => value.split(" ")[0]}
                />
                <YAxis
                  yAxisId="left"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value.toLocaleString()}
                  domain={[0, 'dataMax + 30']}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px' }}
                  formatter={(value, name) => [value.toLocaleString(), name]}
                />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="users"
                  fill="#9C64FB"
                  fillOpacity={0.2}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Active Users"
                />
                <Bar
                  yAxisId="right"
                  dataKey="downloads"
                  fill="#10b981"
                  maxBarSize={40}
                  opacity={0.9}
                  name="Spaces Downloaded"
                  radius={[4, 4, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Active Installs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {processedChartData.length > 0 
                ? processedChartData[processedChartData.length - 1]?.users.toLocaleString()
                : "Loading..."}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Spaces Downloaded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {Number(webhookCount).toLocaleString("en-US") ?? "Loading..."}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All stats cards shown together */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Growth Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rolling stats - displayed first */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {!webhookStats?.rolling ? (
              <div className="col-span-2 text-center py-4">
                <p className="text-muted-foreground">Loading rolling stats...</p>
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {webhookStats.rolling.last7days.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="text-2xl font-bold">
                      {webhookStats.rolling.last7days.count.toLocaleString()}
                    </div>
                    <div className="mt-1">
                      <p className="text-xs text-muted-foreground">
                        {webhookStats.rolling.last7days.comparisonLabel}:
                      </p>
                      <div className="flex items-center text-sm mt-1">
                        <span className="mr-2">
                          {(webhookStats.rolling.last7days.dailyAverage * 7).toLocaleString()} vs {(webhookStats.rolling.last7days.previousAverage * 7).toLocaleString()}
                        </span>
                        <ChangeIndicator
                          change={webhookStats.rolling.last7days.change || null}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Daily Average:
                      </p>
                      <div className="flex items-center text-sm mt-1">
                        <span className="mr-2">
                          {webhookStats.rolling.last7days.dailyAverage.toLocaleString()} vs {webhookStats.rolling.last7days.previousAverage.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {webhookStats.rolling.last30days.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="text-2xl font-bold">
                      {webhookStats.rolling.last30days.count.toLocaleString()}
                    </div>
                    <div className="mt-1">
                      <p className="text-xs text-muted-foreground">
                        {webhookStats.rolling.last30days.comparisonLabel}:
                      </p>
                      <div className="flex items-center text-sm mt-1">
                        <span className="mr-2">
                          {(webhookStats.rolling.last30days.dailyAverage * 30).toLocaleString()} vs {(webhookStats.rolling.last30days.previousAverage * 30).toLocaleString()}
                        </span>
                        <ChangeIndicator
                          change={webhookStats.rolling.last30days.change || null}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Daily Average:
                      </p>
                      <div className="flex items-center text-sm mt-1">
                        <span className="mr-2">
                          {webhookStats.rolling.last30days.dailyAverage.toLocaleString()} vs {webhookStats.rolling.last30days.previousAverage.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
            
          {/* Period comparison stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {statsLoading ? "This Month" : webhookStats?.month.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-bold">
                  {statsLoading
                    ? "Loading..."
                    : webhookStats?.month.count.toLocaleString()}
                </div>
                <div className="mt-1">
                  <p className="text-xs text-muted-foreground">
                    {statsLoading
                      ? "vs previous month:"
                      : webhookStats?.month.comparisonLabel + ":"}
                  </p>
                  {statsLoading ? (
                    <span className="text-xs">Loading...</span>
                  ) : (
                    <div className="flex items-center text-sm mt-1">
                      <span className="mr-2">
                        {webhookStats?.month.previous.toLocaleString()}
                      </span>
                      <ChangeIndicator
                        change={webhookStats?.month.change || null}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {statsLoading ? "This Week" : webhookStats?.week.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-bold">
                  {statsLoading
                    ? "Loading..."
                    : webhookStats?.week.count.toLocaleString()}
                </div>
                <div className="mt-1">
                  <p className="text-xs text-muted-foreground">
                    {statsLoading
                      ? "vs previous week:"
                      : webhookStats?.week.comparisonLabel + ":"}
                  </p>
                  {statsLoading ? (
                    <span className="text-xs">Loading...</span>
                  ) : (
                    <div className="flex items-center text-sm mt-1">
                      <span className="mr-2">
                        {webhookStats?.week.previous.toLocaleString()}
                      </span>
                      <ChangeIndicator change={webhookStats?.week.change || null} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {statsLoading ? "Today" : webhookStats?.today.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-bold">
                  {statsLoading
                    ? "Loading..."
                    : webhookStats?.today.count.toLocaleString()}
                </div>
                <div className="mt-1">
                  <p className="text-xs text-muted-foreground">
                    {statsLoading
                      ? "vs yesterday:"
                      : webhookStats?.today.comparisonLabel + ":"}
                  </p>
                  {statsLoading ? (
                    <span className="text-xs">Loading...</span>
                  ) : (
                    <div className="flex items-center text-sm mt-1">
                      <span className="mr-2">
                        {webhookStats?.today.previous.toLocaleString()}
                      </span>
                      <ChangeIndicator
                        change={webhookStats?.today.change || null}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
