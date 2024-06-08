// src/msalCachePlugin.js
import fs from "fs";
import path from "path";

const cacheFilePath = path.join(__dirname, "msalCache.json");

const beforeCacheAccess = async (cacheContext: any) => {
    if (fs.existsSync(cacheFilePath)) {
        const cacheData = fs.readFileSync(cacheFilePath);
        cacheContext.tokenCache.deserialize(cacheData.toString());
    }
};

const afterCacheAccess = async (cacheContext: any) => {
    if (cacheContext.cacheHasChanged) {
        const cacheData = cacheContext.tokenCache.serialize();
        fs.writeFileSync(cacheFilePath, cacheData);
    }
};

export const cachePlugin = {
    beforeCacheAccess,
    afterCacheAccess,
};
