const Youtube = require("youtube-api"),
  fs = require("fs"),
  readJson = require("r-json"),
  Lien = require("lien"),
  Logger = require("bug-killer"),
  opn = require("opn");

const CREDENTIALS = readJson(`${__dirname}/client_secret.json`);

// Init lien server
let server = new Lien({
  host: "localhost",
  port: 4000,
});

let oauth = Youtube.authenticate({
  type: "oauth",
  client_id: CREDENTIALS.web.client_id,
  client_secret: CREDENTIALS.web.client_secret,
  redirect_url: CREDENTIALS.web.redirect_uris[0],
});

opn(
  oauth.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  })
);

// Handle oauth2 callback
server.addPage("/redirect", (lien) => {
  Logger.log(
    "Trying to get the token using the following code: " + lien.query.code
  );
  oauth.getToken(lien.query.code, (err, tokens) => {
    if (err) {
      lien.lien(err, 400);
      return Logger.log(err);
    }

    Logger.log("Got the tokens.");

    oauth.setCredentials(tokens);

    lien.end(
      "The video is being uploaded. Check out the logs in the terminal."
    );

    var req = Youtube.videos.insert(
      {
        resource: {
          // Video title and description
          snippet: {
            title: "Testing YoutTube API NodeJS module",
            description: "Test video upload via YouTube API",
          },
          // I don't want to spam my subscribers
          status: {
            privacyStatus: "private",
          },
        },
        // This is for the callback function
        part: "snippet,status",

        // Create the readable stream to upload the video
        media: {
          body: fs.createReadStream("7194338710186380549.mp4"),
        },
      },
      (err, data) => {
        console.log("Done.");
        process.exit();
      }
    );
  });
});
