const DEV_API_URL = "http://127.0.0.1:3000/api/v1";
const PROD_API_URL = "https://archmage-new.fly.dev/api/v1";

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
