import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export const ENVIRONMENT = process.env.NODE_ENV;
export const AWS_CATALOGS_URL = process.env.AWS_CATALOGS_URL;
export const AWS_CONTEXT_URL = process.env.AWS_CONTEXT_URL;
export const AWS_OAUTH_HOST = process.env.AWS_OAUTH_HOST;
export const AWS_CLIENT_ID = process.env.AWS_CLIENT_ID;
export const AWS_CLIENT_SECRET = process.env.AWS_CLIENT_SECRET;

export const SFDC_USERNAME = process.env.SFDC_USERNAME;
export const SFDC_PASSWORD = process.env.SFDC_PASSWORD;
export const SFDC_ORG = process.env.SFDC_ORG;
export const SFDC_CONTEXT_URL = process.env.SFDC_CONTEXT_URL;
export const SFDC_GETOFFERS_URL = process.env.SFDC_GETOFFERS_URL;

const prod = ENVIRONMENT === "production";

export const SESSION_SECRET = process.env["SESSION_SECRET"];