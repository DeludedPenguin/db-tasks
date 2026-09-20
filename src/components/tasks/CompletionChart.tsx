import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CompletionChartProps {
  tasks: { completed_at: string | null }[];
}

type RangeKey = "14d" | "all";

export default function CompletionChart({ tasks }: CompletionChartProps) {
  const [range, setRange] = useState<RangeKey>("14d");

  const dailyData = useMemo(() => {
    const days = 14;
    const counts: Record<string, number> = {};
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const key = format(subDays(today, i), "yyyy-MM-dd");
      counts[key] = 0;
    }

    for (const t of tasks) {
      if (!t.completed_at) continue;
      const key = format(parseISO(t.completed_at), "yyyy-MM-dd");
      if (key in counts) counts[key]++;
    }

    return Object.entries(counts).map(([date, count]) => ({
      date: format(parseISO(date), "MMM d"),
      count,
    }));
  }, [tasks]);

  const monthlyData = useMemo(() => {
    const completed = tasks.filter((t) => t.completed_at);
    if (completed.length === 0) return [];

    const counts: Record<string, number> = {};
    for (const t of completed) {
      const key = format(parseISO(t.completed_at!), "yyyy-MM");
      counts[key] = (counts[key] ?? 0) + 1;
    }

    const months = Object.keys(counts).sort();
    const [firstYear, firstMonth] = months[0].split("-").map(Number);
    const cursor = new Date(firstYear, firstMonth - 1, 1);
    const end = new Date();
    const filled: Record<string, number> = {};
    while (cursor <= end) {
      const key = format(cursor, "yyyy-MM");
      filled[key] = counts[key] ?? 0;
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return Object.entries(filled).map(([month, count]) => ({
      date: format(parseISO(`${month}-01`), "MMM yyyy"),
      count,
    }));
  }, [tasks]);

  const data = range === "14d" ? dailyData : monthlyData;
  const total = data.reduce((s, d) => s + d.count, 0);

  if (dailyData.reduce((s, d) => s + d.count, 0) === 0 && monthlyData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-col items-start justify-between gap-2 space-y-0 pb-2 sm:flex-row sm:items-center">
        <CardTitle className="text-base font-medium">
          Completed — {range === "14d" ? "last 14 days" : "all time"}
          <span className="ml-2 text-sm font-normal text-muted-foreground">({total} total)</span>
        </CardTitle>
        <div className="flex items-center gap-1">
          {(["14d", "all"] as const).map((key) => (
            <Button
              key={key}
              variant={range === key ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7 px-2 text-xs")}
              onClick={() => setRange(key)}
            >
              {key === "14d" ? "14 Days" : "All Time"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(210 12% 58%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "hsl(210 12% 58%)" }}
              axisLine={false}
              tickLine={false}
              width={24}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(210 25% 20%)",
                border: "1px solid hsl(210 18% 32%)",
                borderRadius: 8,
                color: "hsl(210 20% 90%)",
                fontSize: 13,
              }}
            />
            <Bar dataKey="count" fill="hsl(204 70% 53%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
