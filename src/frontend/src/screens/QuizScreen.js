import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getUserItem, removeUserItem, setUserItem } from "../../utils/storage";
import vocabData from "../assets/vocab.en-he.json";
import { checkSimilarity, submitScore } from "../config/api";

const normalize = (w) => w.trim().toLowerCase();

const hasCycleExpired = async () => {
  const start = await getUserItem("cycle_start");
  if (!start) return false;

  const elapsedDays = Math.floor(
    (Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (elapsedDays >= 3) {
    await removeUserItem("currentCycle");
    await setUserItem("cycleActive", false);
    return true;
  }

  return false;
};

// -------- Review Queue helpers (shared shape with BatchPreview) --------
const QUEUE_CAP = 150;

const loadQueue = async () => (await getUserItem("reviewQueue")) || [];
const saveQueue = async (queue) => {
  const sorted = [...queue].sort((a, b) =>
    a.readyAtBatch !== b.readyAtBatch
      ? a.readyAtBatch - b.readyAtBatch
      : a.addedAt - b.addedAt
  );
  const capped = sorted.slice(0, QUEUE_CAP);
  await setUserItem("reviewQueue", capped);
  return capped;
};

// upsert one word with a target readyAtBatch; FIFO preserved by keeping original addedAt if exists
const upsertQueueItem = (queue, word, readyAtBatch) => {
  const idx = queue.findIndex((q) => q.word === word);
  if (idx >= 0) {
    const old = queue[idx];
    queue[idx] = {
      word,
      readyAtBatch: Math.min(old.readyAtBatch, readyAtBatch), // if earlier, pull it in
      addedAt: old.addedAt,
    };
  } else {
    queue.push({ word, readyAtBatch, addedAt: Date.now() });
  }
};

// remove words from queue (e.g., known/wiped)
const removeFromQueue = (queue, wordsSet) =>
  queue.filter((q) => !wordsSet.has(q.word));

export default function QuizScreen({ route, navigation }) {
  const { batches = [], selectedBatch } = route.params || {};
  const activeBatch = selectedBatch || batches[0] || {};
  const batchIndex = batches.findIndex((b) => b === activeBatch);

  const [allWords, setAllWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getUserItem("currentCycle");
        if (stored)
          console.log("🧭 Loaded cycle for quiz:", stored?.batches?.length);
      } catch (e) {
        console.error("❌ Failed to parse currentCycle:", e);
      }
    })();
  }, []);

  if (batches.length > 1 && !selectedBatch) {
    return (
      <ScreenWrapper navigation={navigation}>
        <View style={styles.container}>
          <Text style={styles.title}>Select a Batch to Practice</Text>
          {batches.map((b, i) => (
            <TouchableOpacity
              key={i}
              style={styles.button}
              onPress={() =>
                navigation.replace("Quiz", { batches, selectedBatch: b })
              }
            >
              <Text style={styles.buttonText}>Batch {i + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScreenWrapper>
    );
  }

  useEffect(() => {
    if (!activeBatch?.words) return;
    setAllWords(activeBatch.words);
    (async () => {
      const saved = await getUserItem("quiz_progress");
      if (saved?.batchIndex === batchIndex) {
        setCurrentIndex(saved.currentIndex || 0);
        console.log("📌 Resuming batch from saved progress:", saved);
      } else {
        setCurrentIndex(0);
      }
    })();
  }, [activeBatch]);

  const currentWord = allWords[currentIndex];

  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
  const unsubscribe = navigation.addListener("state", (e) => {
    const params = e.data?.state?.routes?.[e.data.state.index]?.params;
    if (params?.hintToggle) {
      setShowHint((prev) => !prev);
      navigation.setParams({ hintToggle: false });
    }
  });
  return unsubscribe;
}, [navigation]);

  const [partitions, setPartitions] = useState(null);
  const [exampleSentence, setExampleSentence] = useState("");

  useEffect(() => {
    if (!currentWord) return;
    setShowHint(false);
    const entry = vocabData[currentWord?.toLowerCase()];
    setPartitions(entry?.partitions || null);
    setExampleSentence(entry?.example || null);
  }, [currentWord]);

  const handleSubmit = async () => {
    if (await hasCycleExpired()) {
  Alert.alert(
    "Cycle Completed 🎉",
    "Your time window for this cycle ended.",
    [
      {
        text: "Start New Cycle",
        onPress: () => navigation.replace("BatchPreview")
      }
    ]
  );
  return;
}

    if (!currentWord || !input.trim()) return;

    try {
      setLoading(true);
      const token = await getUserItem("token");
      if (!token) throw new Error("Missing token");

      const translations = vocabData[currentWord.toLowerCase()]?.translations || [];


      let similarity = 0;
      let feedbackMsg = "";

      if (translations.some(t => t.trim() === input.trim())) {
  similarity = 1;
  feedbackMsg = "Perfect";
}
 else {
        const simData = await checkSimilarity(input.trim(), currentWord);
        similarity = simData?.cosine ?? 0;
        feedbackMsg = simData?.feedback || "";
      }

      // Always send final-day score (your testing mode)
const start = await getUserItem("cycle_start");
const day = start
  ? (Math.floor((Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) % 3) + 1
  : 1;

await submitScore(currentWord, day, similarity, token);

      const scores = (await getUserItem("wordScores")) || {};
      const progress = (await getUserItem("wordProgress")) || {};
const key = `${currentWord}_day${day}`;
if (!scores[key] || similarity > scores[key]) {

        scores[key] = similarity;
        progress[normalize(currentWord)] = Math.min(

          (progress[currentWord] || 0) + similarity * (100 / 3),
          100
        );
        await setUserItem("wordScores", scores);
        await setUserItem("wordProgress", progress);
      }

      setFeedback({
        aiScore: similarity.toFixed(2),
        feedback: feedbackMsg,
        correct: similarity >= 0.8 ? "✅" : similarity >= 0.65 ? "⚠️" : "❌",
        correctAnswer: translations.join(", "),

      });

      setTimeout(async () => {
        setInput("");
        setFeedback(null);
        const next = currentIndex + 1;

        if (next < allWords.length) {
          // Save mid-batch progress
          await setUserItem("quiz_progress", { batchIndex, currentIndex: next });
          setCurrentIndex(next);
          return;
        }

        // -------- END OF BATCH --------
        await removeUserItem("quiz_progress");

        const storedCycle = await getUserItem("currentCycle");
        const wordProgress = (await getUserItem("wordProgress")) || {};

        // ✅ wiped words count as known (100)
        const removedWords = (await getUserItem("removedWordsThisCycle")) || [];
        removedWords.forEach((w) => (wordProgress[w] = 100));
        await setUserItem("wordProgress", wordProgress);

        // (your hardcoded test tweaks ok)


        const classified = { known: [], familiar: [], not_quit: [], new: [] };

        storedCycle?.batches?.forEach((b) => {
          b.words.forEach((w) => {
const score = wordProgress[normalize(w)] || 0;
if (score >= 90) classified.known.push(normalize(w));

            else if (score >= 75) classified.familiar.push(w);
            else if (score >= 50) classified.not_quit.push(w);
            else classified.new.push(w);
          });
        });

        console.log("📊 End of cycle classification:", classified);

        // ✅ Update wordMeta
        const prevMeta = (await getUserItem("wordMeta")) || {};
        const nowBatchIdx = (await getUserItem("completedBatchCount")) || 0; // current finished batch index

        const applyMeta = (arr, status, delay) => {
          arr.forEach((w) => {
            prevMeta[w] = {
              ...(prevMeta[w] || {}),
              status,
              delay,
              lastSeenBatch: nowBatchIdx,
            };
          });
        };
        applyMeta(classified.known, "known", 999);
        applyMeta(classified.familiar, "familiar", 6);
        applyMeta(classified.not_quit, "not_quit", 3);
        applyMeta(classified.new, "new", 1);

        await setUserItem("wordMeta", prevMeta);

        // ✅ Promote mastered to userWords
        const userWords = (await getUserItem("userWords")) || { learnedWords: [] };
classified.known.forEach((w) => {
  const wordStr = typeof w === "string" ? w : w.word;
  if (!userWords.learnedWords.includes(wordStr)) {
    userWords.learnedWords.push(wordStr);
  }
});

        await setUserItem("userWords", userWords);

        // ✅ Enqueue familiar/not_quit/new with FIFO & cap=150
        let queue = await loadQueue();

        // Remove any 'known' / wiped from queue if they somehow exist
        const knownSet = new Set(classified.known.concat(removedWords));
        queue = removeFromQueue(queue, knownSet);

        const enqueueWithDelay = (arr, delay) => {
          const readyAtBatch = nowBatchIdx + delay;
          arr.forEach((w) => upsertQueueItem(queue, w, readyAtBatch));
        };
        enqueueWithDelay(classified.familiar, 6);
        enqueueWithDelay(classified.not_quit, 3);
        enqueueWithDelay(classified.new, 1);

        queue = await saveQueue(queue);
        console.log("🧾 Queue saved. Size:", queue.length);
// ---- Updated Cycle Decision Logic ----

// bump global & per-cycle counters
const prevGlobal = (await getUserItem("completedBatchCount")) || 0;
await setUserItem("completedBatchCount", prevGlobal + 1);

const perCycle = (await getUserItem("batchesDoneInThisCycle")) || 0;
const mode = (await getUserItem("mode")) || 1;
const nowPerCycle = perCycle + 1;
await setUserItem("batchesDoneInThisCycle", nowPerCycle);

// ① If more batches remain AND it’s not final day → continue batching
if (nowPerCycle < Number(mode) && day < 3) {
  const nextBatchIndex = nowPerCycle;
  const nextBatch = batches[nextBatchIndex];

  Alert.alert(
    "Great job!",
    `Batch ${nowPerCycle} of ${mode} done. Continue to next batch?`,
    [
      {
        text: "Continue",
        onPress: () =>
          navigation.replace("Quiz", { batches, selectedBatch: nextBatch }),
      },
      { text: "Later", onPress: () => navigation.navigate("Home"), style: "cancel" },
    ]
  );
  return;
}

// ② If it’s NOT final day → end today's work but DO NOT end cycle
if (day < 3) {
  Alert.alert(
    "Great work!",
    `You're done for Day ${day}. Come back after the next cycle day begins.`,
    [{ text: "OK", onPress: () => navigation.navigate("Home") }]
  );
  return;
}

// ③ If it's Day 3 → finalize cycle (only here!)
await removeUserItem("currentCycle");
await setUserItem("cycleActive", false);
await setUserItem("wordProgress", {});
await setUserItem("wordScores", {});
await removeUserItem("removedWordsThisCycle");

Alert.alert("Cycle Complete 🎉", "Start a new cycle when ready.", [
  { text: "Create New Cycle", onPress: () => navigation.replace("BatchPreview") },
]);
return;


      }, 1800);
    } catch (err) {
      console.error("❌ Quiz submit error:", err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentWord) {
    return (
      <ScreenWrapper navigation={navigation}>
        <View style={styles.center}>
          <Text>No words to quiz.</Text>
        </View>
      </ScreenWrapper>
    );
  }

return (
  <ScreenWrapper navigation={navigation}>
    {/* 🔝 Hint toggle */}
    <TouchableOpacity style={styles.hintButton} onPress={() => setShowHint(!showHint)}>
      <Text style={styles.hintText}>Hint</Text>
      
    </TouchableOpacity>

    <View style={styles.container}>
      {/* 🧠 Word */}
      <Text style={styles.word}>{currentWord}</Text>

      {/* 💡 Hint reveal section */}
      {showHint && (
        <View style={styles.hintSection}>
          {partitions && (
            <Text style={styles.partitionText}>{partitions}</Text>
          )}
          {exampleSentence && (
            <Text style={styles.exampleText}>
              <Text style={{ fontWeight: "bold" }}>Example:</Text> {exampleSentence}
            </Text>
          )}
        </View>
      )}

{/* ✏️ Input + 🚀 Submit side by side */}
<View style={styles.inputRow}>
  <TextInput
    style={styles.input}
    placeholder="הקלד את התרגום בעברית"
    placeholderTextColor="#ffffffaa"
    value={input}
    onChangeText={setInput}
    editable={!loading}
  />       


  <TouchableOpacity
    style={[styles.buttonSmall, loading && { opacity: 0.5 }]}
    disabled={loading}
    onPress={handleSubmit}
  >
    {loading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <Text style={styles.buttonText}>Submit</Text>
    )}
  </TouchableOpacity>
</View>

{feedback && (() => {
  const score = Number(feedback.aiScore ?? 0);

  const color =
    score >= 0.89
      ? "#2ecc71" // green
      : score >= 0.67
      ? "#f1c40f" // yellow
      : "#eb3f2cff"; // red

  return (
    <View style={styles.feedback}>
      <Text style={[styles.feedbackText, { color }]}>
        {feedback.feedback || " "}
      </Text>
      {!!feedback.correctAnswer && (
        <Text style={styles.correctAnswer}>
          Possible answer: {feedback.correctAnswer.split(",")[0]}
        </Text>
      )}
    </View>
  );
})()}



      <Text style={styles.progress}>
        {currentIndex + 1} / {allWords.length}
      </Text>
    </View>
  </ScreenWrapper>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020c45", // dark navy
    justifyContent: "flex-start",
    paddingTop: 150,
    alignItems: "center",
    padding: 24,
  },
  word: {
    fontSize: 42,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 10,
  },
  hintButton: {
    position: "absolute",
    top: 50,
    right: 30,
  },
  hintText: {
    color: "#ff387a",
    fontSize: 16,
    fontWeight: "600",
  },

feedbackText: {
  fontSize: 24,
  fontWeight: "600",
  color: "#fff",
  textAlign: "center",
},

  hintSection: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  partitionText: {
    fontSize: 20,
    color: "#ffffff",
    marginBottom: 6,
  },
  exampleText: {
    color: "#ffffff",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
    maxWidth: "80%",
    lineHeight: 22,
  },
inputRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 25,
  marginBottom: 20,
  gap: 12,             // space between input and button
  width: "110%",        // controls total row width
},

input: {
  flex: 0.75,          // shorter input (3/4 width of row)
  backgroundColor: "transparent",
  borderWidth: 1,
  borderColor: "#ff387a",
  borderRadius: 8,
  paddingVertical: 10,
  paddingHorizontal: 14,
  fontSize: 18,
  textAlign: "center",
  color: "#fff",
},

title: {
  fontSize: 26,          // ⬆ makes text larger
  fontWeight: "800",
  color: "#ffffffff",      // ⬅ soft pink like in your other screens
  marginBottom: 25,
  textAlign: "center",
},

buttonSmall: {
  backgroundColor: "#ff387a",
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 8,
},
  button: {
    backgroundColor: "#ff387a",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 30,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  feedback: {
    marginTop: 20,
    fontSize: 18,
    alignItems: "center",
  },
  correctAnswer: {
    marginTop: 6,
    color: "#ffcccc",
    fontSize: 20,
    fontFamily: "700",
  },
  progress: {
    position: "absolute",
    bottom: 20,
    color: "#fff",
    fontSize: 14,
    fontWeight: "500"
  },

});
