import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

class ElasticService {
    private static instance: ElasticService;
    private client: Client;

    private constructor() {
        const elasticConfig = {
            cloudID: process.env.ELASTIC_CLOUD_ID,
            username: process.env.ELASTIC_USERNAME,
            password: process.env.ELASTIC_PASSWORD,
            endpoint: process.env.ELASTIC_ENDPOINT,
        };

        // Check if elasticConfig has all the required properties and none is null or undefined
        if (
            !elasticConfig.cloudID ||
            !elasticConfig.username ||
            !elasticConfig.password ||
            !elasticConfig.endpoint
        ) {
            throw new Error("Elasticsearch configuration is missing.");
        }

        // Create an Elasticsearch client instance
        this.client = new Client({
            node: elasticConfig.endpoint,
            cloud: {
                id: elasticConfig.cloudID,
            },
            auth: {
                username: elasticConfig.username,
                password: elasticConfig.password,
            },
        });

        this.client.info().catch((error) => console.error(error));
    }

    public static getInstance(): ElasticService {
        if (!ElasticService.instance) {
            ElasticService.instance = new ElasticService();
        }
        return ElasticService.instance;
    }

    public search(index: string, query: any): Promise<any> {
        return this.client.search({
            index,
            body: query,
        });
    }

    public async getUser(email: string): Promise<any> {
        return (
            await this.client.search({
                index: "users",
                body: {
                    query: {
                        match: {
                            userMail: email,
                        },
                    },
                },
            })
        ).hits.hits[0]?._source;
    }

    public async getuserSession(emailId: string): Promise<any> {
        return (
            await this.client.search({
                index: "sessions",
                body: {
                    query: {
                        match: {
                            emailId,
                        },
                    },
                },
            })
        ).hits.hits[0]?._source;
    }

    public async createUser(user: any): Promise<any> {
        if (await this.getUser(user.username)) {
            return;
        }

        return await this.client.index({
            index: "users",
            body: user,
        });
    }

    public async getAllUsers(): Promise<any> {
        let users = (
            await this.client.search({
                index: "users",
                body: {
                    query: {
                        match_all: {},
                    },
                },
            })
        ).hits.hits;

        users = users.map((user: any) => user._source);

        return users;
    }

    public async createUserSession(userSession: any): Promise<any> {
        if (await this.getuserSession(userSession.userMail)) {
            return;
        }
        return await this.client.index({
            index: "sessions",
            body: userSession,
        });
    }

    public async saveEmail(email: any) {
        try {
            await this.client.index({
                index: "emails",
                body: email,
            });
            console.log("Email saved to Elasticsearch");
        } catch (error) {
            console.error("Error saving email to Elasticsearch:", error);
        }
    }

    public index(index: string, body: any): Promise<any> {
        return this.client.index({
            index,
            body,
        });
    }

    public update(index: string, id: string, body: any): Promise<any> {
        return this.client.update({
            index,
            id,
            body: {
                doc: body,
            },
        });
    }

    public async updateSessionUsingSessionId(sessionId: string, body: any) {
        return this.client.update({
            index: "sessions",
            id: sessionId,
            body: {
                doc: body,
            },
        });
    }

    public delete(index: string, id: string): Promise<any> {
        return this.client.delete({
            index,
            id,
        });
    }

    public get(index: string, id: string): Promise<any> {
        return this.client.get({
            index,
            id,
        });
    }

    public async updateUserSession(
        sessionId: string,
        userSession: any
    ): Promise<any> {
        return this.client.update({
            index: "sessions",
            id: sessionId,
            body: {
                doc: userSession,
            },
        });
    }

    public async getAll(index: string): Promise<any> {
        return this.client.search({
            index,
            _source: ["_id", "*"],
        });
    }

    public deleteAll(index: string): Promise<any> {
        return this.client.deleteByQuery({
            index,
            body: {
                query: {
                    match_all: {},
                },
            },
        });
    }
}

export default ElasticService.getInstance();
