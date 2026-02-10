import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getUserItem, setUserItem } from "../../utils/storage";

export default function UserStatsScreen({ navigation }) {
  const [totalLearned, setTotalLearned] = useState(0);
  const [user, setUser] = useState({});
  const [day, setDay] = useState(1);
  const [pace, setPace] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);

        const userWords = (await getUserItem("userWords")) || { learnedWords: [] };
        const total = userWords.learnedWords.length;
        setTotalLearned(total);

        const userData = await getUserItem("user");
        const start = await getUserItem("cycle_start");
        const modeData = await getUserItem("mode");

        setUser(userData || {});

        const diff = start
          ? Math.floor(
              (Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;
        setDay((diff % 3) + 1);

        const paceNum = modeData ? 10 * Number(modeData) : 10;
        setPace(paceNum);
      } catch (err) {
        console.error("❌ Failed to load user stats:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = navigation.addListener("focus", loadStats);
    return unsubscribe;
  }, [navigation]);

  const handleRestartCycle = async () => {
    try {
      await setUserItem("cycleActive", false);
      Alert.alert("Cycle Reset", "You can now start a new cycle.");
      navigation.replace("BatchPreview");
    } catch (err) {
      console.error("Failed to reset cycle:", err);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper navigation={navigation}>
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color="#ff387a" />
          <Text style={{ marginTop: 10, color: "#fff" }}>Loading stats...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper navigation={navigation}>
      {/* 🌄 Full-screen background */}
      <ImageBackground
        source={require("../../assets/images/background (1).png")} // 🔹 replace with your actual image path
        style={styles.background}
        resizeMode="stretch"
      >
        <View style={styles.container}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
          />

          <Text style={styles.greeting}>Hey {user?.name || "User"}!</Text>

          <View style={styles.statsBox}>
            <Text style={styles.statText}>It's Day {day} of 3 of your cycle</Text>
            <Text style={styles.statText}>Currently learning {pace * 7} words/week</Text>


            <TouchableOpacity onPress={() => navigation.navigate("UserWords")}>
              <Text style={[styles.statText, styles.clickable]}>
                You've learned  <Text style={styles.link}>{totalLearned}</Text>  words so far
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRestartCycle}
              style={{ marginTop: 100 }}
            >
              <Text style={styles.restartText}>Restart Cycle</Text>
            </TouchableOpacity>
            
          </View>
        </View>
      </ImageBackground>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  logo: {
    alignSelf: "center",
    width: 180,
    height: 180,
    resizeMode: "center",
    marginBottom: 60,
    marginTop: 100
  
  },
  greeting: {
    fontSize: 50,
    fontWeight: "bold",
    color: "#ffffffff",
    marginBottom: 25,
    
  },
  statsBox: {
    gap: 20,
    marginBottom: 20,
  },
  statText: {
    fontSize: 22,
    color: "#ffffffff",
    fontWeight: "600",
  },
  clickable: {
    color: "#ffffffff",
    fontWeight: "600"
  },
  link: {
    color: "#fc6396ff",
    fontWeight: "600",

    fontSize: 30
  },
  restartText: {
    fontSize: 22,
    color: "#fc6396ff",
    fontWeight: "600",
  },
});
