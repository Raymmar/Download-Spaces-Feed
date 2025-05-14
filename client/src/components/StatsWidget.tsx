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

// Parse CSV data
const csvData = `
Date,users
2/1/25,3152
2/2/25,3187
2/3/25,3245
2/4/25,3291
2/5/25,3328
2/6/25,3346
2/7/25,3396
2/8/25,3418
2/9/25,3418
2/10/25,3439
2/11/25,3475
2/12/25,3486
2/13/25,3498
2/14/25,3496
2/15/25,3491
2/16/25,3480
2/17/25,3485
2/18/25,3493
2/19/25,3495
2/20/25,3506
2/21/25,3523
2/22/25,3540
2/23/25,3573
2/24/25,3608
2/25/25,3622
2/26/25,3631
2/27/25,3654
2/28/25,3656
3/1/25,3668
3/2/25,3673
3/3/25,3697
3/4/25,3703
3/5/25,3725
3/6/25,3705
3/7/25,3711
3/8/25,3723
3/9/25,3723
3/10/25,3757
3/11/25,3776
3/12/25,3817
3/13/25,3830
3/14/25,3842
3/15/25,3872
3/16/25,3896
3/17/25,3914
3/21/25,3951
3/22/25,3961
3/23/25,3967
3/24/25,3997
3/25/25,4000
3/26/25,4000
3/27/25,3993
3/28/25,3981
3/29/25,4008
3/30/25,4039
3/31/25,4028
4/1/25,4034
4/2/25,4048
4/3/25,4061
4/4/25,4055
4/5/25,4066
4/6/25,4105
4/7/25,4120
4/8/25,4124
4/9/25,4132
4/10/25,4149
4/11/25,4183
4/12/25,4212
4/13/25,4218
4/14/25,4242
4/15/25,4246
4/16/25,4238
4/17/25,4237
4/18/25,4232
4/19/25,4254
4/20/25,4245
4/21/25,4249
4/22/25,4252
4/23/25,4279
4/24/25,4285
4/25/25,4298
4/26/25,4307
4/27/25,4335
4/28/25,4348
4/29/25,4380
4/30/25,4380
5/1/25,4377
5/2/25,4372
5/3/25,4378
5/4/25,4385
5/5/25,4398
5/6/25,4411
5/7/25,4418
5/8/25,4418
5/9/25,4424
5/10/25,4445
5/11/25,4467
5/12/25,4485
5/13/25,4505
`;

type ChartDataPoint = {
  date: string;      // Display date (e.g., "Mar 18")
  dateKey: string;   // Standardized date key for lookups (e.g., "3-18")
  users: number;     // User count for this date
  downloads: number; // Download count for this date
};

// Parse CSV data into chart format
// Create a date key formatter to standardize date formats across datasets
const formatDateKey = (date: Date): string => {
  return `${date.getMonth()+1}-${date.getDate()}`; // Format as "M-D" (e.g., "3-18")
};

// Parse the CSV data for user statistics
const chartData: ChartDataPoint[] = csvData
  .split("\n")
  .slice(1)
  .map((line: string) => {
    const [date, users] = line.split(",");
    const parsedDate = new Date(date);
    
    // Create a standardized date display format for the chart
    const displayDate = parsedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    
    // Create a standard date key for lookup between datasets
    const dateKey = formatDateKey(parsedDate);
    
    return {
      date: displayDate, // For display (e.g., "Mar 18")
      dateKey, // For internal matching (e.g., "3-18")
      users: parseInt(users) || 0,
      // Default downloads to 0
      downloads: 0,
    };
  })
  .filter((data: ChartDataPoint) => data.users > 0);

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
  
  // Process chart data by adding download information from real database data
  const processedChartData = [...chartData].map(point => ({
    ...point, // This will copy all properties including dateKey
    downloads: 0 // Default to 0 downloads
  }));
  
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
    const downloadKeys = [];
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
              {chartData[chartData.length - 1]?.users.toLocaleString()}
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
