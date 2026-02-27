

## Plan: Three Improvements

### 1. Fix Focus Timer Drift

**Problem:** The timer uses `setInterval` with a 1-second tick, but browsers throttle intervals in background tabs (sometimes to once per minute). After 15 real minutes in the background, only a few ticks may have fired.

**Fix:** Instead of decrementing a counter each tick, store the real start timestamp and calculate remaining time from `Date.now()` on each tick. This way, even if ticks are throttled, when the tab regains focus the timer immediately shows the correct time.

**Changes to `src/pages/TimerPage.tsx`:**
- Store a `targetEndTime` ref (set when starting: `Date.now() + remaining * 1000`)
- On each interval tick, calculate `remaining = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000))`
- Add a `visibilitychange` listener to immediately recalculate when the tab becomes visible again
- On pause, store the current remaining and clear targetEndTime; on resume, set a new targetEndTime from the stored remaining

### 2. Date Filters on the Task List

Add a date filter control next to the existing tag filter and sort controls on the main Tasks page. Options:

- **All** (default, current behaviour)
- **Due today** -- tasks with `due_date` equal to today
- **Overdue + today** -- tasks with `due_date` on or before today
- **Upcoming** -- tasks with `due_date` after today

**Changes:**
- Create `src/components/tasks/DateFilter.tsx` -- a small button group or dropdown (similar style to `SortControls`)
- Update `src/pages/Index.tsx` to add a `dateFilter` state and apply it in the filtering `useMemo`, comparing against today's date using `date-fns`

### 3. Import from App's Own Export Format

Currently the Import page only supports Super Productivity CSVs. We'll add a second importer that recognises the app's own export format (active tasks, completed tasks, and focus log CSVs).

**Detection logic:** Check CSV headers to auto-detect format:
- If headers match `name,priority,project,do_date,due_date,notes,created_at` -- active tasks export
- If headers match `name,priority,project,completed_at,notes,created_at` -- completed tasks export
- If headers match `date,planned_minutes,actual_minutes,task,notes,start_time,end_time` -- focus log export
- If headers include `title` and `project_title` -- Super Productivity format (existing)

**Changes to `src/lib/csv.ts`:**
- Add a `detectCSVFormat()` function that inspects headers
- Add `mapNativeTaskCSV()` and `mapNativeFocusLogCSV()` mapping functions

**Changes to `src/pages/ImportExport.tsx`:**
- Replace the "Import from Super Productivity" heading with a generic "Import" section
- On file upload, auto-detect the format and show the appropriate preview
- For task imports (active or completed), reuse the existing project-matching and task insertion logic
- For focus log imports, insert into `focus_sessions` with the same project/task matching where possible
- Show the detected format in the preview ("Detected: Active Tasks Export", etc.)

### Technical Details

**Timer fix (core logic):**
```text
targetEndRef = useRef<number>(0)

handleStart:
  targetEndRef.current = Date.now() + remaining * 1000

interval tick:
  remaining = Math.ceil((targetEndRef - Date.now()) / 1000)
  if remaining <= 0 -> done

visibilitychange listener:
  if document becomes visible and state === running -> recalculate immediately
```

**Date filter options:**
```text
"all" | "today" | "overdue" | "upcoming"
```

Filtering uses `date-fns/format` to compare `task.due_date` against today's date string (YYYY-MM-DD).

