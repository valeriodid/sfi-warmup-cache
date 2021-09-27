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