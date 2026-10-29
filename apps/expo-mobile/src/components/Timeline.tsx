import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { TimeBlockCard } from "@/components/TimeBlockCard";
import type { CalendarEvent, TimeBlock } from "@open-sunsama/types";
import { useThemeColors, type ThemeColors } from "@/lib/theme";
import { calendarDragOffset } from "@/lib/calendar-drag";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const HOUR_HEIGHT = 60;

interface TimelineProps {
  timeBlocks: TimeBlock[] | undefined;
  events: CalendarEvent[];
  selectedDate: Date;
  isLoading: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  isToday: boolean;
  onMoveBlock: (block: TimeBlock, startTime: Date, endTime: Date) => Promise<void>;
}

/**
 * Timeline component for displaying time blocks
 */
export function Timeline({
  timeBlocks,
  events,
  selectedDate,
  isLoading,
  isRefetching,
  onRefresh,
  isToday,
  onMoveBlock,
}: TimelineProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1);
  const timedEvents = events.filter((event) => !event.isAllDay && event.status !== "cancelled" && new Date(event.startTime) < dayEnd && new Date(event.endTime) > dayStart);
  const eventLanes = new Map<string, number>();
  const laneEnds: number[] = [];
  for (const event of [...timedEvents].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))) {
    const start = Date.parse(event.startTime);
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = Date.parse(event.endTime);
    eventLanes.set(event.id, lane);
  }

  const getBlockStyle = (block: TimeBlock) => {
    const startDate =
      block.startTime instanceof Date
        ? block.startTime
        : new Date(block.startTime);
    const endDate =
      block.endTime instanceof Date ? block.endTime : new Date(block.endTime);
    const startHour = startDate.getHours() + startDate.getMinutes() / 60;
    const endHour = endDate.getHours() + endDate.getMinutes() / 60;
    const duration = endHour - startHour;
    return {
      top: startHour * HOUR_HEIGHT,
      height: Math.max(duration * HOUR_HEIGHT, 30),
    };
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  };

  return (
    <ScrollView
      style={styles.timeline}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {HOURS.map((hour) => (
        <View key={hour} style={[styles.hourRow, { top: hour * HOUR_HEIGHT }]}>
          <Text style={styles.hourLabel}>{formatHour(hour)}</Text>
          <View style={styles.hourLine} />
        </View>
      ))}

      {isToday && (
        <View style={[styles.currentTime, { top: currentHour * HOUR_HEIGHT }]}>
          <View style={styles.currentTimeDot} />
          <View style={styles.currentTimeLine} />
        </View>
      )}

      <View style={styles.blocksContainer}>
        {timeBlocks?.map((block) => (
          <DraggableBlock key={block.id} block={block} style={getBlockStyle(block)} onMove={onMoveBlock} narrow={timedEvents.length > 0} />
        ))}
        {timedEvents.map((event) => {
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);
          const top = eventStart <= dayStart ? 0 : (eventStart.getHours() * 60 + eventStart.getMinutes()) / 60 * HOUR_HEIGHT;
          const bottom = eventEnd >= dayEnd ? 24 * HOUR_HEIGHT : (eventEnd.getHours() * 60 + eventEnd.getMinutes()) / 60 * HOUR_HEIGHT;
          const startPercent = timeBlocks?.length ? 51 : 0;
          const width = (100 - startPercent) / Math.max(1, laneEnds.length);
          const left = `${startPercent + (eventLanes.get(event.id) ?? 0) * width}%` as const;
          return <View key={event.id} accessibilityLabel={`Calendar event: ${event.title}`} style={[styles.event, { top, height: Math.max(30, bottom - top), left, width: `${width}%`, borderLeftColor: event.calendar?.color ?? colors.accent }]}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{event.title}</Text>
            <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 11 }}>{eventStart.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – {eventEnd.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
          </View>;
        })}
      </View>

      {!isLoading && (!timeBlocks || timeBlocks.length === 0) && timedEvents.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No time blocks</Text>
          <Text style={styles.emptySubtitle}>
            Schedule tasks from the Tasks tab
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function DraggableBlock({ block, style, onMove, narrow }: {
  block: TimeBlock;
  style: { top: number; height: number };
  onMove: (block: TimeBlock, startTime: Date, endTime: Date) => Promise<void>;
  narrow: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const start = new Date(block.startTime);
  const end = new Date(block.endTime);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const duration = (end.getTime() - start.getTime()) / 60000;
  const getOffset = (translationY: number) => calendarDragOffset(startMinutes, duration, translationY, HOUR_HEIGHT);
  const gesture = Gesture.Pan()
    .activateAfterLongPress(350)
    .enabled(!saving && duration > 0 && duration <= 1440)
    .runOnJS(true)
    .onStart(() => setDragging(true))
    .onUpdate((event) => setOffset(getOffset(event.translationY)))
    .onFinalize((event, success) => {
      setDragging(false);
      const minutes = getOffset(event.translationY);
      if (!success || Math.abs(event.translationY) < 2 || !minutes) { setOffset(0); return; }
      const nextStart = new Date(start);
      nextStart.setMinutes(nextStart.getMinutes() + minutes);
      const nextEnd = new Date(nextStart.getTime() + end.getTime() - start.getTime());
      setOffset(minutes);
      setSaving(true);
      void onMove(block, nextStart, nextEnd).finally(() => { setSaving(false); setOffset(0); });
    });
  return <GestureDetector gesture={gesture}>
    <View accessibilityLabel={`${block.title}. Press and hold to move`} style={{ position: "absolute", left: 0, right: narrow ? "51%" : 0, top: style.top + offset / 60 * HOUR_HEIGHT, height: style.height, zIndex: dragging ? 10 : 1, opacity: saving ? 0.65 : 1 }}>
      <TimeBlockCard timeBlock={offset ? { ...block, startTime: new Date(start.getTime() + offset * 60000), endTime: new Date(end.getTime() + offset * 60000) } : block} />
    </View>
  </GestureDetector>;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    timeline: { flex: 1, backgroundColor: colors.background },
    content: {
      position: "relative",
      height: HOURS.length * HOUR_HEIGHT + 40,
      paddingTop: 20,
      paddingBottom: 40,
    },
    hourRow: {
      position: "absolute",
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      height: 1,
    },
    hourLabel: {
      width: 54,
      fontSize: 11,
      color: colors.secondary,
      textAlign: "right",
      paddingRight: 8,
    },
    hourLine: { flex: 1, height: 1, backgroundColor: colors.border },
    currentTime: {
      position: "absolute",
      left: 54,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      zIndex: 100,
    },
    currentTimeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#ef4444",
      marginLeft: -4,
    },
    currentTimeLine: { flex: 1, height: 2, backgroundColor: "#ef4444" },
    blocksContainer: {
      position: "absolute",
      left: 62,
      right: 16,
      top: 20,
      bottom: 0,
    },
    blockWrapper: { position: "absolute", left: 0, right: 0 },
    event: { position: "absolute", borderLeftWidth: 4, borderRadius: 6, padding: 6, backgroundColor: colors.raised, overflow: "hidden" },
    emptyState: {
      position: "absolute",
      top: 200,
      left: 0,
      right: 0,
      alignItems: "center",
      paddingVertical: 48,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtitle: { fontSize: 14, color: colors.secondary },
  });
