import axios from "axios";
import { error } from "console";
import dotenv from "dotenv";
import path, { dirname } from "path";

import { fileURLToPath } from "url";

const _filename = fileURLToPath(import.meta.url);
const __dirname = dirname(_filename);

dotenv.config({ path: path.resolve(__dirname, "./.env") });

export const getAuth0Token = async (): Promise<string> => {
  try {
    const response = await axios.post(
      "https://dev-kfmfhnq5hivv164x.us.auth0.com/oauth/token",
      {
        client_id: process.env.AUTH0_CLIENT_ID as string,
        client_secret: process.env.AUTH0_CLIENT_SECRET as string,
        audience: process.env.AUTH0_AUDIENCE as string,
        grant_type: "client_credentials",
      }
    );
    return response.data.access_token;
  } catch (error: any) {
    console.error("Failed to get token", error.response?.data || error.message);
  }
  throw error;
};
