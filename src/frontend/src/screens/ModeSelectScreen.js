import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserItem, removeUserItem, setUserItem } from "../../utils/storage";
import { initCycle } from "../config/api";

export default function ModeSelectScreen() {
  const [level, setLevel] = useState("Beginner");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const { token: navToken } = route.params || {};
  const modes = [1, 2, 3, 4];

  // ✅ Initialize a new cycle
const handleConfirm = async () => {
  if (!selected) {
    Alert.alert("Pick a mode first!");
    return;
  }

  try {
    setLoading(true);
    const token = navToken || (await getUserItem("token"));
    if (!token) {
      Alert.alert("No token found — please log in again.");
      navigation.navigate("Login");
      return;
    }

    // 🧩 Save selections first — initCycle() will read them from storage
    await setUserItem("mode", selected);
    await setUserItem("level", level.toLowerCase());

    console.log("🚀 Initializing cycle with:", {
      mode: selected,
      level: level.toLowerCase(),
    });

    // ✅ Call the centralized API (reads mode/level from storage)
    const data = await initCycle(token);

    // 🔹 Save relevant data with helper
    await setUserItem("currentCycle", data);
    await setUserItem("cycleActive", true);

    Alert.alert("Cycle initialized!", `Level: ${level}, Mode ${selected}`);
    navigation.replace("BatchPreview", { batches: data.batches });
  } catch (err) {
    console.error("❌ handleConfirm error:", err);
    Alert.alert("Error", err.message || "Failed to initialize cycle");
  } finally {
    setLoading(false);
  }
};


  // ✅ Logout handler
  const handleLogout = async () => {
    try {
      await Promise.all([
        removeUserItem("token"),
        removeUserItem("currentCycle"),
        removeUserItem("mode"),
        removeUserItem("level"),
        removeUserItem("cycleActive"),
      ]);
      Alert.alert("Logged out", "You can now log in again.");
      navigation.replace("Login");
    } catch (err) {
      console.error("Logout failed:", err);
      Alert.alert("Error", "Failed to log out properly.");
    }
  };

  // 💡 Helper: show pace for each mode
  const getPace = (num) => `${num * 10*7} words/week`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Level</Text>

      <View style={styles.row}>
        {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
          <TouchableOpacity
            key={lvl}
            style={[styles.option, level === lvl && styles.selected]}
            onPress={() => setLevel(lvl)}
          >
            <Text
              style={[
                styles.optionText,
                level === lvl && styles.selectedText,
              ]}
            >
              {lvl}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.title, { marginTop: 40 }]}>Select Mode</Text>

      <View style={styles.row}>
        {modes.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.option, selected === m && styles.selected]}
            onPress={() => setSelected(m)}
          >
            <Text
              style={[
                styles.optionText,
                selected === m && styles.selectedText,
              ]}
            >
              Mode {m}
            </Text>
            <Text style={styles.pace}>{getPace(m)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.5 }]}
        disabled={loading}
        onPress={handleConfirm}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Confirm</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020c45", // dark navy background
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 15,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "center",
    marginTop: 10,
  },
  option: {
    backgroundColor: "#09135f",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: "center",
    width: 160,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  selected: {
    backgroundColor: "#ff387a",
    shadowColor: "#ff387a",
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  optionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffffcc",
  },
  selectedText: {
    color: "#fff",
  },
  pace: {
    fontSize: 13,
    color: "#ffffff99",
    marginTop: 6,
  },
  button: {
    backgroundColor: "#ff387a",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 40,
    shadowColor: "#ff387a",
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  logoutButton: {
    marginTop: 30,
  },
  logoutText: {
    color: "#ff8ab0",
    fontSize: 16,
    fontWeight: "500",
  },
});