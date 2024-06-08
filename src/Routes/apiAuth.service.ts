import { Router } from "express";
import dotenv from "dotenv";
import ElasticService from "../services/elastic";
import { v4 as uuidv4 } from "uuid";

dotenv.config();
export const apiAuthRouter = Router();

const envs = {
    CLIENT_ID: process.env.CLIENT_ID,
    TENANT_ID: process.env.TENANT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    REDIRECT_URI: process.env.REDIRECT_URI,
    SCOPES: ["user.read", "offline_access", "mail.read"],
};

if (
    !envs.CLIENT_ID ||
    !envs.CLIENT_SECRET ||
    !envs.AUTH_URL ||
    !envs.REDIRECT_URI ||
    !envs.TENANT_ID
) {
    throw new Error("Please provide the required environment variables");
}

apiAuthRouter.get("/login", (req, res) => {
    res.redirect(
        `${envs.AUTH_URL}/${envs.TENANT_ID}/oauth2/v2.0/authorize?client_id=${
            envs.CLIENT_ID
        }&response_type=code&redirect_uri=${
            envs.REDIRECT_URI
        }&response_mode=query&scope=${encodeURIComponent(
            envs.SCOPES.join(" ")
        )}&state=12345`
    );
});

apiAuthRouter.get("/callback", async (req, res) => {
    const code = req.query.code as string;

    if (!code) {
        return res.status(400).send("Authorization code is missing");
    }

    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    const urlencoded = new URLSearchParams();
    urlencoded.append("client_id", envs.CLIENT_ID as string);
    urlencoded.append("scope", envs.SCOPES.join(" "));
    urlencoded.append("code", code);
    urlencoded.append("redirect_uri", envs.REDIRECT_URI as string);
    urlencoded.append("grant_type", "authorization_code");
    urlencoded.append("client_secret", envs.CLIENT_SECRET as string);

    const requestOptions: RequestInit = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow",
    };

    try {
        const response = await fetch(
            `https://login.microsoftonline.com/${envs.TENANT_ID}/oauth2/v2.0/token`,
            requestOptions
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error fetching token:", errorText);
            return res.status(response.status).send(errorText);
        }

        const result = await response.json();

        const sessionId = uuidv4();
        (req.session as any).accessToken = result.access_token;
        (req.session as any).refreshToken = result.refresh_token;
        (req.session as any).sessionId = sessionId;
        (req.session as any).expiresOn = Date.now() + result.expires_in * 1000;
        (req.session as any).scope = result.scope;

        res.redirect("/auth/success");
    } catch (error) {
        console.error("Error during token exchange:", error);
        res.status(500).send("Internal Server Error");
    }
});

apiAuthRouter.get("/success", async (req, res) => {
    const accessToken = (req.session as any).accessToken;
    const refreshToken = (req.session as any).refreshToken;

    if (!accessToken || !refreshToken) {
        return res.status(400).send("Access token or refresh token is missing");
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        return res.status(response.status).send("Error fetching user data");
    }

    const user = await response.json();

    const userSession = {
        sessionId: (req.session as any).sessionId,
        accessToken,
        refreshToken,
        username: user.displayName,
        userMail: user.mail,
        userMobile: user.mobilePhone,
        userId: user.id,
        userPrincipalName: user.userPrincipalName,
        scope: (req.session as any).scope,
        expiresOn: (req.session as any).expiresOn,
    };

    await ElasticService.createUserSession(userSession);
    await ElasticService.createUser({
        username: userSession.username,
        homeAccountId: userSession.userId,
        refreshToken: userSession.refreshToken,
        accessToken: userSession.accessToken,
        expiresOn: userSession.expiresOn,
        userMail: userSession.userMail,
        scope: userSession.scope,
    });

    res.send(user);
});
