import { AWS_OAUTH_HOST, AWS_CLIENT_ID, AWS_CLIENT_SECRET, SFDC_ORG } from "../util/secrets";
const jsforce = require('jsforce');

/* SFDC Conn */
export const conn = new jsforce.Connection({
    loginUrl : `https://${SFDC_ORG}.salesforce.com`
});

/* AWS Conn */
export const oauthConfig = {
    client: {
      id: AWS_CLIENT_ID,
      secret: AWS_CLIENT_SECRET
    },
    auth: {
      tokenHost: AWS_OAUTH_HOST,
      authorizePath: "/oauth2/authorize",
      tokenPath: "/oauth2/token",
      revokePath: "/oauth2/token/revoke"
    }
};

export const requestOptions = {
    headers: {
        "Content-Type":"application/json"
    },
    time: true,
    json: true
}