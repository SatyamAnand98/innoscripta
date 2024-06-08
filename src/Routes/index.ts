import { IDefaultRoutes } from "../store/interfaces/defaultRoutes.interface";
import { apiAuthRouter } from "./apiAuth.service";
// import { authRouter } from "./authService";

// Path: src/Routes/index.ts
/**
 * Represents the default routes.
 * @type {Array<{ path: string; router: Router }>}
 * @constant
 * @default
 * @public
 * @readonly
 */
export const defaultRoutes: IDefaultRoutes = [
    {
        path: "/auth",
        router: apiAuthRouter,
    },
];
