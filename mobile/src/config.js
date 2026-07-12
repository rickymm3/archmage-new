import { Platform } from "react-native";

// Override for physical devices / custom setups:
//   EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000/api/v1 npx expo start
const DEV_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3000/api/v1";
const PROD_API_URL = "https://archmage-new.fly.dev/api/v1";

// On web served from the same domain, use a relative path to avoid CORS issues.
// On native (iOS/Android), use the full URL.
function resolveApiUrl() {
  if (__DEV__) return DEV_API_URL;
  if (Platform.OS === "web") return "/api/v1";
  return PROD_API_URL;
}

export const API_URL = resolveApiUrl();
