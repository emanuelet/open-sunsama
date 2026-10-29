import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { useThemeColors } from "@/lib/theme";

export function ApiEndpointSettings({ disabled = false, onSavingChange }: { disabled?: boolean; onSavingChange?: (saving: boolean) => void }) {
  const colors = useThemeColors();
  const { apiUrl, changeApiUrl, isAuthenticated } = useAuth();
  const [value, setValue] = useState(apiUrl);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(apiUrl), [apiUrl]);
  const save = async () => {
    setSaving(true);
    onSavingChange?.(true);
    try {
      await changeApiUrl(value);
      Alert.alert("API server updated", isAuthenticated ? "Sign in to the selected server." : "You can now sign in to the selected server.");
    } catch (error) {
      Alert.alert("Could not update API server", error instanceof Error ? error.message : "Please try again.");
    } finally { setSaving(false); onSavingChange?.(false); }
  };
  return <View style={styles.container}>
    <Text style={[styles.label, { color: colors.text }]}>API server URL</Text>
    <TextInput accessibilityLabel="API server URL" style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.surface }]} value={value} onChangeText={setValue} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://api.example.com" placeholderTextColor={colors.muted} editable={!saving && !disabled} />
    <Text style={{ color: colors.secondary, fontSize: 12 }}>Changing servers signs you out of the current account.</Text>
    <TouchableOpacity accessibilityRole="button" disabled={disabled || saving || value.trim() === apiUrl} onPress={() => void save()} style={[styles.button, { backgroundColor: colors.accentFill, opacity: disabled || saving || value.trim() === apiUrl ? 0.5 : 1 }]}><Text style={styles.buttonText}>{saving ? "Saving…" : "Save server"}</Text></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 14, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: 8, minHeight: 48, paddingHorizontal: 12, fontSize: 16 },
  button: { alignItems: "center", padding: 12, borderRadius: 8 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
