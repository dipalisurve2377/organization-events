import axios from "axios";
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

console.log("🔍 Auth0 ENV values:", {
  AUTH0_CLIENT_ID: process.env.AUTH0_USER_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_USER_CLIENT_SECRET,
  AUTH0_AUDIENCE: process.env.AUTH0_USER_AUDIENCE,
});

export const getAuth0Token = async (): Promise<string> => {
  try {
    const response = await axios.post(
      "https://dev-kfmfhnq5hivv164x.us.auth0.com/oauth/token",
      {
        client_id: process.env.AUTH0_USER_CLIENT_ID as string,
        client_secret: process.env.AUTH0_USER_CLIENT_SECRET as string,
        audience: process.env.AUTH0_USER_AUDIENCE as string,
        grant_type: "client_credentials",
      }
    );

    return response.data.access_token;
  } catch (error: any) {
    console.error(
      "Failed to get Auth0 token:",
      error.response?.data || error.message
    );
    throw error;
  }
};
