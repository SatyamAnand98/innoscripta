/**
 * Represents a response object. This is the base interface for all response objects.
 * This shows the error or success status of the response.
 * @interface
 * @property {boolean} error - The error status of the response.
 * @property {string} message - The message to be returned in the response.
 */
interface IMeta {
    error: boolean;
    message: string;
}

/**
 * Represents a success response object.
 * This interface extends the IMeta interface.
 * @interface
 * @extends {IMeta}
 * @property {any} data - The data to be returned in the response.
 * @property {string} message - The message to be returned in the response.
 */
export interface IResponse {
    data: any;
    message: string;
    meta: IMeta;
}
