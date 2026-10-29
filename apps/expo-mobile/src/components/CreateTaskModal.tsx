import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Task, TaskPriority } from "@open-sunsama/types";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { useCreateTimeBlock } from "@/hooks/useTimeBlocks";
import { PrioritySelector } from "./PrioritySelector";
import { TaskChecklist } from "./TaskChecklist";
import { useThemeColors, type ThemeColors } from "@/lib/theme";

interface CreateTaskModalProps {
  onClose: () => void;
  defaultDate?: string;
  task?: Task;
  calendar?: boolean;
}

/**
 * Create task modal component
 */
export function CreateTaskModal({
  onClose,
  defaultDate,
  task,
  calendar = false,
}: CreateTaskModalProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "P2");
  const [estimatedMins, setEstimatedMins] = useState(task?.estimatedMins?.toString() ?? "");
  const [scheduledDate, setScheduledDate] = useState(task?.scheduledDate ?? defaultDate ?? "");
  const [startTime, setStartTime] = useState("09:00");
  const [createdTask, setCreatedTask] = useState<Task | null>(null);

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createBlock = useCreateTimeBlock();
  const pending = createTask.isPending || updateTask.isPending || createBlock.isPending;

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a task title");
      return;
    }

    const minutes = estimatedMins ? Number(estimatedMins) : null;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) {
      Alert.alert("Invalid estimate", "Enter a number of minutes between 1 and 1440.");
      return;
    }
    if (scheduledDate && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      Alert.alert("Invalid date", "Enter a date as YYYY-MM-DD, or leave it blank for the backlog.");
      return;
    }
    if (calendar && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      Alert.alert("Invalid time", "Enter a time in 24-hour HH:MM format.");
      return;
    }
    let taskCreated = !!createdTask;
    try {
      const input = {
        title: title.trim(),
        notes: notes.trim() || null,
        priority,
        scheduledDate: scheduledDate || null,
        estimatedMins: minutes,
      };
      if (task) {
        await updateTask.mutateAsync({ id: task.id, data: input });
      } else {
        const created = createdTask ?? await createTask.mutateAsync({ ...input, notes: input.notes ?? undefined, scheduledDate: input.scheduledDate ?? undefined, estimatedMins: input.estimatedMins ?? undefined });
        if (calendar && defaultDate) {
          taskCreated = true;
          setCreatedTask(created);
          const start = new Date(`${defaultDate}T${startTime}:00`);
          await createBlock.mutateAsync({ taskId: created.id, title: created.title, startTime: start.toISOString(), endTime: new Date(start.getTime() + (minutes ?? 60) * 60000).toISOString() });
        }
      }
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create task";
      Alert.alert("Error", taskCreated ? `Task was created, but the time block failed. Retry or cancel. ${message}` : message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{task ? "Edit Task" : "New Task"}</Text>
          <TouchableOpacity
            onPress={handleCreate}
            style={[
              styles.saveButton,
              !title.trim() && styles.saveButtonDisabled,
            ]}
            disabled={pending || !title.trim()}
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  !title.trim() && styles.saveTextDisabled,
                ]}
              >
                {task ? "Save" : "Create"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus
              multiline
              maxLength={500}
            />
          </View>

          {task && <TaskChecklist taskId={task.id} />}

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add any details or context..."
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {/* Priority */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Priority</Text>
            <PrioritySelector value={priority} onChange={setPriority} />
          </View>

          {/* Estimated time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Estimated Time (minutes)</Text>
            <TextInput
              style={styles.input}
              placeholder="30"
              placeholderTextColor={colors.muted}
              value={estimatedMins}
              onChangeText={setEstimatedMins}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          {!calendar && <View style={styles.inputGroup}>
            <Text style={styles.label}>Scheduled date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={scheduledDate} onChangeText={setScheduledDate} placeholder="Backlog" placeholderTextColor={colors.muted} />
          </View>}
          {calendar && <View style={styles.inputGroup}>
            <Text style={styles.label}>Start time (HH:MM)</Text>
            <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="09:00" placeholderTextColor={colors.muted} />
          </View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    keyboardView: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cancelButton: { padding: 8 },
    cancelText: { fontSize: 16, color: colors.secondary },
    headerTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
    saveButton: { padding: 8, minWidth: 60, alignItems: "center" },
    saveButtonDisabled: { opacity: 0.5 },
    saveText: { fontSize: 16, fontWeight: "600", color: colors.accent },
    saveTextDisabled: { color: colors.muted },
    form: { flex: 1, padding: 16 },
    inputGroup: { marginBottom: 24 },
    label: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
      marginBottom: 8,
    },
    titleInput: {
      fontSize: 18,
      color: colors.text,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 48,
    },
    notesInput: {
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      minHeight: 100,
      textAlignVertical: "top",
    },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 16,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
  });
