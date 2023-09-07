import { OAuth2Client } from "google-auth-library";
import kfs from "key-file-storage";
import { join } from "path";
import express from "express";

export const db = kfs(join(__dirname, "..", "db"));

export async function checkAccessToken(oauth: OAuth2Client): Promise<void> {
  try {
    //will crash if refresh token is not valid
    const accessToken = await oauth.getAccessToken();
    if (!accessToken.token) {
      throw new Error("Didn't get access token");
    }

    oauth.setCredentials({
      access_token: accessToken.token,
    });
  } catch (e: any) {
    if (typeof e === "object" && "code" in e && e.code === "400") {
      handleManualRefreshToken(oauth);
    } else {
      throw new Error(e.message);
    }
  }
}

function handleManualRefreshToken(oauth: OAuth2Client): void {
  const authUrl = oauth.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });

  //need manual open url
  console.log(authUrl);

  const app = express();
  app.get("/redirect", (req, res) => {
    oauth.getToken(String(req.query.code), (err, tokens) => {
      if (tokens) {
        db.refresh_token = tokens.refresh_token;
        console.log("Refresh token saved");
        process.exit();
      }
    });
  });

  app.listen(process.env.PORT);
}
