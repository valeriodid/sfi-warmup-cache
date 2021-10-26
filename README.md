# Warmup-Cache

### `npm i`

Install all the dependencies

### `npm run build`

Builds the app for production to the `build` folder.

### `npm start`

Runs the application.
Open [http://localhost:5000](http://localhost:5000) to view it locally in the browser .

### `nodemon src/server.ts`

The page will reload if you make edits.

### WARMUP BASKET API
warmup BasketAPIs

* `POST http://localhost:5000/api/exec_warmup_cache_basket`

Request Body:
```json
{
    "fileCSV": "<file>",
    "catalogCode": "<string>",
    "concurrentRequests": "<number>",
    "limit": "<number>",
    "platform": "AWS or SFDC"
}
```
`fileCSV`: Your CSV File

`catalogCode`: Catalog Code you will use for the getOffers APIs

`concurrentRequests`: Number of concurrent requests will be processed every each block

`limit`: Number of file rows will be processed

`platform` : Name of platform you want to direct integrate with your calls. `AWS` or `SFDC`

###  CSV Example File

| RootProductCombinations | Childs |
| ----------------------- | ------ |
| Football | |
| Sport | |
| Cinema | |
| Entertainment | |
| Entertainment\|EntertainmentPlus | |
| Entertainment\|EntertainmentPlus | "{'EntertainmentPlus':['Netflix']}" |
| Entertainment\|EntertainmentPlus\|Sport | "{'EntertainmentPlus':['Netflix']}" |
| Entertainment\|EntertainmentPlus\|Sport\|Cinema | "{'EntertainmentPlus':['Netflix']}" |
| Entertainment\|EntertainmentPlus\|Sport\|Cinema\|PlatformIP | "{'EntertainmentPlus':['Netflix']}" |

### .env File

SFDC Config
```json
SFDC_USERNAME={{salesforce_username}}
SFDC_PASSWORD={{salesforce_psw}}
SFDC_ORG=login or test
SFDC_CONTEXT_URL=/vlocity_cmt/v3/context
SFDC_URL=/vlocity_cmt/v3/catalogs
```

AWS Config
```json
AWS_BASEURL=https://{{api_gateway_host}}/dc/v3
AWS_CATALOGS_URL=https://{{api_gateway_host}}/dc/v3/catalogs
AWS_CONTEXT_URL=https://{{api_gateway_host}}/dc/v3/context
AWS_OAUTH_HOST={{oauth_host}}
AWS_CLIENT_ID={{clientId}}
AWS_CLIENT_SECRET={{clientSecret}}
```