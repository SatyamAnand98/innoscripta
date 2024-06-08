/**
 * Represents the interface for default route.
 */
interface IDefaultRoute {
    path: string;
    router: any;
}

/**
 * Represents the interface for array of IDefaultRoute.
 */
export interface IDefaultRoutes extends Array<IDefaultRoute> {}
