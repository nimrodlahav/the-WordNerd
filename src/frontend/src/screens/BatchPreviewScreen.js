import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getUserItem, removeUserItem, setUserItem } from "../../utils/storage";
import { initCycle, replaceKnown } from "../config/api";

// -------- Review Queue helpers (FIFO + cap 150) --------
const QUEUE_CAP = 150;
// Item shape: { word, readyAtBatch, addedAt }

const loadQueue = async () => (await getUserItem("reviewQueue")) || [];
const saveQueue = async (queue) => {
  // sort by earliest readyAtBatch, then earliest addedAt
  const sorted = [...queue].sort((a, b) =>
    a.readyAtBatch !== b.readyAtBatch
      ? a.readyAtBatch - b.readyAtBatch
      : a.addedAt - b.addedAt
  );
  // cap to 150
  const capped = sorted.slice(0, QUEUE_CAP);
  await setUserItem("reviewQueue", capped);
  return capped;
};

// pop up to `count` words that are ready now (readyAtBatch <= currentBatchIdx)
const takeReadyFromQueue = (queue, currentBatchIdx, count) => {
  const ready = [];
  const remaining = [];
  for (const item of queue) {
    if (ready.length < count && item.readyAtBatch <= currentBatchIdx) {
      // take it
      ready.push(item.word);
    } else {
      remaining.push(item);
    }
  }
  return { readyWords: ready, remainingQueue: remaining };
};


const persistLearnedWords = async (newWords = []) => {
  try {
    if (!newWords?.length) return;
    const userWords = (await getUserItem("userWords")) || { learnedWords: [] };
    newWords.forEach((w) => {
      if (!userWords.learnedWords.includes(w)) {
        const wordStr = typeof w === "string" ? w : w.word;
userWords.learnedWords.push(wordStr);

      }
    });
    await setUserItem("userWords", userWords);
    console.log("Saved mastered words → userWords.learnedWords:", newWords);
  } catch (err) {
    console.error(" Failed to persist userWords:", err);
  }
};

export default function BatchPreviewScreen({ route, navigation }) {
  const { batches: incoming = [] } = route.params || {};
  const [batches, setBatches] = useState(incoming);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batch, setBatch] = useState(incoming[0] || null);
  const [loading, setLoading] = useState(false);
  const [removedWords, setRemovedWords] = useState([]);
  const [debug, setDebug] = useState({});

  useEffect(() => {
    const loadCycle = async () => {
      try {
        if (incoming.length) {
          setDebug({ from: "params", batchCount: incoming.length });
          return;
        }

        setLoading(true);

        const token =
          (await getUserItem("token")) || (await AsyncStorage.getItem("token"));
        if (!token) throw new Error("Missing token — please log in again.");


        const userLevel = (await getUserItem("level")) || "Beginner";
        console.log("🎯 Loading words for level:", userLevel);

        const data = await initCycle(token, userLevel);

        const userWords = (await getUserItem("userWords")) || { learnedWords: [] };
        const promoted = userWords.learnedWords || [];
        const promotedSet = new Set(promoted.map((w) => w.toLowerCase()));

        const wordMeta = (await getUserItem("wordMeta")) || {};
        const prevCyclesBatchCount =
          (await getUserItem("completedBatchCount")) || 0;
        const currentBatchIndex = prevCyclesBatchCount;

        const filteredBatchesByDelay = data.batches.map((b) => ({
          ...b,
          words: b.words.filter((w) => {
            const wordStr = typeof w === "string" ? w : w.word;
            const meta = wordMeta[wordStr];
            if (currentBatchIndex === 0) return true; // day 1 show all
            if (!meta) return true;
            const { delay = 0, lastSeenBatch = -100 } = meta;
            const batchesPassed = currentBatchIndex - lastSeenBatch;
            return batchesPassed >= delay;
          }),
        }));

        const filteredBatches = filteredBatchesByDelay.map((b) => ({
          ...b,
          words: b.words.filter((w) => {
            const wordStr = typeof w === "string" ? w : w.word;
            const key = wordStr.toLowerCase();
            const matchesLevel =
              !w.level || w.level.toLowerCase() === userLevel.toLowerCase();
            const notPromoted = !promotedSet.has(key);
            return matchesLevel && notPromoted;
          }),
        }));

        if (!filteredBatches?.length)
          throw new Error("No batches received from server");

        // Merge in READY review words (FIFO) before fresh words, per batch (size=30)
        const queue0 = await loadQueue();
        let workingQueue = [...queue0];
        const SIZE = 30;

        const mergedBatches = filteredBatches.map((b) => {
          const baseWords = b.words.map((x) => (typeof x === "string" ? x : x.word));
          const { readyWords, remainingQueue } = takeReadyFromQueue(
            workingQueue,
            currentBatchIndex,
            SIZE
          );
          workingQueue = remainingQueue;

          // Dedup & fill
          const picked = new Set(readyWords);
          const fillFromFresh = [];
          for (const w of baseWords) {
            if (picked.size >= SIZE) break;
            if (!picked.has(w)) {
              picked.add(w);
              fillFromFresh.push(w);
            }
          }
          const finalWords = [...readyWords, ...fillFromFresh].slice(0, SIZE);

          return { ...b, words: finalWords };
        });

        // Save updated queue back (after popping ready words)
        const savedQueue = await saveQueue(workingQueue);

        setBatches(mergedBatches);
        setBatch(mergedBatches[0]);
        await setUserItem("currentCycle", { ...data, batches: mergedBatches });
        await setUserItem("cycle_start", new Date().toISOString());
        await setUserItem("batchesDoneInThisCycle", 0); // reset per-cycle batch counter
        await setUserItem("removedWordsThisCycle", []); // reset wipe-outs at cycle start

        //  Debug log metadata and filtering
        setDebug({
          from: "API",
          batchCount: mergedBatches.length,
          firstBatchWords: mergedBatches[0]?.words?.length || 0,
          queueLen: savedQueue.length,
          filteredCounts: mergedBatches.map((b) => b.words.length),
          wordMeta,
        });

        console.log("🧹 Removed promoted words:", promoted.length);
        console.log("Batch[0] size:", mergedBatches[0]?.words?.length);
      } catch (err) {
        console.error(" initCycle error:", err);
        Alert.alert("Error", err.message);
      } finally {
        setLoading(false);
      }
    };

    loadCycle();
  }, []);

  const handleRemove = async (word) => {
    try {
      setLoading(true);

      // Count it as wiped out for this cycle (for auto-known promotion after quiz)
      const removed = (await getUserItem("removedWordsThisCycle")) || [];
      if (!removed.includes(word)) {
        removed.push(word);
        await setUserItem("removedWordsThisCycle", removed);
      }

      const token =
        (await getUserItem("token")) || (await AsyncStorage.getItem("token"));
      if (!token) throw new Error("Missing token — please log in again.");

      //  Tell backend to replace this word
      const cycleData = await replaceKnown(batch.id, [word], token);

      //  Update local batch & batches
      const newBatch = { ...batch, words: cycleData.finalBatch };
      const newBatches = [...batches];
      newBatches[batchIndex] = newBatch;

      setBatch(newBatch);
      setBatches(newBatches);
      setRemovedWords((prev) => [...prev, word]);

      //  Persist learned word (wipe-out)
      await persistLearnedWords([word]);

      //  Remove it from reviewQueue if it exists there
      const q = await loadQueue();
      const q2 = q.filter((it) => it.word !== word);
      await saveQueue(q2);

      //  Update cycle cache
      const storedCycle = (await getUserItem("currentCycle")) || {};
      const updatedCycle = { ...storedCycle, batches: newBatches };
      await setUserItem("currentCycle", updatedCycle);

      setDebug((d) => ({
        ...d,
        lastRemoved: word,
        batchWords: newBatch.words.length,
        queueLen: q2.length,
      }));
    } catch (err) {
      console.error(" handleRemove error:", err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    try {
      if (batchIndex < batches.length - 1) {
        setBatchIndex(batchIndex + 1);
        setBatch(batches[batchIndex + 1]);
        setRemovedWords([]);
        return;
      }
      const storedCycle = (await getUserItem("currentCycle")) || {};
      const updatedCycle = { ...storedCycle, batches };
      await setUserItem("currentCycle", updatedCycle);
      await setUserItem("cycleActive", true);
      // Reset old quiz progress so restart is clean
// Reset cycle-related state but keep persistent learning history
// DO NOT delete cycle — just ensure fresh quiz start
await removeUserItem("quiz_progress");
await removeUserItem("wordProgress");
await removeUserItem("wordScores");

await setUserItem("cycleActive", true); // cycle stays active


// DO NOT DELETE learnedWords or wordMeta — these must persist


      Alert.alert("Ready!", "Cycle initialized successfully.", [
        {
          text: "Start Quiz",
          onPress: () => {
            console.log("🧭 Navigating to Quiz with batches:", batches);
            navigation.replace("Quiz", {
              batches,
              selectedBatch: batches[0],
            });
          },
        },
      ]);

      setDebug((d) => ({ ...d, navToQuiz: true, totalBatches: batches.length }));
    } catch (err) {
      console.error(" handleContinue error:", err);
      Alert.alert("Error", err.message);
    }
  };

  if (loading && !batch) {
    return (
      <ScreenWrapper navigation={navigation}>
        <View style={styles.center}>
          <ActivityIndicator color="#4b8bff" size="large" />
          <Text>Initializing cycle...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (!batch) {
    return (
      <ScreenWrapper navigation={navigation}>
        <View style={styles.center}>
          <Text>No batch found</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper navigation={navigation} showBack>
      {/*  DEBUG PANEL
      <View style={styles.debugBox}>
        <Text style={styles.debugText}>Debug:</Text>
        <Text style={styles.debugText}>From: {debug.from}</Text>
        <Text style={styles.debugText}>Batches: {batches.length}</Text>
        <Text style={styles.debugText}>
          Current Words: {batch?.words?.length ?? 0}
          <TouchableOpacity
            style={{ marginTop: 6, padding: 4, backgroundColor: "#222", borderRadius: 4 }}
            onPress={() => navigation.navigate("DebugStorage")}
          >
            <Text style={{ color: "#0ff", fontSize: 10 }}>Debug Storage</Text>
          </TouchableOpacity>
        </Text>
        {debug.queueLen !== undefined && (
          <Text style={styles.debugText}>Queue: {debug.queueLen}</Text>
        )}
        {debug.lastRemoved && (
          <Text style={styles.debugText}>Removed: {debug.lastRemoved}</Text>
        )}
      </View> */}

<View style={styles.container}>
  <FlatList
    data={batch.words}
    keyExtractor={(i) => (typeof i === "string" ? i : i.word)}
    numColumns={3}
    contentContainerStyle={styles.grid}
    columnWrapperStyle={styles.row}
    ListHeaderComponent={
      <>
        <Text style={styles.title}>
          Batch {batchIndex + 1} of {batches.length}
        </Text>
        <Text style={styles.subtitle}>Tap to remove words you already know</Text>
        {loading && <ActivityIndicator color="#4b8bff" />}
      </>
    }
    renderItem={({ item }) => {
      const label = typeof item === "string" ? item : item.word;
      const removed = removedWords.includes(label);
      return (
        <TouchableOpacity
          style={[styles.wordCard, removed && { backgroundColor: "#bbb" }]}
          onPress={() => handleRemove(label)}
          disabled={removed || loading}
        >
          <Text
            style={[
              styles.wordText,
              removed && { textDecorationLine: "line-through" },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {label}
          </Text>
        </TouchableOpacity>
      );
    }}
    ListFooterComponent={
      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>
          {batchIndex < batches.length - 1 ? "Next Batch" : "Continue"}
        </Text>
      </TouchableOpacity>
    }
  />
</View>

    </ScreenWrapper>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    alignItems: "center",
    backgroundColor: "#020c45", // 🔹 match QuizScreen dark navy
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 20,
      alignItems: "center",

  },

  subtitle: {
    color: "#ff8ab0",
    marginBottom: 20,
    fontFamily: "RedHatDisplay-Regular",
  },
grid: {
  paddingHorizontal: 12,
  paddingBottom: 60,
},

row: {
  flex: 1,                  // ensures full width for each row
  justifyContent: "flex-start",
},

wordCard: {
  flexGrow: 0,              //  prevents shrinking/stretching
  flexShrink: 0,
  width: "31%",             // keep approximate width
  margin: 4,
  backgroundColor: "#ff387a",
  borderRadius: 8,
  paddingVertical: 12,
  alignItems: "center",
  justifyContent: "center",
  height: 45,
},



  wordText: {
    color: "#fff",
    fontSize: 15,
    textAlign: "center",
  },

button: {
  backgroundColor: "#ff387a",
  paddingVertical: 14,   //  back to normal, not oversized
  paddingHorizontal: 40,
  borderRadius: 10,
  marginTop: 60,       
  marginBottom: 40,      
  alignSelf: "center",   
},


  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },



});
