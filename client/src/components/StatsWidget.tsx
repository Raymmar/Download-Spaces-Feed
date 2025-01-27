import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";

// Parse CSV data
const csvData = `Date,Weekly users
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
1/25/25,3059`;

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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Weekly Active Users</CardTitle>
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
                  fill="hsl(var(--primary))"
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Installs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chartData[chartData.length - 1]?.users.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total active installations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Spaces Downloaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webhookCount?.toLocaleString() ?? "Loading..."}
            </div>
            <p className="text-xs text-muted-foreground">
              Total recordings saved
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}