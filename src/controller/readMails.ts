import imaps from "imap-simple";
import { simpleParser } from "mailparser";
import ElasticService from "../services/elastic";
import cron from "node-cron";

const config = {
    imap: {
        user: "", // user's email address
        xoauth2: "",
        host: "outlook.office365.com",
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 3000,
        password: "",
    },
};

const generateOAuth2String = (email: string, token: string) => {
    return `user=${email}\x01auth=Bearer ${token}\x01\x01`;
};

const fetchEmails = async () => {
    try {
        const allUserSessions = (
            await ElasticService.getAll("sessions")
        ).hits.hits.map((session: any) => session._source);

        for (let userSession of allUserSessions) {
            let accessToken = userSession.accessToken;
            const refreshToken = userSession.refreshToken;

            if (isTokenExpired(userSession.expiresOn)) {
                try {
                    const newTokens = await refreshAccessToken(refreshToken);
                    accessToken = newTokens.accessToken;
                    userSession.accessToken = accessToken;
                    userSession.refreshToken = newTokens.refreshToken;
                    await ElasticService.update(
                        "sessions",
                        userSession.sessionId,
                        userSession
                    );
                } catch (refreshError) {
                    console.error(
                        `Error refreshing token for user: ${userSession.userMail}`,
                        refreshError
                    );
                    continue; // Skip this user session if token refresh fails
                }
            }

            config.imap.user = userSession.userMail;
            config.imap.xoauth2 = generateOAuth2String(
                userSession.userMail,
                accessToken
            );

            console.log(`Connecting to IMAP for user: ${config.imap.user}`);

            try {
                const connection = await imaps.connect({ imap: config.imap });
                await connection.openBox("INBOX");

                const searchCriteria = ["UNSEEN"];
                const fetchOptions = {
                    bodies: ["HEADER", "TEXT"],
                    markSeen: true,
                };

                const messages = await connection.search(
                    searchCriteria,
                    fetchOptions
                );

                for (const item of messages) {
                    const all = item.parts.find(
                        (part) => part.which === "TEXT"
                    );
                    const id = item.attributes.uid;
                    const idHeader = "Imap-Id: " + id + "\r\n";
                    const mail = await simpleParser(idHeader + all?.body);

                    await ElasticService.saveEmail(mail);
                }

                console.log(
                    `Fetched and saved emails for user: ${userSession.username}`
                );
            } catch (imapError: any) {
                console.error(
                    `IMAP connection error for user: ${config.imap.user}`,
                    imapError.message
                );
            }
        }
    } catch (error: any) {
        console.error("Error fetching emails:", error.message);
    }
};

// Fetch emails every 5 minutes
cron.schedule("*/1 * * * *", fetchEmails);

const isTokenExpired = (expiresOn: string): boolean => {
    const expiryDate = new Date(expiresOn);
    return expiryDate < new Date();
};

const refreshAccessToken = async (refreshToken: string) => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    const urlencoded = new URLSearchParams();
    urlencoded.append("client_id", process.env.CLIENT_ID as string);
    urlencoded.append("grant_type", "refresh_token");
    urlencoded.append("refresh_token", refreshToken);
    urlencoded.append("client_secret", process.env.CLIENT_SECRET as string);
    urlencoded.append("scope", "IMAP.AccessAsUser.All");

    const requestOptions: RequestInit = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow",
    };

    const response = await fetch(
        `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
        requestOptions
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Error refreshing token:", errorText);
        throw new Error(errorText);
    }

    const result = await response.json();
    return {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
    };
};
