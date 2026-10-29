import { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format, addDays, subDays } from "date-fns";
import { Lucide } from "@react-native-vector-icons/lucide";
import { useTimeBlocks, useUpdateTimeBlock } from "@/hooks/useTimeBlocks";
import { Timeline } from "@/components/Timeline";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { useThemeColors, type ThemeColors } from "@/lib/theme";
import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";
import type { CalendarEvent } from "@open-sunsama/types";

/**
 * Calendar screen - shows time blocks for the selected date
 */
export default function CalendarScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [creating, setCreating] = useState(false);
  const updateBlock = useUpdateTimeBlock();

  const dateString = format(selectedDate, "yyyy-MM-dd");
  const {
    data: timeBlocks,
    isLoading,
    refetch,
    isRefetching,
  } = useTimeBlocks({
    date: dateString,
  });
  const events = useQuery({
    queryKey: ["calendar-events", dateString],
    queryFn: async () => (await getApiClient().get<{ data: CalendarEvent[] }>("calendar-events", { searchParams: { date: dateString } })).data,
  });

  const goToPreviousDay = useCallback(() => {
    setSelectedDate((prev) => subDays(prev, 1));
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const isToday = format(new Date(), "yyyy-MM-dd") === dateString;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity
          onPress={goToPreviousDay}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Lucide name="chevron-left" size={22} color={colors.secondary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday} style={styles.dateButton}>
          <Text style={styles.dateText}>
            {isToday ? "Today" : format(selectedDate, "EEE, MMM d")}
          </Text>
          {!isToday && (
            <Text style={styles.dateSubtext}>
              {format(selectedDate, "yyyy")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goToNextDay}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Lucide name="chevron-right" size={22} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      {events.isError && <Text style={{ color: colors.danger, paddingHorizontal: 16 }}>Could not load synced calendar events. Pull to retry.</Text>}
      {!!events.data?.some((event) => event.isAllDay && event.status !== "cancelled") && <View style={{ padding: 12, backgroundColor: colors.surface, gap: 4 }}>
        <Text style={{ color: colors.secondary, fontSize: 12 }}>All day</Text>
        {events.data.filter((event) => event.isAllDay && event.status !== "cancelled").map((event) => <Text key={event.id} style={{ color: colors.text }}>{event.title}</Text>)}
      </View>}
      {/* Timeline */}
      <Timeline
        timeBlocks={timeBlocks}
        events={events.data ?? []}
        selectedDate={selectedDate}
        isLoading={isLoading}
        isRefetching={isRefetching || events.isRefetching}
        onRefresh={() => { void refetch(); void events.refetch(); }}
        isToday={isToday}
        onMoveBlock={async (block, startTime, endTime) => {
          try {
            await updateBlock.mutateAsync({ id: block.id, data: { startTime: startTime.toISOString(), endTime: endTime.toISOString() } });
          } catch (error) {
            Alert.alert("Could not move time block", error instanceof Error ? error.message : "Please try again.");
          }
        }}
      />
      <TouchableOpacity style={styles.fab} onPress={() => setCreating(true)} accessibilityRole="button" accessibilityLabel="Create calendar task">
        <Lucide name="plus" size={24} color="#fff" />
      </TouchableOpacity>
      <Modal visible={creating} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreating(false)}>
        {creating && <CreateTaskModal calendar defaultDate={dateString} onClose={() => setCreating(false)} />}
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    fab: { position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentFill, alignItems: "center", justifyContent: "center", elevation: 5 },
    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.raised,
      alignItems: "center",
      justifyContent: "center",
    },
    dateButton: {
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    dateText: { fontSize: 18, fontWeight: "600", color: colors.text },
    dateSubtext: { fontSize: 12, color: colors.secondary, marginTop: 2 },
  });
