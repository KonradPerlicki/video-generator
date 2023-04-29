declare module "reddit-types" {
  export interface Post {
    score: number;
    num_comments: number;
    id: string;
    subreddit_id: string;
    over_18: boolean;
    ups: number;
    upvote_ratio: number;
    downs: number;
    title: string;
    selftext: string;
    subreddit: string;
    [key: string]: unknown;
  }
  export interface ListingChildren {
    kind: string;
    data: Post[];
  }
  export interface ListingData {
    after: null | string;
    dist: number;
    modhash: null | string;
    geo_filter: string;
    children: ListingChildren[];
    before: null | string;
  }
  export interface Listing {
    kind: "Listing";
    data: ListingData;
  }
}
