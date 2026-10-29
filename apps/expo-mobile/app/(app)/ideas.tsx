import { useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Idea } from "@open-sunsama/types";
import { getApi } from "@/lib/api";
import { useThemeColors, type ThemeColors } from "@/lib/theme";

export default function IdeasScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const queryClient = useQueryClient();
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [editing, setEditing] = useState<Idea | null>(null);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [mode, setMode] = useState<"board" | "idea" | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [source, setSource] = useState("");

  const boards = useQuery({ queryKey: ["ideas", "boards"], queryFn: () => getApi().ideas.boards.list() });
  const boardId = boards.data?.some((board) => board.id === selectedBoard) ? selectedBoard : boards.data?.[0]?.id;
  const columns = useQuery({ queryKey: ["ideas", "columns", boardId], queryFn: () => getApi().ideas.columns.list(boardId!), enabled: !!boardId });
  const ideas = useQuery({ queryKey: ["ideas", "list", boardId], queryFn: () => getApi().ideas.list({ boardId: boardId! }), enabled: !!boardId });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ideas"] });
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: invalidate,
    onError: (error) => Alert.alert("Ideas", error instanceof Error ? error.message : "Something went wrong"),
  });

  const openIdea = (column: string, idea?: Idea) => {
    setColumnId(column);
    setEditing(idea ?? null);
    setTitle(idea?.title ?? "");
    setNotes(idea?.notes ?? "");
    setUrl(idea?.url ?? "");
    setTags(idea?.tags.join(", ") ?? "");
    setSource(idea?.source ?? "");
    setMode("idea");
  };
  const save = async () => {
    if (!title.trim()) return;
    try {
      if (mode === "board") {
        const board = await mutation.mutateAsync(() => getApi().ideas.boards.create({ name: title.trim() }));
        setSelectedBoard((board as { id: string }).id);
      } else if (boardId && columnId) {
        const input = { title: title.trim(), notes: notes.trim() || null, url: url.trim() || null, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), source: source.trim() || null };
        await mutation.mutateAsync(() => editing ? getApi().ideas.update(editing.id, input) : getApi().ideas.create({ boardId, columnId, ...input }));
      }
      setMode(null);
    } catch { /* mutation displays the error */ }
  };

  return <SafeAreaView style={styles.container} edges={["left", "right"]}>
    <ScrollView horizontal style={styles.boardBar} contentContainerStyle={styles.boardList}>
      {boards.data?.map((board) => <TouchableOpacity key={board.id} style={[styles.boardButton, board.id === boardId && styles.selected]} onPress={() => setSelectedBoard(board.id)}><Text style={styles.text}>{board.name}</Text></TouchableOpacity>)}
      <TouchableOpacity style={styles.boardButton} onPress={() => { setTitle(""); setMode("board"); }}><Text style={styles.accent}>+ Board</Text></TouchableOpacity>
    </ScrollView>
    <ScrollView contentContainerStyle={styles.content}>
      {boards.isLoading || ideas.isLoading ? <Text style={styles.secondary}>Loading ideas…</Text> : null}
      {boards.isError || ideas.isError || columns.isError ? <Text style={styles.secondary}>Could not load ideas. Pull to refresh by reopening this tab.</Text> : null}
      {!boards.isLoading && !boardId && <Text style={styles.secondary}>Create a board to start collecting ideas.</Text>}
      {columns.data?.map((column) => <View key={column.id} style={styles.column}>
        <Text style={styles.heading}>{column.name}</Text>
        {ideas.data?.filter((idea) => idea.columnId === column.id).map((idea) => <TouchableOpacity key={idea.id} style={styles.card} onPress={() => openIdea(column.id, idea)}>
          <View style={styles.row}>
            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: !!idea.completedAt }} accessibilityLabel={`Complete ${idea.title}`} onPress={() => mutation.mutate(() => getApi().ideas.update(idea.id, { completedAt: idea.completedAt ? null : new Date() }))}><Text style={styles.accent}>{idea.completedAt ? "☑" : "○"}</Text></TouchableOpacity>
            <Text style={[styles.text, idea.completedAt && styles.completed]}>{idea.title}</Text>
          </View>
          {!!idea.source && <Text style={styles.secondary}>{idea.source}</Text>}
          {!!idea.tags?.length && <Text style={styles.secondary}>{idea.tags.join(" · ")}</Text>}
        </TouchableOpacity>)}
        <TouchableOpacity style={styles.add} onPress={() => openIdea(column.id)}><Text style={styles.accent}>+ Add idea</Text></TouchableOpacity>
      </View>)}
    </ScrollView>
    <Modal visible={!!mode} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMode(null)}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><TouchableOpacity onPress={() => setMode(null)}><Text style={styles.secondary}>Cancel</Text></TouchableOpacity><Text style={styles.heading}>{mode === "board" ? "New board" : editing ? "Edit idea" : "New idea"}</Text><TouchableOpacity onPress={save} disabled={mutation.isPending || !title.trim()}><Text style={styles.accent}>Save</Text></TouchableOpacity></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={mode === "board" ? "Board name" : "Idea title"} placeholderTextColor={colors.muted} />
          {mode === "idea" && <>
            <TextInput style={[styles.input, styles.notes]} value={notes} onChangeText={setNotes} placeholder="Description" placeholderTextColor={colors.muted} multiline />
            <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="Link" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="url" />
            <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="Tags, separated by commas" placeholderTextColor={colors.muted} />
            <TextInput style={styles.input} value={source} onChangeText={setSource} placeholder="Source" placeholderTextColor={colors.muted} />
            {editing && <TouchableOpacity style={styles.add} onPress={() => { mutation.mutate(() => getApi().ideas.promote(editing.id)); setMode(null); }}><Text style={styles.accent}>Send to backlog</Text></TouchableOpacity>}
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  boardBar: { flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  boardList: { gap: 8, padding: 12 },
  boardButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.raised },
  selected: { backgroundColor: colors.accentTint },
  content: { padding: 16, gap: 16 },
  column: { gap: 10 },
  heading: { fontSize: 17, fontWeight: "600", color: colors.text },
  text: { color: colors.text, fontSize: 16, flexShrink: 1 },
  secondary: { color: colors.secondary, fontSize: 13 },
  accent: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  card: { padding: 14, borderRadius: 10, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  completed: { textDecorationLine: "line-through", color: colors.muted },
  add: { padding: 12, alignItems: "center", borderRadius: 8, backgroundColor: colors.raised },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: { padding: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder, color: colors.text, fontSize: 16 },
  notes: { minHeight: 120, textAlignVertical: "top" },
});
