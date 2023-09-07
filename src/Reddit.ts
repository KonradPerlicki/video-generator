import axios from "axios";
import qs from "qs";
import { Listing, ListingData, Post } from "reddit-types";

export default class Reddit {
  private readonly credentrials: string;
  private readonly paragraphsPerSlide: number;
  private readonly ssmlSpeechSpeed = "115%";

  constructor(private maxRetries = 5, private readonly limit = 5) {
    this.paragraphsPerSlide = Number(process.env.PARAGRAPHS_PER_SLIDE);
    this.credentrials = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString(
      "base64"
    );
  }

  private async getAccessToken() {
    const data = qs.stringify({
      grant_type: "refresh_token",
      username: process.env.REDDIT_USERNAME,
      refresh_token: process.env.REFRESH_TOKEN,
    });

    try {
      return await axios({
        method: "post",
        url: "https://www.reddit.com/api/v1/access_token",
        headers: {
          Authorization: `Basic ${this.credentrials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data,
      });
    } catch (e) {
      console.log("There was an error while getting access token: ", e);
      return null;
    }
  }

  public async getFirstPostWithLength(subreddit: string, length: number): Promise<Post | null> {
    const postListing = await this.getListing(subreddit);
    if (!postListing) return null;

    const acceptableLength = length * 0.35;

    for (const { data: post } of postListing.children) {
      if (this.checkPostContentLength(post, length, acceptableLength)) {
        return post;
      }
    }

    console.log("No posts found with given length: %d +/- %d", length, acceptableLength);
    return null;
  }

  private checkPostContentLength(post: Post, length: number, acceptableLength: number): boolean {
    const strippedHtmlTags = post.selftext_html.replace(/<\/?[^>]+(>|$)/g, "");
    return (
      length - acceptableLength < strippedHtmlTags.length &&
      strippedHtmlTags.length < length + acceptableLength
    );
  }

  private async getListing(subreddit: string): Promise<ListingData | null> {
    this.maxRetries--;
    const accessTokenResponse = await this.getAccessToken();

    if (accessTokenResponse && accessTokenResponse.data.access_token) {
      const accessToken = accessTokenResponse.data.access_token;

      const postListing = await axios<Listing>({
        method: "get",
        url: `https://oauth.reddit.com/r/${subreddit}/top`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          limit: this.limit,
          raw_json: 1,
        },
      });

      if (postListing.data) {
        return postListing.data.data;
      } else {
        console.log("An error occured while getting list of posts...");
      }
    } else {
      console.log("Access token does not exist in response");
    }

    if (this.maxRetries > 0) {
      return this.getListing(subreddit);
    } else {
      return null;
    }
  }

  public getDividedParagraphsFromPost(post: Post): string[] {
    const strippedHtmlTags = post.selftext_html.replace(/<\/?[^>]+(>|$)/g, "");
    const paragraphsArray = strippedHtmlTags.split("\n\n");
    const result: string[] = [];

    result.push(this.wrapTextInSsmlTag(post.title));

    let tmp: string[] = [];
    for (const paragraph of paragraphsArray) {
      if (paragraph.trim().length === 0 || paragraph === "&#x200B;") continue;

      tmp.push(paragraph);

      if (tmp.length === this.paragraphsPerSlide) {
        result.push(this.wrapTextInSsmlTag(tmp.join(" ")));
        tmp = [];
      }
    }

    //in case when total number of paragraphs is not dividable by this.paragraphsPerSlide
    if (tmp.length > 0) {
      result.push(this.wrapTextInSsmlTag(tmp.join(" ")));
    }

    return result;
  }

  private wrapTextInSsmlTag(text: string): string {
    return `<speak><prosody rate="${this.ssmlSpeechSpeed}">${text}</prosody></speak>`;
  }
}
