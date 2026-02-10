// components/LogoutButton.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function LogoutButton({ navigation, onLogout }) {
  const handleLogoutPress = async () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          if (onLogout) {
            await onLogout(); // lets a screen override the exact behavior
          } else {
            // ✅ Only remove the token; keep progress in storage
            await AsyncStorage.removeItem("token");
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }
        },
      },
    ]);
  };

  return (
    <TouchableOpacity style={styles.logout} onPress={handleLogoutPress}>
      <Text style={styles.text}>Logout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  logout: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "#2f2d2dff",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    zIndex: 10,
    elevation: 10,
  },
  text: { color: "white", fontWeight: "bold" },
});
