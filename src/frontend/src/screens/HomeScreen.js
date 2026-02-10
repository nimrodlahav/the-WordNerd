import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getUserItem, removeUserItem } from "../../utils/storage";


export default function HomeScreen({ navigation }) {
  const [day, setDay] = useState(1);
  const [cycleActive, setCycleActive] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadFlag = async () => {
        const active = await getUserItem("cycleActive");
        setCycleActive(active !== false); // defaults true
      };
      loadFlag();
    }, [])
  );

  useEffect(() => {
    const debugStorage = async () => {
      const keys = ["token", "user", "mode", "level", "currentCycle", "cycleActive"];
      const store = {};
      for (let k of keys) store[k] = await getUserItem(k);
      console.log("🧩 STORAGE SNAPSHOT:", store);
    };
    debugStorage();
  }, []);

  useEffect(() => {
    const initDay = async () => {
      try {
        const start = await getUserItem("cycle_start");
        let dayNum = 1;
        if (start) {
          const diff = Math.floor(
            (Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
          );
          dayNum = (diff % 3) + 1;
        }
        setDay(dayNum);
      } catch (err) {
        console.error("Failed to init day:", err);
      }
    };
    initDay();
  }, []);

  const goBatchPreview = () => navigation.navigate("BatchPreview");

  const checkCycle = async (destination) => {
    try {
      const cycleActive = (await getUserItem("cycleActive")) ?? true;
      const stored = await getUserItem("currentCycle");

      if (!stored) return goBatchPreview();

      const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
      const batchesOk = Array.isArray(parsed?.batches) && parsed.batches.length > 0;
      const expired = parsed?.cycle_end
        ? Date.now() > new Date(parsed.cycle_end).getTime()
        : false;

      if (!batchesOk || expired || cycleActive === false) {
        return goBatchPreview();
      }

      navigation.navigate(destination, parsed);
    } catch (err) {
      console.error("Cycle navigation failed:", err);
      Alert.alert("Error", "Could not load cycle data.");
    }
  };

  const handleStartQuiz = async () => checkCycle("Quiz");
  const handleCurrentCycle = async () => checkCycle("Cycle");

  const handleLogout = async () => {
    try {
// ⛑ Minimal logout: remove only session identity
await removeUserItem("token");
await AsyncStorage.removeItem("token");

      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (err) {
      console.error("Logout failed:", err);
      Alert.alert("Error", "Failed to log out properly.");
    }
  };

  return (
    <ScreenWrapper navigation={navigation}>
      {/* 🔝 Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* 🎨 Main layout */}
      <View style={styles.center}>
        {/* Logo */}
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
        />

        {/* Menu */}
        <View style={styles.menuContainer}>
<TouchableOpacity style={styles.menuItem} onPress={handleStartQuiz}>
  <Image
    source={require("../../assets/images/book-of-black-cover-closed (2).png")}
    style={styles.menuImage}
  />
  <Text style={styles.menuText}>Start Quiz</Text>
</TouchableOpacity>


<TouchableOpacity style={styles.menuItem} onPress={handleCurrentCycle}>
  <Image
    source={require("../../assets/images/cycle (1).png")}
    style={styles.menuImage}
  />
  <Text style={styles.menuText}>Current Cycle</Text>
</TouchableOpacity>


<TouchableOpacity
  style={styles.menuItem}
  onPress={() => navigation.navigate("UserStats")}
>
  <Image
    source={require("../../assets/images/icon.png")}
    style={[styles.menuImage, { width: 60, height: 60, marginBottom: -6 }]} // ⬅️ custom size for this one
  />
  <Text style={styles.menuText}>User Status</Text>
</TouchableOpacity>


        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  menuImage: {
  width: 32,          // smaller size — adjust as needed (try 28–32)
  height: 32,
  marginBottom: 8,
  resizeMode: "contain",
},

  logoutButton: {
    position: "absolute",
    top: 20,
    right: 30,
    zIndex: 10,
  },
  logoutText: {
    color: "#ff387a", // pink accent
    fontSize: 16,
    fontWeight: "700",
  },
center: {
  flex: 1,
  justifyContent: "flex-start", // keep logo at top part
  alignItems: "center",
  backgroundColor: "#020c45",
    paddingTop: 180,               // ⬅️ move logo downward (tweak 100–140 as needed)

},

menuContainer: {
  flexDirection: "row",
  justifyContent: "space-around",
  alignItems: "flex-end",
  width: "90%",
  position: "absolute",  // allows positioning relative to the screen
  bottom: 60,             // ⬅️ move the whole row lower (adjust as needed)
},
  logo: {
    width: 250,
    height: 250,
    resizeMode: "contain",
    marginBottom: 20,
  },

  menuItem: {
    alignItems: "center",
  },
  menuIcon: {
    fontSize: 36,
    color: "#ff387a",
    marginBottom: 8,
  },
  menuText: {
    fontWeight: "800",
    color: "#ff387a",
    fontSize: 18,
    
  },
});
