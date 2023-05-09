import { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import { join } from "path";
import { Readable } from "stream";

const client = new S3Client({
  region: "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
});

export async function saveSpeechFiles(objectsKey: string[]) {
  console.log("Objects to fetch:", objectsKey);

  for (const key of objectsKey) {
    const command = new GetObjectCommand({
      Key: key,
      Bucket: process.env.AWS_BUCKETNAME as string,
    });

    const response = await client.send(command);

    await new Promise((resolve, reject) => {
      if (response.Body && response.Body instanceof Readable) {
        response.Body.pipe(createWriteStream(join(__dirname, "..", "mp3", key)))
          .on("error", (err) => {
            console.log(`Failed to download file ${key}`);
            reject(err);
          })
          .on("close", async () => {
            console.log(`Successfully downloaded file ${key}`);
            await deleteObject(key, response.VersionId);
            resolve(true);
          });
      }
    });
  }
}

export async function deleteObject(key: string, versionId?: string) {
  const command = new DeleteObjectCommand({
    Key: key,
    VersionId: versionId,
    Bucket: process.env.AWS_BUCKETNAME as string,
  });

  const res = await client.send(command);

  if (res.$metadata.httpStatusCode === 204) {
    console.log(`Deleted ${key} object from S3 bucket`);
  } else {
    console.log(`Could not delete object ${key}`);
  }
}

export async function getObjectsListing() {
  const listing = new ListObjectsV2Command({
    Prefix: "reddit",
    Bucket: process.env.AWS_BUCKETNAME as string,
  });

  const response = await client.send(listing);
  return response.Contents;
}

export async function removeSpeechFiles() {
  console.log("Removing all speech files...");

  for (const file of await fs.readdir(join(__dirname, "..", "mp3"))) {
    await fs.unlink(join(__dirname, "..", "mp3", file));
  }

  console.log("Speech files removed");
}
