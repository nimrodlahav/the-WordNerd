// src/AppNavigator.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { getUserItem } from "../utils/storage"; // ✅ CORRECT RELATIVE PATH

import BatchPreviewScreen from "./screens/BatchPreviewScreen";
import CycleScreen from "./screens/CycleScreen";
import DebugStorageScreen from "./screens/DebugStorageScreen";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import ModeSelectScreen from "./screens/ModeSelectScreen";
import QuizScreen from "./screens/QuizScreen";
import UserStatsScreen from "./screens/UserStatsScreen";
import UserWordsScreen from "./screens/UserWordsScreen";


const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token =
  (await getUserItem("token")) ||
  (await AsyncStorage.getItem("token"));

        if (!token) {
          // 🧱 No token = force LoginScreen
          setInitialRoute("Login");
          return;
        }     // ✅ defined now
        const mode = await getUserItem("mode");
        const level = await getUserItem("level");

        if (token && mode && level) {
          setInitialRoute("Home");
        } else if (token) {
          setInitialRoute("ModeSelect");
        } else {
          setInitialRoute("Login");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setInitialRoute("Login");
      }
    };
    checkAuth();
  }, []);

  if (!initialRoute) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={initialRoute}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ModeSelect" component={ModeSelectScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="BatchPreview" component={BatchPreviewScreen} />
        <Stack.Screen name="Cycle" component={CycleScreen} />
        <Stack.Screen name="Quiz" component={QuizScreen} />
        <Stack.Screen name="UserStats" component={UserStatsScreen} />
        <Stack.Screen name="UserWords" component={UserWordsScreen} />
        <Stack.Screen name="DebugStorage" component={DebugStorageScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
