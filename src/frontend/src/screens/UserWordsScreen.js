// src/screens/UserWordsScreen.js
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ImageBackground } from "react-native";

import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getUserItem } from "../../utils/storage";

export default function UserWordsScreen({ navigation }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
const loadWords = async () => {
  try {
    setLoading(true);

    const userWords = (await getUserItem("userWords")) || { learnedWords: [] };

    const uniqueSorted = [...new Set(userWords.learnedWords)]
      .sort((a, b) => a.localeCompare(b));

    setWords(uniqueSorted);
  } catch (err) {
    console.error("❌ Failed to load learned words:", err);
  } finally {
    setLoading(false);
  }
};



      loadWords();
    }, [])
  );

  if (loading) {
    return (
      <ScreenWrapper navigation={navigation} showBack>
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color="#4b8bff" />
          <Text style={{ marginTop: 10 }}>Loading learned words...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
  <ScreenWrapper navigation={navigation} showBack backgroundColor="transparent">
    <ImageBackground
      source={require("../../assets/images/background (1).png")}
      style={{ flex: 1 }}
      resizeMode="stretch"
    >
      <View style={styles.container}>
        <Text style={styles.title}>All Learned Words</Text>

        <FlatList
          data={words}
          keyExtractor={(item, idx) => `${item}-${idx}`}
          numColumns={3}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ justifyContent: "flex-start" }}
          renderItem={({ item }) => (
            <View style={styles.wordBox}>
              <Text style={styles.word}>{item}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No words learned yet.</Text>
          }
        />
      </View>
    </ImageBackground>
  </ScreenWrapper>
);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: 30,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 15,
    textAlign: "center",
    color: "#f83d7bff",
  },
  grid: { paddingBottom: 40 },
  wordBox: {
    backgroundColor: "#ff387a",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    margin: 6,
    minWidth: 90,
    alignItems: "center",
  },
  word: { fontSize: 16, color: "#ffffffff", fontWeight: "500" },
  empty: { textAlign: "center", color: "#777", marginTop: 30 },
});
