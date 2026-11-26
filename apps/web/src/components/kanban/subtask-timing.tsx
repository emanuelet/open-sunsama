import * as React from "react";
import { ChevronRight, Ellipsis, Pause, Play, Trash2 } from "lucide-react";
import type { Subtask } from "@open-sunsama/types";
import { cn, formatDuration } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DurationPicker } from "@/components/ui/duration-picker";
import { useUpdateSubtask } from "@/hooks/useSubtasks";
import {
  formatClock,
  isSingleClick,
  loggedSeconds,
  useSubtaskTimerToggle,
} from "@/hooks/useTaskTimerToggle";

/** Seconds logged, ticking once a second while the timer runs. */
function useLiveSeconds(subtask: Subtask) {
  const running = !!subtask.timerStartedAt;
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);
  return { running, seconds: loggedSeconds(subtask) };
}

function TimeField({
  value,
  label,
  subtaskTitle,
  onChange,
}: {
  value: number | null;
  label: string;
  subtaskTitle: string;
  onChange: (mins: number | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} time for ${subtaskTitle}: ${value ? formatDuration(value) : "none"}`}
          className={cn(
            "w-14 rounded px-1 text-right text-sm tabular-nums transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
            value ? "text-muted-foreground" : "text-muted-foreground/40"
          )}
        >
          {value ? formatDuration(value) : "--:--"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <DurationPicker
          value={value}
          label={label}
          onChange={(mins) => {
            onChange(mins);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

type TimeFieldLabel = "Actual" | "Planned";

function MobileSubtaskOptions({
  subtask,
  seconds,
  onSave,
  onDelete,
}: {
  subtask: Subtask;
  seconds: number;
  onSave: (field: TimeFieldLabel, value: number | null) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [field, setField] = React.useState<TimeFieldLabel | null>(null);
  const values = { Actual: subtask.actualMins, Planned: subtask.estimatedMins };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setField(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`More options for ${subtask.title}`}
          aria-description={
            subtask.estimatedMins
              ? `Planned time: ${formatDuration(subtask.estimatedMins)}`
              : undefined
          }
          className="flex h-11 min-w-12 items-center justify-end gap-1 rounded-md pr-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          {subtask.estimatedMins ? (
            <span className="text-[0.6875rem] tabular-nums">
              {formatDuration(subtask.estimatedMins)}
            </span>
          ) : null}
          <Ellipsis className="size-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-0 [&_button:focus-visible]:ring-1 [&_button:focus-visible]:ring-ring"
        aria-label="Subtask options"
      >
        {field ? (
          <DurationPicker
            label={field}
            value={values[field]}
            onClose={() => setOpen(false)}
            onChange={(value) => {
              onSave(field, value);
              setOpen(false);
            }}
          />
        ) : (
          <div className="w-52 p-1">
            {(["Actual", "Planned"] as const).map((label) => {
              const ticking = label === "Actual" && !!subtask.timerStartedAt;
              return (
                <button
                  type="button"
                  key={label}
                  disabled={ticking}
                  onClick={() => setField(label)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-sm enabled:hover:bg-accent disabled:text-muted-foreground"
                >
                  {label} time
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {ticking
                      ? formatClock(seconds)
                      : values[label]
                        ? formatDuration(values[label])
                        : "Set"}
                  </span>
                  <ChevronRight
                    className={cn(
                      "size-3.5 text-muted-foreground",
                      ticking && "invisible"
                    )}
                  />
                </button>
              );
            })}
            <div className="my-1 border-t" />
            <button
              type="button"
              aria-label={`Delete subtask: ${subtask.title}`}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-sm text-destructive hover:bg-destructive/10 dark:text-red-400"
            >
              <Trash2 className="size-3.5" /> Delete subtask
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A subtask's Actual and Planned times and its Start / Stop button, as in
 * Sunsama's task view. Starting a subtask times its task too.
 */
export function SubtaskTiming({
  subtask,
  onMobileDelete,
}: {
  subtask: Subtask;
  onMobileDelete?: () => void;
}) {
  const toggle = useSubtaskTimerToggle();
  const update = useUpdateSubtask();
  const { running, seconds } = useLiveSeconds(subtask);
  const save = (data: {
    actualMins?: number | null;
    estimatedMins?: number | null;
  }) => update.mutate({ taskId: subtask.taskId, subtaskId: subtask.id, data });
  const timerProps = {
    "aria-label": `${running ? "Stop" : "Start"} subtask timer: ${subtask.title}`,
    disabled: subtask.completed && !running,
    onClick: (event: React.MouseEvent) => {
      if (isSingleClick(event)) void toggle(subtask.taskId, subtask.id);
    },
  };
  const TimerIcon = running ? Pause : Play;

  if (onMobileDelete) {
    return (
      <div className="-ml-3 flex shrink-0 items-center">
        <button
          type="button"
          {...timerProps}
          className={cn(
            "flex h-11 min-w-11 items-center justify-end gap-1 rounded-md pr-2.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:invisible",
            running &&
              "text-xs tabular-nums text-emerald-700 dark:text-emerald-400"
          )}
        >
          {running && formatClock(seconds)}
          <span className="flex size-6 items-center justify-center rounded-full border border-current/40">
            <TimerIcon className="size-3.5" />
          </span>
        </button>
        <MobileSubtaskOptions
          subtask={subtask}
          seconds={seconds}
          onDelete={onMobileDelete}
          onSave={(field, value) =>
            save(
              field === "Actual"
                ? { actualMins: value }
                : { estimatedMins: value }
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">
      {running ? (
        <span className="w-14 text-right text-sm tabular-nums text-emerald-500">
          {formatClock(seconds)}
        </span>
      ) : (
        <TimeField
          value={subtask.actualMins}
          label="Actual"
          subtaskTitle={subtask.title}
          onChange={(mins) => save({ actualMins: mins })}
        />
      )}
      <TimeField
        value={subtask.estimatedMins}
        label="Planned"
        subtaskTitle={subtask.title}
        onChange={(mins) => save({ estimatedMins: mins })}
      />
      <button
        type="button"
        {...timerProps}
        className={cn(
          "flex h-7 w-[4.5rem] items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold uppercase tracking-wider transition-[opacity,colors] focus-visible:ring-1 focus-visible:ring-ring",
          running
            ? "border-emerald-500 text-emerald-500 hover:bg-emerald-500/10"
            : subtask.completed
              ? "invisible"
              : "border-emerald-500 bg-emerald-500 text-white opacity-0 hover:bg-emerald-600 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        )}
      >
        <TimerIcon className="size-3.5" />
        {running ? "Stop" : "Start"}
      </button>
    </div>
  );
}
