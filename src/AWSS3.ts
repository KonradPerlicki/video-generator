import { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { join } from "path";
import { Readable } from "stream";

const client = new S3Client({
  region: "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
});

export async function saveSpeechFiles(objectsKey: string[], savePath: string) {
  console.log("objects to fetch:", objectsKey);

  for (const key of objectsKey) {
    const command = new GetObjectCommand({
      Key: key,
      Bucket: process.env.AWS_BUCKETNAME as string,
    });

    const response = await client.send(command);

    await new Promise((resolve, reject) => {
      if (response.Body && response.Body instanceof Readable) {
        response.Body.pipe(fs.createWriteStream(join(savePath, key)))
          .on("error", (err) => reject(err))
          .on("close", async () => {
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
    console.log(`Deleted ${key} object`);
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
