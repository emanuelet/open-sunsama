import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Subtask } from "@open-sunsama/types";
import { getApi } from "@/lib/api";
import { useThemeColors, type ThemeColors } from "@/lib/theme";

export function TaskChecklist({ taskId }: { taskId: string }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const client = useQueryClient();
  const key = ["subtasks", taskId];
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: key, queryFn: () => getApi().subtasks.list(taskId) });
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => Alert.alert("Checklist", error instanceof Error ? error.message : "Please try again."),
  });
  const add = async () => {
    const title = draft.trim();
    if (!title || mutation.isPending) return;
    try { await mutation.mutateAsync(() => getApi().subtasks.create(taskId, { title })); setDraft(""); } catch { /* mutation reports errors */ }
  };
  const saveTitle = async (item: Subtask) => {
    const title = editingTitle.trim();
    if (!title || title === item.title) { setEditingId(null); return; }
    try { await mutation.mutateAsync(() => getApi().subtasks.update(taskId, item.id, { title })); setEditingId(null); } catch { /* keep the draft for retry */ }
  };
  return <View style={styles.container}>
    <Text style={styles.heading}>Checklist</Text>
    {isLoading && <Text style={styles.secondary}>Loading checklist…</Text>}
    {isError && <TouchableOpacity onPress={() => void refetch()}><Text style={styles.accent}>Could not load checklist. Tap to retry.</Text></TouchableOpacity>}
    {data.map((item) => <View key={item.id} style={styles.row}>
      <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: item.completed }} accessibilityLabel={`Complete ${item.title}`} disabled={mutation.isPending} onPress={() => mutation.mutate(() => getApi().subtasks.update(taskId, item.id, { completed: !item.completed }))} style={styles.checkbox}><Text style={styles.accent}>{item.completed ? "☑" : "○"}</Text></TouchableOpacity>
      {editingId === item.id ? <TextInput accessibilityLabel="Edit checklist item" style={styles.itemInput} value={editingTitle} onChangeText={setEditingTitle} onBlur={() => void saveTitle(item)} autoFocus maxLength={500} /> : <TouchableOpacity style={styles.item} onPress={() => { setEditingId(item.id); setEditingTitle(item.title); }}><Text style={[styles.text, item.completed && styles.completed]}>{item.title}</Text></TouchableOpacity>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} disabled={mutation.isPending} onPress={() => Alert.alert("Delete checklist item?", item.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => mutation.mutate(() => getApi().subtasks.delete(taskId, item.id)) }])} style={styles.delete}><Text style={styles.secondary}>×</Text></TouchableOpacity>
    </View>)}
    <View style={styles.row}><TextInput accessibilityLabel="New checklist item" style={styles.itemInput} value={draft} onChangeText={setDraft} placeholder="Add a checklist item" placeholderTextColor={colors.muted} onSubmitEditing={() => void add()} maxLength={500} /><TouchableOpacity accessibilityRole="button" disabled={!draft.trim() || mutation.isPending} onPress={() => void add()} style={styles.delete}><Text style={styles.accent}>Add</Text></TouchableOpacity></View>
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { gap: 8, marginBottom: 24 },
  heading: { color: colors.text, fontSize: 14, fontWeight: "500" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  delete: { minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" },
  item: { flex: 1, paddingVertical: 10 },
  itemInput: { flex: 1, color: colors.text, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  text: { color: colors.text, fontSize: 16 },
  completed: { color: colors.muted, textDecorationLine: "line-through" },
  secondary: { color: colors.secondary, fontSize: 16 },
  accent: { color: colors.accent, fontSize: 16, fontWeight: "600" },
});
