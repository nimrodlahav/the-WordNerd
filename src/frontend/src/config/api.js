// src/config/api.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setUserItem } from "../../utils/storage";

/**
 * 🌐 Base API URL — flexible for local / staging / production
 */
const LOCAL_URL = "http://192.168.1.240:3000";
const PROD_URL = "https://wordnerd-server.onrender.com"; // your live backend

// Use local only in Expo Dev mode, otherwise use server
const API_URL = __DEV__ ? LOCAL_URL : PROD_URL;




console.log("📡 Using API URL:", API_URL);


export const getApiUrl = () => API_URL;

/**
 * 🔹 Safe fetch helper
 */
export const apiRequest = async (endpoint, method = "GET", body = null, token = null) => {
  const url = `${API_URL}${endpoint}`;
  const headers = { "Content-Type": "application/json" };

  // 🔒 sanitize token: extract string if stored as object
if (token) {
  const tokenStr =
    typeof token === "object" && token.token
      ? token.token
      : String(token);
  headers["Authorization"] = `Bearer ${tokenStr}`;
}


  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || data.message || `API Error ${res.status}`);
  return data;
};



/* ==========================
   AUTH ROUTES
   ========================== */

export const register = (email, password, name) =>
  apiRequest("/auth/register", "POST", { email, password, name });

export const login = async (email, password) => {
  const data = await apiRequest("/auth/login", "POST", { email, password });

  if (data?.user && data?.token) {
    // 🔒 Always use a plain string token
    const tokenStr =
      typeof data.token === "object" && data.token.token
        ? data.token.token
        : String(data.token);

    // 1) Write base keys FIRST (so userKey() can resolve per-user keys)
    await AsyncStorage.setItem("user", JSON.stringify(data.user));
    await AsyncStorage.setItem("token", tokenStr);

    // 2) Then mirror to per-user storage
    await setUserItem("user", data.user);
    await setUserItem("token", tokenStr);
  } else {
    console.warn("⚠️ Login response missing token or user:", data);
  }

  return data;
};




/* ==========================
   VOCAB ROUTES
   ========================== */

import { getUserItem } from "../../utils/storage";

export const initCycle = async (token) => {
  const mode = (await getUserItem("mode")) || 2;
  const level = (await getUserItem("level")) || "beginner"; // 👈 this is key
  const knownWords = (await getUserItem("learnedWords")) || [];

  return apiRequest(
    "/vocab/init",
    "POST",
    { mode, level, knownWords }, // 👈 include level here
    token
  );
};

export const replaceKnown = (batchId, remove, token) =>
  apiRequest("/vocab/replace-known", "POST", { batchId, remove }, token);

export const submitScore = (word, day, similarityScore, token) =>
  apiRequest("/vocab/submit-score", "POST", { word, day, similarityScore }, token);

/* ==========================
   USER ROUTES
   ========================== */

export const getUserStats = (token) =>
  apiRequest("/user/stats", "GET", null, token);

export const getUserWords = (token) =>
  apiRequest("/user/words", "GET", null, token);

export const getCurrentCycle = (token) =>
  // ⚠️ backend expects POST (not GET), to include Authorization header
  apiRequest("/vocab/status", "POST", null, token).catch(() => null);

/* ==========================
   AI SIMILARITY CHECK
   ========================== */

export const checkSimilarity = (source, target) =>
  apiRequest("/similarity", "POST", { source, target });
