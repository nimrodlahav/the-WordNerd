// components/BackButton.js (root/components)
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function BackButton({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.btn} activeOpacity={0.8}>
      <View style={styles.arrowCircle}>
        <Text style={styles.arrow}>←</Text>
      </View>
      <Text style={styles.label}>Back</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    top: 40,
    right: 16,
    zIndex: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4b8bff",
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { color: "#fff", fontSize: 16, fontWeight: "800" },
  label: { color: "#333", fontSize: 16, fontWeight: "600" },
});
