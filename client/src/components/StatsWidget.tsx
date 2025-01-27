import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

// Import CSV data
const csv = await fetch('/attached_assets/Weekly users 180 days.csv').then(res => res.text());

type ChartDataPoint = {
  date: string;
  users: number;
};

// Parse CSV data into chart format
const chartData: ChartDataPoint[] = csv
  .split('\n')
  .slice(1)  // Skip header row
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
  .filter((data: ChartDataPoint) => data.users > 0); // Remove entries with 0 users

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
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), "Users"]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  fill="#9C64FB"
                  fillOpacity={0.2}
                  stroke="#9C64FB"
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
              Total active installations. Chart updated weekly.
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
              Twitter Spaces downloaded since Jan 25, 2025
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}