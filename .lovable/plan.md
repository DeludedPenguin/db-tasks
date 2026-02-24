# DB_Tasks — Implementation Plan

## Overview

A personal productivity app for academic/creative workflows with integrated focus tracking, built on Supabase with a calm blue homelab aesthetic.

The app is named '**DB_Tasks**'

---

## Phase 1: Foundation & Data

### Supabase Setup

- **Auth**: Email/password login (single user, for security/admin control)
- **Database tables**: `projects` (id, name, color, created_at), `tasks` (id, name, completed, do_date, due_date, priority 0-3, project_id, notes, created_at, completed_at), `focus_sessions` (id, start_time, end_time, planned_minutes, actual_minutes, notes, task_id, date)
- **RLS policies**: All data scoped to the logged-in user

### Theme & Layout

- Dark blue-grey background (`#2c3e50`, `#34495e`) with calm card-based design
- Top navigation bar: **Tasks** | **Completed** | **Projects** | **Timer** | **Focus Log**
- Responsive grid layouts for all screen sizes

---

## Phase 2: Task Management

### Main Dashboard (`/`)

- List of active (incomplete) tasks showing project tag (color-coded), priority badge (green/yellow/red), do date, and due date
- Inline "new task" form with project dropdown, priority selector, do date & due date pickers
- Sort controls: by priority, project, do date, due date
- Multi-select checkboxes for bulk actions (complete, delete, change project/priority)
- Click task to edit in a slide-out panel or modal

### Completed Tasks (`/completed`)

- Archive view of completed tasks with completion dates
- Ability to uncomplete (restore), edit, or permanently delete

---

## Phase 3: Projects

### Projects Page (`/projects`)

- List all projects with their color swatch and task count
- Create new project with name + color picker
- Click a project to filter/view its tasks
- Edit or delete projects

---

## Phase 4: Focus Timer

### Timer Page (`/timer`)

- Session length buttons: 10 / 25 / 30 minutes
- Live countdown display with color progression (green → yellow → red)
- Optional task linking dropdown (associate session with a task)
- On completion: notes form appears, session saved to database
- If linked to a task, time is added to that task's record

### Focus Log (`/timer/log`)

- Chronological history of all focus sessions
- Shows date, duration, linked task (if any), and notes

---

## Phase 5: Import & Export

### One-off CSV Import

- Import page/modal to upload the attached Super Productivity CSV
- Auto-create projects from `project_title` column with auto-assigned colors
- Map fields: `title` → name, `due_day` → due date, `planned_at` → do date, `is_done` → completed, `time_estimate_ms` → stored as minutes, `notes` → notes
- Show preview before confirming import

### CSV Export

- Export buttons for: active tasks, completed tasks, and focus log
- Downloads as clean CSV files

---

## Data from CSV Import

The attached CSV contains ~49 tasks across ~15 projects (work_research, personal, home_stuff, work_engagement, health, workplanning, etc.). These will be imported with their projects auto-created and color-coded.