import { Request, Response, Router } from "express";
import { msalConfig } from "../secrets/msal.config";
import { Client } from "@microsoft/microsoft-graph-client";
import { IResponse } from "../store/interfaces/response.interface";
import { EHttpStatusCode } from "../store/enums/http.status.code";
import ElasticService from "../services/elastic";
import {
    ConfidentialClientApplication,
    PublicClientApplication,
} from "@azure/msal-node";
import { v4 as uuidv4 } from "uuid";
import { microsoft_scopes } from "../secrets/scopes";

export const authRouter = Router();

const scopes = ["https://graph.microsoft.com/.default"];
// const scopes = ["User.Read"];

const pca: PublicClientApplication = msalConfig.pcaInstance();
const cca: ConfidentialClientApplication = msalConfig.ccaInstance();

authRouter.get("/login", (req: Request, res: Response) => {
    const authCodeUrlParameters = {
        scopes,
        redirectUri: process.env.REDIRECT_URI as string,
    };
    try {
        pca.getAuthCodeUrl(authCodeUrlParameters).then((response: any) => {
            res.redirect(response);
        });
    } catch (error: any) {
        const responseObj: IResponse = {
            data: null,
            message: "Error occurred while generating auth code URL.",
            meta: {
                error: true,
                message: error.message,
            },
        };
        res.status(error.status ?? EHttpStatusCode.BAD_GATEWAY).json(
            responseObj
        );
    }
});

authRouter.get("/callback", async (req: Request, res: Response) => {
    try {
        const pcaTokenRequest = {
            code: req.query.code as string,
            scopes: microsoft_scopes.scopes,
            redirectUri: process.env.REDIRECT_URI as string,
            clientSecret: process.env.CLIENT_SECRET,
        };

        const ccaTokenRequest = {
            scopes,
            clientSecret: process.env.CLIENT_SECRET,
        };

        const pcaResponse: any = await pca.acquireTokenByCode(pcaTokenRequest);

        // Log the entire response for debugging
        console.log("PCA Response: ", pcaResponse);

        if (!pcaResponse.refreshToken) {
            console.warn(
                "No refresh token received. Ensure the requested scope supports it and that you are using the correct authorization flow."
            );
        }

        const ccaResponse = await cca.acquireTokenByClientCredential(
            ccaTokenRequest
        );

        const sessionId = uuidv4();
        const userSession = {
            sessionId,
            username: pcaResponse.account?.username,
            homeAccountId: pcaResponse.account?.homeAccountId,
            refreshToken: pcaResponse.refreshToken, // Ensure this is not undefined
            accessToken: pcaResponse.accessToken,
            expiresOn: pcaResponse.expiresOn,
            clientAccessToken: ccaResponse?.accessToken,
        };

        console.log("userSession", userSession);

        (req.session as any).sessionId = sessionId;
        (req.session as any).accessToken = pcaResponse.accessToken;
        (req.session as any).clientAccessToken = ccaResponse?.accessToken;
        (req.session as any).refreshToken = pcaResponse.refreshToken;

        await ElasticService.createUserSession(userSession);

        await ElasticService.createUser({
            username: pcaResponse.account?.username,
            homeAccountId: pcaResponse.account?.homeAccountId,
            refreshToken: pcaResponse.refreshToken,
            accessToken: pcaResponse.accessToken,
            expiresOn: pcaResponse.expiresOn,
        });

        res.redirect("/auth/get-access-token");
    } catch (error: any) {
        const responseObj: IResponse = {
            data: null,
            message: "Error occurred while acquiring token.",
            meta: {
                error: true,
                message: error.message,
            },
        };
        res.status(error.status ?? EHttpStatusCode.BAD_GATEWAY).json(
            responseObj
        );
    }
});

authRouter.get("/get-access-token", async (req, res) => {
    try {
        res.send({
            message: "Access token acquired successfully!",
            clientAccessToken: (req.session as any).clientAccessToken,
            accessToken: (req.session as any).accessToken,
            sessionId: (req.session as any).sessionId,
            refreshToken: (req.session as any).refreshToken,
        });
    } catch (error: any) {
        res.status(500).send(error);
        console.log("Error acquiring access token:", error.message);
    }
});

authRouter.use("/get-mails/:num", async (req, res) => {
    const num = Number(req.params.num);

    try {
        const userAccessToken = (req.session as any).accessToken;
        const clientAccessToken = (req.session as any).clientAccessToken;

        // Check if the user and client are authenticated
        if (!userAccessToken) {
            return res
                .status(401)
                .send("User not authenticated. Please sign in first.");
        }

        if (!clientAccessToken) {
            return res
                .status(401)
                .send(
                    "Client not authenticated. Please acquire the client access token first."
                );
        }

        // Initialize the Microsoft Graph API client using the user access token
        const client = Client.init({
            authProvider: (done) => {
                done(null, userAccessToken);
            },
        });

        // Fetch the user's emails using the Microsoft Graph API
        const messages = await client.api("/me/messages").top(num).get();
        res.send(messages);
    } catch (error: any) {
        res.status(500).send(error);
        console.log("Error fetching messages:", error.message);
    }
});
