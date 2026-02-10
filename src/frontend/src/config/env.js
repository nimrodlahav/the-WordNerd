import Constants from "expo-constants";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0] || "192.168.1.240";

export const ENV = {
  dev: {
    API_URL: `http://${localIP}:3000`, // <-- matches your backend
  },
  prod: {
    API_URL: "https://your-production-server.com",
  },
};

export const currentEnv = ENV.dev;
