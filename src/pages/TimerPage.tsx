import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useCreateFocusSession } from "@/hooks/useFocusSessions";
import { toast } from "sonner";

const PRESETS = [10, 25, 30] as const;

type TimerState = "idle" | "running" | "paused" | "done";

export default function TimerPage() {
  const [planned, setPlanned] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [state, setState] = useState<TimerState>("idle");
  const [taskId, setTaskId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const startTimeRef = useRef<string | null>(null);
  const targetEndRef = useRef<number>(0);

  const { data: tasks } = useTasks(false);
  const createSession = useCreateFocusSession();

  const totalSeconds = planned * 60;
  const elapsed = totalSeconds - remaining;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;

  // Color progression: primary → yellow → destructive
  const getTimerColor = () => {
    if (state === "done") return "hsl(var(--destructive))";
    if (progress < 0.6) return "hsl(var(--priority-low))";
    if (progress < 0.85) return "hsl(var(--priority-medium))";
    return "hsl(var(--priority-high))";
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const recalcRemaining = useCallback(() => {
    if (targetEndRef.current <= 0) return;
    const now = Date.now();
    const diff = Math.max(0, Math.ceil((targetEndRef.current - now) / 1000));
    if (diff <= 0) {
      setRemaining(0);
      setState("done");
    } else {
      setRemaining(diff);
    }
  }, []);

  // Interval tick — uses wall clock, immune to background throttling
  useEffect(() => {
    if (state !== "running") return;
    const interval = setInterval(recalcRemaining, 1000);
    return () => clearInterval(interval);
  }, [state, recalcRemaining]);

  // Recalculate immediately when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && state === "running") {
        recalcRemaining();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state, recalcRemaining]);

  const handleStart = () => {
    if (state === "idle") {
      startTimeRef.current = new Date().toISOString();
      const secs = planned * 60;
      setRemaining(secs);
      targetEndRef.current = Date.now() + secs * 1000;
    } else if (state === "paused") {
      // Resume: set new target from current remaining
      targetEndRef.current = Date.now() + remaining * 1000;
    }
    setState("running");
  };

  const handlePause = () => setState("paused");

  const handleReset = () => {
    setState("idle");
    setRemaining(planned * 60);
    setNotes("");
    startTimeRef.current = null;
    targetEndRef.current = 0;
  };

  const handleSave = useCallback(async () => {
    const actualMinutes = Math.round(elapsed / 60);
    await createSession.mutateAsync({
      planned_minutes: planned,
      actual_minutes: actualMinutes,
      start_time: startTimeRef.current!,
      end_time: new Date().toISOString(),
      task_id: taskId === "none" ? null : taskId,
      notes: notes.trim() || null,
    });
    toast.success("Focus session saved!");
    handleReset();
  }, [elapsed, planned, taskId, notes, createSession]);

  const selectPreset = (min: number) => {
    if (state !== "idle") return;
    setPlanned(min);
    setRemaining(min * 60);
  };

  // SVG circle progress
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">Focus Timer</h2>

      {/* Presets */}
      <div className="flex gap-2">
        {PRESETS.map((m) => (
          <Button
            key={m}
            variant={planned === m && state === "idle" ? "default" : "secondary"}
            size="sm"
            onClick={() => selectPreset(m)}
            disabled={state !== "idle"}
          >
            {m} min
          </Button>
        ))}
      </div>

      {/* Task selector */}
      <Select value={taskId} onValueChange={setTaskId} disabled={state !== "idle"}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Link to a task (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No task</SelectItem>
          {tasks?.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Timer ring */}
      <div className="relative flex items-center justify-center">
        <svg width={280} height={280} className="-rotate-90">
          <circle
            cx={140}
            cy={140}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={8}
          />
          <circle
            cx={140}
            cy={140}
            r={radius}
            fill="none"
            stroke={getTimerColor()}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className="font-mono text-5xl font-bold tracking-wider"
            style={{ color: getTimerColor() }}
          >
            {formatTime(remaining)}
          </span>
          <span className="mt-1 text-sm text-muted-foreground">
            {state === "done" ? "Complete!" : state === "paused" ? "Paused" : state === "running" ? "Focusing…" : "Ready"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {state === "done" ? (
          <Button variant="secondary" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
          </Button>
        ) : state === "running" ? (
          <Button variant="secondary" onClick={handlePause}>
            <Pause className="mr-1.5 h-4 w-4" /> Pause
          </Button>
        ) : (
          <Button onClick={handleStart}>
            <Play className="mr-1.5 h-4 w-4" /> {state === "paused" ? "Resume" : "Start"}
          </Button>
        )}
        {state !== "idle" && state !== "done" && (
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Completion form */}
      {state === "done" && (
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col gap-3 pt-6">
            <p className="text-sm font-medium text-foreground">Session complete — {Math.round(elapsed / 60)} min</p>
            <Textarea
              placeholder="Session notes (optional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <Button onClick={handleSave} disabled={createSession.isPending}>
              <Timer className="mr-1.5 h-4 w-4" /> Save Session
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
