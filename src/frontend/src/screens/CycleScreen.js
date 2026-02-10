import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getUserItem, setUserItem } from "../../utils/storage";
import { initCycle } from "../config/api"; // ✅ added import

export default function CycleScreen({ navigation }) {
  const [cycle, setCycle] = useState(null);
  const [wordScores, setWordScores] = useState({});
  const [wordProgress, setWordProgress] = useState({}); // ✅ ADD THIS

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCycle = async () => {
      try {
        const storedCycle = await getUserItem("currentCycle");
        const storedScores = await getUserItem("wordScores");
        const storedProgress = await getUserItem("wordProgress");
if (storedProgress) setWordProgress(storedProgress);


        if (storedCycle) {
          const parsed =
            typeof storedCycle === "string"
              ? JSON.parse(storedCycle)
              : storedCycle;
          setCycle(parsed);
        } else {
          // ✅ If no local cycle, try to initialize a new one from API
          const token =
  (await getUserItem("token")) ||
  (await AsyncStorage.getItem("token"));

if (!token) throw new Error("Missing token — please log in again.");

          if (!token) throw new Error("Missing token");

          const data = await initCycle(token); // ✅ centralized API call
          if (!data?.batches?.length)
            throw new Error("No batches received from server");

          setCycle(data);
          await setUserItem("currentCycle", data);
        }

        if (storedScores) setWordScores(storedScores);
      } catch (err) {
        console.error("❌ Failed to load cycle:", err);
        Alert.alert("Error", err.message || "Could not load cycle data.");
      } finally {
        setLoading(false);
      }
    };

    loadCycle();
  }, []);

  console.log("🧩 CycleScreen cycle:", JSON.stringify(cycle, null, 2));

  const handleStartQuiz = () => {
    if (!cycle) return;
    if (cycle?.batches?.length > 0) {
      navigation.navigate("Quiz", { batches: cycle.batches });
    } else {
      Alert.alert(
        "No words to quiz",
        "Your cycle has no batches or words yet."
      );
    }
  };

  if (loading) {
    return (
      <ScreenWrapper navigation={navigation}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4b8bff" />
        </View>
      </ScreenWrapper>
    );
  }

  if (!cycle) {
    return (
      <ScreenWrapper navigation={navigation}>
        <View style={styles.center}>
          <Text>No active cycle found.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("BatchPreview")}
          >
            <Text style={styles.buttonText}>Start New Cycle</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

    return (
    <ScreenWrapper navigation={navigation} showBack>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Current Cycle</Text>

        {cycle.batches.map((batch, index) => (
          <View key={index} style={styles.batchSection}>
            <Text style={styles.batchTitle}>Batch {index + 1}</Text>

            {batch.words.map((item, idx) => {
              const word = typeof item === "string" ? item : item.word;
              const progress = wordProgress[word] ?? 0;
              const color =
                progress >= 80
                  ? "#10b981"
                  : progress >= 50
                  ? "#ffb300"
                  : "#f87171";

              return (
                <View key={idx} style={styles.wordCard}>
                  <Text style={styles.word}>{word}</Text>
                  <Text style={[styles.score, { color }]}>
                    {Math.ceil(progress)}%
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        <TouchableOpacity style={styles.button} onPress={handleStartQuiz}>
          <Text style={styles.buttonText}>Resume Quiz</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#020c45", // dark navy background
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 24,
    textAlign: "center",
    color: "#ff387a",
  },
  batchSection: {
    width: "100%",
    backgroundColor: "#060f55ff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  batchTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#ffffffff",
  },
  wordCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: "#ffffff33",
  },
  word: { fontSize: 18, color: "#fff" },
  score: { fontSize: 18, fontWeight: "700" },
  button: {
    backgroundColor: "#ff387a",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginTop: 20,
    alignSelf: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  emptyText: {
    color: "#ffffffaa",
    fontSize: 16,
    marginBottom: 10,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#020c45" },
});