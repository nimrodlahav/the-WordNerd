import AsyncStorage from "@react-native-async-storage/async-storage";

export const cleanupLegacyStorage = async () => {
  try {
    const flag = await AsyncStorage.getItem("legacy_cleanup_done");

    if (flag) return; // already cleaned once

    const allKeys = await AsyncStorage.getAllKeys();
    const filtered = allKeys.filter(k => !k.includes("_user_"));

    if (filtered.length > 0) {
      console.log("🧹 Removing legacy keys:", filtered);
      await AsyncStorage.multiRemove(filtered);
    }

    await AsyncStorage.setItem("legacy_cleanup_done", "true");

    console.log("🔥 Legacy storage cleanup done.");
  } catch (e) {
    console.log("⚠️ Cleanup error:", e);
  }
};
