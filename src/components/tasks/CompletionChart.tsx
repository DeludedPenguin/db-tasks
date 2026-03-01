import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CompletionChartProps {
  tasks: { completed_at: string | null }[];
}

export default function CompletionChart({ tasks }: CompletionChartProps) {
  const data = useMemo(() => {
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

  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          Completed — last 14 days
          <span className="ml-2 text-sm font-normal text-muted-foreground">({total} total)</span>
        </CardTitle>
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
