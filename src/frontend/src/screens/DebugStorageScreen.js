import { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getUserItem } from "../../utils/storage";

const DEBUG_KEYS = [
  "wordMeta",
  "userWords",
  "currentCycle",
  "wordProgress",
  "wordScores",
  "cycleActive",
  "mode",
  "level",
  "learnedWords",
];

export default function DebugStorageScreen({ navigation }) {
  const [values, setValues] = useState({});

  const load = async () => {
    const v = {};
    for (const key of DEBUG_KEYS) {
      v[key] = await getUserItem(key);
    }
    setValues(v);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ScreenWrapper navigation={navigation} showBack>
      <ScrollView style={{ padding: 12 }}>
        <Text style={styles.title}>📦 Storage Debug View</Text>
        
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>

        {DEBUG_KEYS.map((key) => (
          <View key={key} style={styles.block}>
            <Text style={styles.keyText}>{key}:</Text>
            <Text style={styles.valueText}>
              {JSON.stringify(values[key], null, 2) || "—"}
            </Text>
          </View>
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, marginBottom: 10, fontWeight: "bold", color: "#0ff" },
  block: {
    backgroundColor: "#111",
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
  },
  keyText: { color: "#0f0", fontWeight: "600", fontFamily: "monospace" },
  valueText: { color: "#fff", marginTop: 4, fontFamily: "monospace", fontSize: 12 },
  refreshBtn: {
    backgroundColor: "#444",
    padding: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  refreshText: { color: "#fff", fontWeight: "600" },
});
