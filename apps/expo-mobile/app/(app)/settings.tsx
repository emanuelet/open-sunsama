import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useThemeColors, type ThemeColors } from "@/lib/theme";
import Constants from "expo-constants";
import { ApiEndpointSettings } from "@/components/ApiEndpointSettings";

/**
 * Settings screen
 */
export default function SettingsScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { user, logout, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setTimezone(user?.timezone ?? "");
  }, [user?.name, user?.timezone]);

  const saveProfile = async () => {
    const zone = timezone.trim();
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
    } catch {
      Alert.alert("Invalid timezone", "Enter a valid IANA timezone, such as Europe/Rome.");
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        name: name.trim() || null,
        ...(zone !== user?.timezone ? { timezone: zone, timezoneManuallySet: true } : {}),
      });
      Alert.alert("Saved", "Your account settings have been updated.");
    } catch (error) {
      Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* User Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  "?"}
              </Text>
            </View>
            <View style={styles.userInfo}>
              {user?.name && <Text style={styles.userName}>{user.name}</Text>}
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.menuCard}>
            <View style={styles.field}>
              <Text style={styles.menuItemText}>Display name</Text>
              <TextInput accessibilityLabel="Display name" style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} />
            </View>
            <View style={styles.field}>
              <Text style={styles.menuItemText}>Timezone</Text>
              <TextInput accessibilityLabel="Timezone" style={styles.input} value={timezone} onChangeText={setTimezone} autoCapitalize="none" placeholder="Europe/Rome" placeholderTextColor={colors.muted} />
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save settings</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server</Text>
          <View style={[styles.menuCard, { padding: 16 }]}><ApiEndpointSettings /></View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.menuCard}>
            <View style={styles.menuItem}>
              <Text style={styles.menuItemText}>Version</Text>
              <Text style={styles.menuItemValue}>
                {Constants.expoConfig?.version || "1.0.0"}
              </Text>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.secondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentFill,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 22,
      fontWeight: "600",
      color: "#fff",
    },
    userInfo: {
      marginLeft: 16,
      flex: 1,
    },
    userName: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 2,
    },
    userEmail: {
      fontSize: 14,
      color: colors.secondary,
    },
    menuCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuItemText: {
      fontSize: 16,
      color: colors.text,
    },
    field: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
    input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 12, color: colors.text, fontSize: 16 },
    saveButton: { margin: 16, padding: 12, borderRadius: 8, alignItems: "center", backgroundColor: colors.accentFill },
    saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    menuItemValue: {
      fontSize: 16,
      color: colors.secondary,
    },
    logoutButton: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.danger,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.danger,
    },
  });
