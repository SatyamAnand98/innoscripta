import { v4 as uuidv4 } from "uuid";
import { NextFunction, Request, Response } from "express";
import elasticClient from "../../services/elastic";

export const logger = (req: Request, res: Response, next: NextFunction) => {
    try {
        const requestId = uuidv4();
        const start = Date.now();

        // Log request details
        elasticClient.index("logs", {
            requestId,
            state: "request",
            method: req.method,
            url: req.url,
            body: req.body,
        });

        // /**
        // // Capture the original send function
        // const originalSend = res.send;

        // // Create a new send function to capture the response body
        // res.send = function (body) {
        //     const duration = Date.now() - start;

        //     // Ensure body is stringified if it's not an object
        //     const responseBody =
        //         typeof body === "object" ? body : JSON.parse(body);

        //     elasticClient.index("logs", {
        //         requestId,
        //         state: "response",
        //         method: req.method,
        //         url: req.url,
        //         status: res.statusCode,
        //         responseTime: duration,
        //         body: responseBody,
        //     });

        //     // Call the original send function with the body
        //     return originalSend.call(this, body);
        // };

        // next();
        // */
    } catch (error: any) {
        console.error("Error in logger: ", error.message);
    } finally {
        next();
    }
};
