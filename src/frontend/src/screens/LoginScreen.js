import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserItem, setUserItem } from "../../utils/storage";
import { apiRequest, login, register } from "../config/api"; // ✅ use central API

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 🔍 Auto-skip login if token + user data already exist
  useEffect(() => {
    const checkExisting = async () => {
      const token =
  (await getUserItem("token")) ||
  (await AsyncStorage.getItem("token"));

if (!token) throw new Error("Missing token — please log in again.");

      const mode = await getUserItem("mode");
      const level = await getUserItem("level");
      if (token && mode && level) {
        navigation.replace("Home");
      }
    };
    checkExisting();
  }, [navigation]);

  // ✨ Fade in logo animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();
  }, []);

  // 🔐 Handle both login & registration
  const handleAuth = async () => {
    try {
      setError("");
      let res;

      if (isRegister) {
        // Clear stale local state before new registration
        await AsyncStorage.multiRemove(["mode", "currentCycle", "cycleActive"]);

        res = await register(email, password, name);
        await setUserItem("token", res.token); // ✅ stores the JWT string
        await setUserItem("user", res.user);   // ✅ stores the user object separately


        // 🧩 Try restoring existing cycle from backend (optional)
        try {
          const cycleData = await apiRequest("/vocab/status", "GET", null, res.token);
          if (cycleData?.batches?.length) {
            await setUserItem("currentCycle", cycleData);
            await setUserItem("mode", String(cycleData.mode || ""));
            await setUserItem("level", cycleData.level || "Beginner");
            await setUserItem("cycleActive", "true");

            console.log("✅ Cycle restored from backend");
          } else {
            console.log("ℹ️ No active cycle found for this user.");
          }
        } catch (e) {
          console.warn("⚠️ Could not restore cycle:", e);
        }

        // 👉 Navigate to mode selection (first-time setup)
        navigation.replace("ModeSelect", { token: res.token, user: res.user });
      } else {
        // 🔓 Login existing user
        res = await login(email, password);
        await setUserItem("token", res.token);
        await setUserItem("user", res.user);

        // 👉 Send user directly to Home — AppNavigator handles cycle logic
        navigation.replace("Home", { token: res.token, user: res.user });
      }
    } catch (err) {
      console.error("❌ Auth error:", err);
      setError(err.message || "Authentication failed");
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/images/background (1).png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
          />
        </Animated.View>

        {isRegister && (
          <TextInput
placeholderTextColor="#aaa"
style={[styles.input, { color: "#fff" }]}
            placeholder="Name"
            value={name}
            onChangeText={setName}
          />
        )}

        <TextInput
placeholderTextColor="#aaa"
style={[styles.input, { color: "#fff" }]}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          
        />

        <TextInput
placeholderTextColor="#aaa"
style={[styles.input, { color: "#fff" }]}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleAuth}>
          <Text style={styles.buttonText}>
            {isRegister ? "Register" : "Login"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
          <Text style={styles.toggle}>
            {isRegister
              ? "Already have an account? Log in"
              : "Need an account? Register"}
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0)",
    justifyContent: "center",
    alignItems: "center",
    padding: 64,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 30,
    resizeMode: "contain",
  },
  input: {
    width: "90%",
    backgroundColor: "#020c45",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  button: {
    backgroundColor: "#ff387a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  toggle: { marginTop: 16, color: "#f7f7f7" },
  error: { color: "#ffdddd", marginVertical: 8, fontWeight: "600" },
});
