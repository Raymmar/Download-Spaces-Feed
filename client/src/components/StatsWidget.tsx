import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react";

// Parse CSV data
const csvData = `
Date,users
9/8/24,0
9/9/24,1
9/10/24,1
9/11/24,9
9/12/24,25
9/13/24,42
9/14/24,75
9/15/24,103
9/16/24,124
9/17/24,151
9/18/24,174
9/19/24,199
9/20/24,218
9/21/24,234
9/22/24,261
9/23/24,290
9/24/24,306
9/25/24,336
9/26/24,353
9/27/24,358
9/28/24,361
9/29/24,376
9/30/24,387
10/1/24,405
10/2/24,425
10/3/24,445
10/4/24,466
10/5/24,476
10/6/24,486
10/7/24,506
10/8/24,524
10/9/24,533
10/10/24,551
10/11/24,558
10/12/24,585
10/13/24,617
10/14/24,636
10/15/24,649
10/16/24,677
10/17/24,706
10/18/24,741
10/19/24,755
10/20/24,778
10/21/24,788
10/22/24,809
10/23/24,824
10/24/24,848
10/25/24,868
10/26/24,891
10/27/24,900
10/28/24,930
10/29/24,956
10/30/24,972
10/31/24,983
11/1/24,1004
11/2/24,1035
11/3/24,1047
11/4/24,1076
11/5/24,1083
11/6/24,1114
11/7/24,1127
11/8/24,1147
11/9/24,1174
11/10/24,1214
11/11/24,1238
11/12/24,1279
11/13/24,1301
11/14/24,1310
11/15/24,1335
11/16/24,1361
11/17/24,1404
11/18/24,1413
11/19/24,1450
11/20/24,1475
11/21/24,1508
11/22/24,1531
11/23/24,1555
11/24/24,1566
11/25/24,1591
11/26/24,1624
11/27/24,1656
11/28/24,1676
11/29/24,1713
11/30/24,1738
12/1/24,1749
12/2/24,1777
12/3/24,1794
12/4/24,1836
12/5/24,1884
12/6/24,1902
12/7/24,1917
12/8/24,1948
12/9/24,1998
12/10/24,2007
12/11/24,2030
12/12/24,2053
12/13/24,2061
12/14/24,2084
12/15/24,2114
12/16/24,2136
12/17/24,2146
12/18/24,2168
12/19/24,2183
12/20/24,2215
12/21/24,2226
12/22/24,2255
12/23/24,2279
12/24/24,2290
12/25/24,2303
12/26/24,2299
12/27/24,2314
12/28/24,2332
12/29/24,2339
12/30/24,2373
12/31/24,2388
1/1/25,2394
1/2/25,2411
1/3/25,2442
1/4/25,2499
1/5/25,2538
1/6/25,2605
1/7/25,2641
1/8/25,2665
1/9/25,2721
1/10/25,2741
1/11/25,2765
1/12/25,2779
1/13/25,2820
1/14/25,2824
1/15/25,2827
1/16/25,2870
1/17/25,2901
1/18/25,2934
1/19/25,2956
1/20/25,2970
1/21/25,2984
1/22/25,3010
1/23/25,3030
1/24/25,3028
1/25/25,3059
1/26/25,3070
1/27/25,3098
1/28/25,3121
1/29/25,3128
1/30/25,3132
1/31/25,3137
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
  date: string;
  users: number;
};

// Parse CSV data into chart format
const chartData: ChartDataPoint[] = csvData
  .split("\n")
  .slice(1)
  .map((line: string) => {
    const [date, users] = line.split(",");
    const parsedDate = new Date(date);
    return {
      date: parsedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      users: parseInt(users) || 0,
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
  
  const { data: webhookStats, isLoading: statsLoading } = useQuery<WebhookStats>({
    queryKey: ["/api/webhooks/stats", Date.now()], // Add cache-busting timestamp
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    onSuccess: (data) => {
      console.log("Stats data received:", data); // Debug the response
    }
  });

  return (
    <div className="space-y-4">
      <Card className="mt-4">
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            This website displays a live activity feed from the{" "}
            <a href="https://chromewebstore.google.com/detail/download-twitter-spaces/hjgpigfbmdlajibmebhndhjiiohodgfi">
              Download Twitter Spaces{" "}
            </a>{" "}
            Chrome Extension.
          </p>
          {/* <Button variant="default">
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.003h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.366zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
            </svg>
            Install Extension
          </Button> */}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
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
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="users"
                  fill="#9C64FB"
                  fillOpacity={0.2}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </AreaChart>
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
      
      {/* New time-based stat cards */}
      
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {statsLoading ? "This Month" : webhookStats?.month.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold">
              {statsLoading ? "Loading..." : webhookStats?.month.count.toLocaleString()}
            </div>
            <div className="mt-1">
              <p className="text-xs text-muted-foreground">
                {statsLoading ? "vs previous month:" : webhookStats?.month.comparisonLabel + ":"}
              </p>
              {statsLoading ? (
                <span className="text-xs">Loading...</span>
              ) : (
                <div className="flex items-center text-sm mt-1">
                  <span className="mr-2">{webhookStats?.month.previous.toLocaleString()}</span>
                  <ChangeIndicator change={webhookStats?.month.change || null} />
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
              {statsLoading ? "Loading..." : webhookStats?.week.count.toLocaleString()}
            </div>
            <div className="mt-1">
              <p className="text-xs text-muted-foreground">
                {statsLoading ? "vs previous week:" : webhookStats?.week.comparisonLabel + ":"}
              </p>
              {statsLoading ? (
                <span className="text-xs">Loading...</span>
              ) : (
                <div className="flex items-center text-sm mt-1">
                  <span className="mr-2">{webhookStats?.week.previous.toLocaleString()}</span>
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
              {statsLoading ? "Loading..." : webhookStats?.today.count.toLocaleString()}
            </div>
            <div className="mt-1">
              <p className="text-xs text-muted-foreground">
                {statsLoading ? "vs yesterday:" : webhookStats?.today.comparisonLabel + ":"}
              </p>
              {statsLoading ? (
                <span className="text-xs">Loading...</span>
              ) : (
                <div className="flex items-center text-sm mt-1">
                  <span className="mr-2">{webhookStats?.today.previous.toLocaleString()}</span>
                  <ChangeIndicator change={webhookStats?.today.change || null} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
