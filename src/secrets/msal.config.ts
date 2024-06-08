import {
    ConfidentialClientApplication,
    Configuration,
    PublicClientApplication,
} from "@azure/msal-node";
import dotenv from "dotenv";

dotenv.config();

const scopes = ["https://graph.microsoft.com/.default"];

class MsalConfig {
    private msalConfig: Configuration;
    private ccaConfig: Configuration;
    private msalClient: ConfidentialClientApplication;
    private pca: PublicClientApplication;
    private cca: ConfidentialClientApplication;

    constructor() {
        this.msalConfig = this.msalConfigure();
        this.ccaConfig = this.ccaConfigure();
        this.pca = new PublicClientApplication(this.msalConfig);
        this.cca = new ConfidentialClientApplication(this.ccaConfig);
        this.msalClient = new ConfidentialClientApplication(this.msalConfig);
    }

    private ccaConfigure() {
        return {
            auth: {
                clientId: process.env.CLIENT_ID as string,
                authority: process.env.AUTH_URL as string,
                clientSecret: process.env.CLIENT_SECRET as string,
            },
            // cache: {
            //     cachePlugin, // Use the custom cache plugin
            // },
        };
    }

    private msalConfigure() {
        return {
            auth: {
                clientId: process.env.CLIENT_ID as string,
                authority: process.env.AUTH_URL as string,
                redirectUri: process.env.REDIRECT_URI as string,
                clientSecret: process.env.CLIENT_SECRET as string,
            },
            // cache: {
            //     cachePlugin, // Use the custom cache plugin
            // },
        };
    }

    public async getTokenFromCache(user: any) {
        try {
            const msalTokenCache = this.msalClient.getTokenCache();
            const account = await msalTokenCache.getAccountByHomeId(
                user.homeAccountId
            );

            if (!account) {
                throw new Error("Account not found in cache");
            }

            const tokenResponse = await this.msalClient.acquireTokenSilent({
                account,
                scopes,
            });

            return tokenResponse.accessToken;
        } catch (error: any) {
            console.error("Error getting token:", error.message);
            throw error; // Rethrow the error to propagate it up the call stack
        }
    }

    public async getTokenForResource(user: any, scopes: string[]) {
        try {
            const msalTokenCache = this.msalClient.getTokenCache();
            const account = await msalTokenCache.getAccountByHomeId(
                user.homeAccountId
            );

            if (!account) {
                throw new Error("Account not found in cache");
            }

            const tokenResponse = await this.msalClient.acquireTokenSilent({
                account,
                scopes,
            });

            return tokenResponse.accessToken;
        } catch (error: any) {
            console.error("Error getting token for resource:", error.message);
            throw error; // Rethrow the error to propagate it up the call stack
        }
    }

    public async getTokenByCredential() {
        const authResponse =
            await this.msalClient.acquireTokenByClientCredential({
                scopes,
            });
        return authResponse?.accessToken;
    }

    public msconfigFetch() {
        return this.msalConfig;
    }

    public ccaConfigFetch() {
        return this.ccaConfig;
    }

    public msalClientFetch() {
        return this.msalClient;
    }

    public pcaInstance() {
        return this.pca;
    }

    public ccaInstance() {
        return this.cca;
    }
}

export const msalConfig = new MsalConfig();
