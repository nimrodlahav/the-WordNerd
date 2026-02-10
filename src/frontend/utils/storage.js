import AsyncStorage from "@react-native-async-storage/async-storage";

// helper to safely parse JSON
const parseJSON = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// get current logged-in user ID
export const getCurrentUserId = async () => {
  const userJSON = await AsyncStorage.getItem("user");
  const user = parseJSON(userJSON);
  return user?.id || user?._id || user?.email || null;
};

// build per-user key
const userKey = async (key) => {
  const id = await getCurrentUserId();
  return id ? `${key}_user_${id}` : key;
};

// per-user get / set / remove
export const setUserItem = async (key, value) => {
  const fullKey = await userKey(key);
  await AsyncStorage.setItem(fullKey, JSON.stringify(value));
};

export const getUserItem = async (key) => {
  const fullKey = await userKey(key);

  // Try per-user key first
  let val = await AsyncStorage.getItem(fullKey);

  // Fallback to base key if missing
  if (val === null) {
    val = await AsyncStorage.getItem(key);
  }

  // Try parse JSON; if not JSON, return raw string (token case)
  const parsed = parseJSON(val);
  return parsed === null ? val : parsed;
};

export const removeUserItem = async (key) => {
  const fullKey = await userKey(key);
  await AsyncStorage.removeItem(fullKey);
};
