import cors from "cors"; // Import cors package
import dotenv from "dotenv"; // Import dotenv package for environment variables usage
import express from "express"; // Import express package for creating the express application
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit"; // Import express-rate-limit package for rate limiting
import session from "express-session"; // Import express-session package for session management
import { defaultRoutes } from "./Routes"; // Import default routes from the Routes folder
import { msalConfig } from "./secrets/msal.config"; // Import MSAL configuration for authentication of the microsoft graph client
import { RATE_LIMITER } from "./secrets/rateLimiter"; // Import rate limiter configuration from secrets for rate limiting of requests to the server
import { logger } from "./store/logger/elastic.logger";
import { EHttpStatusCode } from "./store/enums/http.status.code";
import bodyParser from "body-parser";
import { IResponse } from "./store/interfaces/response.interface";
import ElasticService from "./services/elastic";
import "./controller/readMails";

dotenv.config();

/**
 * Represents the main application class.
 */
class App {
    public app: express.Application; // The express application instance
    public port: number; // The port number on which the application listens
    private limiter: RateLimitRequestHandler = rateLimit(RATE_LIMITER); // The rate limiter middleware

    /**
     * Creates an instance of the App class.
     * @constructor
     */
    constructor() {
        // Initialize configurations
        this.configs();

        // Create an instance of the express app
        this.app = express();

        // Set the port number from the environment variable or use the default port 9200
        this.port = process.env.PORT ? parseInt(process.env.PORT) : 9200;

        // Initialize middlewares
        this.initializeMiddlewares();

        // Initialize default route
        this.defaultRoute();

        // Initialize routes
        this.initializeRoutes();

        // Delete all logs
        // this.deleteAllLogs();
    }

    /**
     * Configures the application.
     */
    private configs() {
        // Initialize MSAL configuration
        msalConfig;
        // readMails(); // Read mails from the Microsoft Graph API
    }

    /**
     * Initializes the middlewares.
     */
    private initializeMiddlewares() {
        /**
         * Use the express.json() middleware to parse the request body.
         * This middleware is used to parse the incoming request body in JSON format.
         */
        this.app.use(express.json());

        // Use the body-parser middleware to parse the request body
        // This middleware is used to parse the incoming request body
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        /**
         * Use the express.urlencoded() middleware to parse the request body.
         * This middleware is used to parse the incoming request body in URL-encoded format.
         */
        this.app.use(express.urlencoded({ extended: true }));

        /**
         * Use the cors() middleware to enable CORS.
         * This middleware is used to enable Cross-Origin Resource Sharing (CORS) in the express application.
         */
        this.app.use(cors());

        /**
         * Use the rate limiter middleware to limit the number of requests to the server.
         * This middleware is used to limit the number of requests to the server based on the configuration provided.
         */
        this.app.use(this.limiter);

        /**
         * Use the express-session middleware for session management.
         * This middleware is used to manage the session in the express application.
         */
        this.app.use(
            session({
                secret:
                    (process.env.AUTH_SECRET as string) ||
                    (() => {
                        throw new Error("AUTH_SECRET is not defined");
                    })(),
                resave: false,
                saveUninitialized: false,
            })
        );

        /**
         * Use the logger middleware to log the requests and responses.
         * This middleware is used to log the requests and responses to the server.
         */
        this.app.use(logger);
    }

    private deleteAllLogs() {
        ElasticService.deleteAll("logs");
        ElasticService.deleteAll("users");
        ElasticService.deleteAll("sessions");
    }

    /**
     * Initializes the routes.
     */
    private initializeRoutes() {
        try {
            defaultRoutes.forEach((route) => {
                this.app.use(route.path, route.router);
            });
        } catch (error: any) {
            console.error(
                "Error occurred while initializing routes: ",
                error.message
            );
        }
    }

    /**
     * Initializes the default route.
     */
    private defaultRoute() {
        const responseObj: IResponse = {
            data: null,
            message: "Welcome to INNOSCRIPTA!",
            meta: {
                error: false,
                message: "Welcome to INNOSCRIPTA!",
            },
        };
        this.app.get("/", (req, res) => {
            res.redirect("http://localhost:9200/auth/login");
            // res.status(EHttpStatusCode.OK).json(responseObj);
        });
    }

    /**
     * Starts the application and listens on the specified port.
     */
    public start() {
        this.app.listen(this.port, () => {
            console.log(`🟢 App listening on the port ${this.port}`);
        });
    }
}

// Create an instance of the App class
const app = new App();
app.start();
