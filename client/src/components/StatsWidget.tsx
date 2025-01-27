import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";

// Parse CSV data
const csvData = `Date,Weekly users
8/1/24,0
8/2/24,0
8/3/24,0
8/4/24,0
8/5/24,0
8/6/24,0
8/7/24,0
8/8/24,0
8/9/24,0
8/10/24,0
8/11/24,0
8/12/24,0
8/13/24,0
8/14/24,0
8/15/24,0
8/16/24,0
8/17/24,0
8/18/24,0
8/19/24,0
8/20/24,0
8/21/24,0
8/22/24,0
8/23/24,0
8/24/24,0
8/25/24,0
8/26/24,0
8/27/24,0
8/28/24,0
8/29/24,0
8/30/24,0
8/31/24,0
9/1/24,0
9/2/24,0
9/3/24,0
9/4/24,0
9/5/24,0
9/6/24,0
9/7/24,0
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
1/26/25,3070`;

type ChartDataPoint = {
  date: string;
  users: number;
};

// Parse CSV data into chart format
const chartData: ChartDataPoint[] = csvData
  .split('\n')
  .slice(1)
  .map((line: string) => {
    const [date, users] = line.split(',');
    const parsedDate = new Date(date);
    return {
      date: parsedDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      }),
      users: parseInt(users) || 0
    };
  })
  .filter((data: ChartDataPoint) => data.users > 0);

export function StatsWidget() {
  const { data: webhookCount } = useQuery<number>({
    queryKey: ["/api/webhooks/count"],
  });

  return (
    <div className="space-y-4">
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
                  tickFormatter={(value) => value.split(' ')[0]}
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
            <CardTitle className="text-sm font-medium">Active Installs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {chartData[chartData.length - 1]?.users.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Spaces Downloaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {webhookCount?.toLocaleString() ?? "Loading..."}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}