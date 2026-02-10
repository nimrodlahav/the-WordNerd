import { useRoute } from "@react-navigation/native";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ScreenWrapper({ navigation, children, backgroundColor }) {
  const route = useRoute();
  const screenName = route.name;

  const isLogin = screenName === "Login";
  const isHome = screenName === "Home";

  const goHome = () => navigation?.navigate("Home");
  const goBack = () => navigation?.goBack();

  const resolvedColor = backgroundColor || "#eaeaea";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: resolvedColor }]}>
      {/* ✅ Small logo (every screen except Login + Home) */}
      {!isLogin && !isHome && (
        <TouchableOpacity onPress={goHome} style={styles.smallLogoBtn}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.smallLogo}
          />
        </TouchableOpacity>
      )}

      {/* ✅ Back or Hint button */}
      {!isLogin && !isHome && screenName !== "Quiz" && (
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}

      {/* 🧠 Hint button for Quiz screen only */}
      {screenName === "Quiz" && (
        <TouchableOpacity
          onPress={() => navigation.setParams({ hintToggle: true })}
          style={styles.backBtn}
        >
          <Text style={[styles.backText, { color: "#ff387a" }]}>Hint</Text>
        </TouchableOpacity>
      )}

      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },

  smallLogoBtn: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 20,
  },
  smallLogo: {
    width: 48,
    height: 48,
    resizeMode: "contain",
  },

  backBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 20,
  },
  backText: {
    color: "#ff387a",
    fontSize: 18,
    fontWeight: "600",
  },
});
