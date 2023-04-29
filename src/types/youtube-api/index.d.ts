// Type definitions for youtube-api 3.0
// Project: https://www.npmjs.com/package/youtube-api
// Definitions by: Konrad Perlicki <https://github.com/KonradPerlicki>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare module "youtube-api" {
  import { GoogleApis } from "googleapis";
  import { OAuth2Client } from "google-auth-library/build/src/index";
  import {youtube_v3} from "googleapis/build/src/apis/youtube"
  
  export interface AuthOptions {
    type: "oauth" | "key";
    client_id: string;
    client_secret: string;
    redirect_url: string;
  }

  interface GoogleApisContext {
    _options: {};
    /**
     * For exact typings check /node_modules/googleapis/build/src/googleapis.d.ts
     */
    google: GoogleApis;
}

  export interface EmptyAuthConfig {
    auth: undefined;
  }

  interface Params$Resource$GuideCategories$List {
    /**
     * The part parameter specifies the guideCategory resource properties that the API response will include. Set the parameter value to snippet.
     */
    part: string;

    /**
     * The id parameter specifies a comma-separated list of the YouTube channel category ID(s) for the resource(s) that are being retrieved. In a guideCategory resource, the id property specifies the YouTube channel category ID.
     */
    id?: string;

    /**
     * The regionCode parameter instructs the API to return the list of guide categories available in the specified country. The parameter value is an ISO 3166-1 alpha-2 country code.
     */
    regionCode?: string;

    /**
     * The hl parameter specifies the language that will be used for text values in the API response. The default value is en-US.
     */
    hl?: string;
}

interface Schema$GuideCategories {
    /**
     * Identifies the API resource's type. The value will be youtube#guideCategory.
     */
    kind?: string | null;

    /**
     * The Etag of this resource.
     */
    etag?: string | null;

    /**
     * The ID that YouTube uses to uniquely identify the guide category.
     */
    id?: string | null;

    snippet?: {
        /**
         * The ID that YouTube uses to uniquely identify the channel publishing the guide category.
         */
        channelId?: string | null;

        /**
         * The category's title.
         */
        title?: string | null;
    };
}

interface Schema$GuideCategoriesResponse {
    /**
     * Identifies the API resource's type. The value will be youtube#guideCategoryListResponse.
     */
    kind?: string | null;

    /**
     * The Etag of this resource.
     */
    etag?: string | null;

    /**
     * The token that can be used as the value of the pageToken parameter to retrieve the next page in the result set.
     */
    nextPageToken?: string | null;

    /**
     * The token that can be used as the value of the pageToken parameter to retrieve the previous page in the result set.
     */
    prevPageToken?: string | null;

    /**
     * The pageInfo object encapsulates paging information for the result set.
     */
    pageInfo?: youtube_v3.Schema$PageInfo;

    /**
     * A list of categories that can be associated with YouTube channels. In this map, the category ID is the map key, and its value is the corresponding guideCategory resource.
     */
    items?: Schema$GuideCategories[];
}

declare class Resource$GuideCategories {
    context: APIRequestContext;
    constructor(context: APIRequestContext);
    list(params: Params$Resource$GuideCategories$List, options: StreamMethodOptions): GaxiosPromise<Readable>;
    list(
        params?: Params$Resource$GuideCategories$List,
        options?: MethodOptions,
    ): GaxiosPromise<Schema$GuideCategoriesResponse>;
    list(
        params: Params$Resource$GuideCategories$List,
        options: StreamMethodOptions | BodyResponseCallback<Readable>,
        callback: BodyResponseCallback<Readable>,
    ): void;
    list(
        params: Params$Resource$GuideCategories$List,
        options: MethodOptions | BodyResponseCallback<Schema$GuideCategoriesResponse>,
        callback: BodyResponseCallback<Schema$GuideCategoriesResponse>,
    ): void;
    list(
        params: Params$Resource$GuideCategories$List,
        callback: BodyResponseCallback<Schema$GuideCategoriesResponse>,
    ): void;
    list(callback: BodyResponseCallback<Schema$GuideCategoriesResponse>): void;
}

interface YoutubeApi {
    new (config?: unknown): {};

    activities: youtube_v3.Resource$Activities;
    captions: youtube_v3.Resource$Captions;
    channelBanners: youtube_v3.Resource$Channelbanners;
    channels: youtube_v3.Resource$Channels;
    channelSections: youtube_v3.Resource$Channelsections;
    comments: youtube_v3.Resource$Comments;
    commentThreads: youtube_v3.Resource$Commentthreads;
    i18nLanguages: youtube_v3.Resource$I18nlanguages;
    i18nRegions: youtube_v3.Resource$I18nregions;
    liveBroadcasts: youtube_v3.Resource$Livebroadcasts;
    liveChatBans: youtube_v3.Resource$Livechatbans;
    liveChatMessages: youtube_v3.Resource$Livechatmessages;
    liveChatModerators: youtube_v3.Resource$Livechatmoderators;
    liveStreams: youtube_v3.Resource$Livestreams;
    members: youtube_v3.Resource$Members;
    membershipsLevels: youtube_v3.Resource$Membershipslevels;
    playlistItems: youtube_v3.Resource$Playlistitems;
    playlists: youtube_v3.Resource$Playlists;
    search: youtube_v3.Resource$Search;
    /**
     * @deprecated
     */
    guideCategories: Resource$GuideCategories;
    /**
     * @deprecated
     * Use members instead
     * It redirects to the members property
     */
    sponsors: youtube_v3.Resource$Members;
    superChatEvents: youtube_v3.Resource$Superchatevents;
    videoCategories: youtube_v3.Resource$Videocategories;
    videos: youtube_v3.Resource$Videos;
    watermarks: youtube_v3.Resource$Watermarks;

    /**
     * Sets an authentication method to have access to protected resources.
     */
    authenticate(options: AuthOptions): OAuth2Client;
    authenticate(): void;

    /**
     * Returns Client configuration object
     */
    getConfig(): Readonly<{} | AuthOptions | EmptyAuthConfig>;

    context: GoogleApisContext;
}

  const youtube: YoutubeApi;
  export default youtube;
}
