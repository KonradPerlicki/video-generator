import axios from "axios";
import qs from "qs";
import { Listing, Post } from "reddit-types";

const subreddit = "nosleep";

export default class Reddit {
  private credentrials: string;

  constructor(private readonly paragraphsPerSlide: number, private limit = 1) {
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

  public async getListing() {
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

    //If posts were not returned, cancel running script
    process.exit();
  }

  public getDividedParagraphsFromPost(post: Post) {
    const strippedHtmlTags = post.selftext_html.replace(/<\/?[^>]+(>|$)/g, "");
    const paragraphsArray = strippedHtmlTags.split("\n\n");
    const result: string[] = [];
    const ssmlOpeningTag = `<speak><prosody rate="115%">`;
    const ssmlClosingTag = `</prosody></speak>`;

    result.push(`${ssmlOpeningTag}${post.title}${ssmlClosingTag}`);

    let tmp: string[] = [];
    for (const paragraph of paragraphsArray) {
      if (paragraph.trim().length === 0 || paragraph === "&#x200B;") continue;

      tmp.push(paragraph);

      if (tmp.length === this.paragraphsPerSlide) {
        result.push(`${ssmlOpeningTag}${tmp.join(" ")}${ssmlClosingTag}`);
        tmp = [];
      }
    }

    //in case when total number of paragraphs is not dividable by this.paragraphsPerSlide
    if (tmp.length > 0) {
      result.push(`${ssmlOpeningTag}${tmp.join(" ")}${ssmlClosingTag}`);
    }

    return result;
  }
}
