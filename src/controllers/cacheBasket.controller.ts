import { AWS_CATALOGS_URL, SFDC_URL, SFDC_USERNAME, SFDC_PASSWORD } from "../util/secrets";
import { PLATFORM_SFDC, PLATFORM_AWS } from "../commons/constants";
import { csv, createCsvWriter, fs, clc } from "../commons/reportLibraries";
import { conn, oauthConfig, requestOptions } from "../commons/auth" ;
import Table from 'cli-table';

const { ClientCredentials } = require('simple-oauth2');
const request = require('request');
const _ = require('lodash');
const CSV_REPORT_BASKET_DIRECTORY = './reports/basket';
var platform = ''; 

interface IWarmupCache {
    filePath: string;
    catalogCode: string;
    concurrentRequests: number;
    limit: string;
    cachePlatform: string;
}

export async function WarmupCache({ filePath, catalogCode, concurrentRequests, limit, cachePlatform }: IWarmupCache): Promise<any> {
    platform = cachePlatform;

    if(platform == PLATFORM_AWS){
        const client = new ClientCredentials(oauthConfig);
    
        const tokenParams = {
            scope: '',
        };
    
        const accessToken = await client.getToken(tokenParams,{json:true});
    
        console.log(clc.blue('Access Token'));
        console.log(accessToken);
    
        requestOptions['headers']['Authorization'] = `Bearer ${accessToken.token.access_token}`;
    }

    return new Promise<any>(resolve => {
        const results = [];
        console.log(clc.blue('Start Warm-Up Cache Basket'));
        console.log(`${clc.bold('AWS Base URL:')} ${AWS_CATALOGS_URL}`);
        console.log(`${clc.bold('CatalogCode:')} ${catalogCode}`);
        console.log(`---------------------------------------------------------------------`);
        const csvWriter = setupReport(CSV_REPORT_BASKET_DIRECTORY,platform);

        if(platform == PLATFORM_SFDC){
            conn.login(SFDC_USERNAME, SFDC_PASSWORD, function(err, userInfo) {
                if (err) { return console.error(err); }
                console.log(conn.accessToken);
                console.log(conn.instanceUrl);
                console.log("User ID: " + userInfo.id);
                console.log("Org ID: " + userInfo.organizationId);

                fs.createReadStream(filePath)
                .pipe(csv({ separator: ',' }))
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    console.log(clc.blue('Reading CSV FILE...'));
                    console.log(`${clc.italic('CSV File')} ${clc.italic(filePath)} ${clc.italic('read correctly')}`);
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error(err)
                            return;
                        }
                    });
                    console.log(`${clc.italic('CSV File '+filePath+' unlink correctly')}`);
                    console.log(`---------------------------------------------------------------------`);

                    let prepareGetOfferDetails = readCSVRows(catalogCode,results)[0];
                    let prepareBaskets = readCSVRows(catalogCode,results)[1];
    
                    const totalRequests = limit == 'all' ? prepareBaskets.length : Number(limit);
                    console.log(`${clc.bold("Total requests to process:")} ${totalRequests}`);
                    let counter = 0;
    
                    let csvArrayData = [];
                    console.log(clc.blue('Processing requests...'));
                    console.log(clc.magentaBright(`Time Start: ${new Date().toISOString()}`));
    
                    getOfferDetails(prepareGetOfferDetails).then(function(getOfferDetailsRootOffers){
                        recursiveMakeBlockRequests(getOfferDetailsRootOffers,prepareBaskets,totalRequests,concurrentRequests,counter,0,csvArrayData,csvWriter);
                    });
                    resolve(prepareGetOfferDetails.concat(prepareBaskets));
                });
            });            
        }
        if(platform == PLATFORM_AWS){
            fs.createReadStream(filePath)
            .pipe(csv({ separator: ',' }))
            .on('data', (data) => results.push(data))
            .on('end', () => {
                console.log(clc.blue('Reading CSV FILE...'));
                console.log(`${clc.italic('CSV File')} ${clc.italic(filePath)} ${clc.italic('read correctly')}`);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(err)
                        return;
                    }
                });
                console.log(`${clc.italic('CSV File '+filePath+' unlink correctly')}`);
                console.log(`---------------------------------------------------------------------`);

                let prepareGetOfferDetails = readCSVRows(catalogCode,results)[0];
                let prepareBaskets = readCSVRows(catalogCode,results)[1];
    
                const totalRequests = limit == 'all' ? prepareBaskets.length : Number(limit);
                console.log(`${clc.bold("Total requests to process:")} ${totalRequests}`);
                let counter = 0;
    
                let csvArrayData = [];
                console.log(clc.blue('Processing requests...'));
                console.log(clc.magentaBright(`Time Start: ${new Date().toISOString()}`));
                
                getOfferDetails(prepareGetOfferDetails).then(function(getOfferDetailsRootOffers){
                    recursiveMakeBlockRequests(getOfferDetailsRootOffers,prepareBaskets,totalRequests,concurrentRequests,counter,0,csvArrayData,csvWriter);
                });
                resolve(prepareGetOfferDetails.concat(prepareBaskets));
            });
        }

    });
}

async function getOfferDetails(getOfferDetailsRows:any[]){
    console.log(`---------------------------------------------------------------------`);
    console.log(clc.blue('Calling getOfferDetails'));
    return new Promise<any>(resolve => {
        let nameAPI = 'GetOfferDetails';
        let getOfferDetailsObj = {};
        let countReq = 0;

        for (var _i = 0; _i < getOfferDetailsRows.length; _i++) {
            let urlGetOfferDetails = getOfferDetailsRows[_i]['url'];

            makeRequest('GET',urlGetOfferDetails,null,nameAPI,getOfferDetailsRows[_i]['productCode'],null).then(function(resData){
                let getOfferDetailsOffer = {};
                countReq++;
                if(resData.body && resData.body.offerDetails){
                    getOfferDetailsOffer = resData.body.offerDetails.offer;
                    getOfferDetailsObj[getOfferDetailsOffer['ProductCode']] = getOfferDetailsOffer;
                }
        
                if(countReq == getOfferDetailsRows.length){
                    resolve(getOfferDetailsObj);
                }
            });
        }
    });
}

function recursiveMakeBlockRequests(getOfferDetailsRootOffers:any,records:any[],limitRequests:number,concurrentRequests:number,counter:number,startIndex:number,csvArrayData:any[],csvWriter:any){
    return new Promise<any>(resolve => {
        var endIndex = Number(Number(startIndex)+Number(concurrentRequests));
        var productsCodesRows = records.slice(startIndex,endIndex);
        console.log(`---------------------------------------------------------------------`);
        console.log(`Remaining ${limitRequests} requests to process`);
        console.log(`Start processing: ${productsCodesRows.length}/${limitRequests} from CSV Row ${startIndex} to CSV Row ${endIndex-1}`);
        makeBlockRequests(getOfferDetailsRootOffers,productsCodesRows,concurrentRequests,platform).then(function(csvBlockArrayData){
            limitRequests = Number(Number(limitRequests)-Number(concurrentRequests));
            let newCsvArrayData = csvArrayData.concat(csvBlockArrayData);
            upsertReport(csvWriter,csvBlockArrayData);
            
            if(limitRequests <= 0){
                console.log(`---------------------------------------------------------------------`);
                console.log(clc.bgGreenBright('Warm-Up Cache completed!'));
                console.log(clc.magentaBright(`Time End: ${new Date().toISOString()}`));
            }
            else{
                console.log(clc.magentaBright(`Complete Block Time: ${new Date().toISOString()}`));
                startIndex = Number(Number(startIndex)+Number(concurrentRequests));
                recursiveMakeBlockRequests(getOfferDetailsRootOffers,records,limitRequests,concurrentRequests,counter,startIndex,newCsvArrayData,csvWriter);
            }
        });
    });
}

async function makeBlockRequests(getOfferDetailsRootOffers:any,productCodesRows:any[],concurrentRequests:number,platform:string){
    return new Promise<any>(resolve => {
        let countReq = 0;
        let csvArrayData = [];

        for (var _i = 0; _i < productCodesRows.length; _i++) {
            let productCodeRow = productCodesRows[_i];
            let basketEndpoint = productCodeRow.url;
            var getOfferDetailsRootOffersCopy = _.cloneDeep(getOfferDetailsRootOffers);
            let basketPayload = createBasketPayload(getOfferDetailsRootOffersCopy,productCodeRow,null);
            let nameAPI = 'Basket';
            
            makeRequest('POST',basketEndpoint,basketPayload,nameAPI,productCodeRow.productCodes,productCodeRow.childProductCodes).then(function(resData){
                if(resData.multiTransactionKey != ''){
                    let basketPayload = createBasketPayload(getOfferDetailsRootOffersCopy,productCodeRow,resData.multiTransactionKey);

                    makeRequest('POST',basketEndpoint,basketPayload,nameAPI,productCodeRow.productCodes,productCodeRow.childProductCodes).then(function(resData4){
                        csvArrayData.push(resData4.csvArrayDataObj);

                        if(productCodeRow.promotionCode && productCodeRow.promotionCode != ''){
                            let cartContextKey = resData4.cartContextKey;
                            let applyPromoURL = `${basketEndpoint}/${cartContextKey}`;
                            let basketPromoPayload = createBasketPromoPayload(productCodeRow.promotionCode,null,null);
                            let nameAPIapplyPromo = 'ApplyPromoToBasket';
    
                            makeRequest('POST',applyPromoURL,basketPromoPayload,nameAPIapplyPromo,productCodeRow.promotionCode+' - '+productCodeRow.productCodes,productCodeRow.childProductCodes).then(function(resData2){
                                if(resData2.transactionKey != '' || resData2.multiTransactionKey != ''){
                                    let basketPromoPayload2 = createBasketPromoPayload(productCodeRow.promotionCode,resData2.transactionKey,resData2.multiTransactionKey);
                                    makeRequest('POST',applyPromoURL,basketPromoPayload2,nameAPIapplyPromo,productCodeRow.promotionCode+' - '+productCodeRow.productCodes,productCodeRow.childProductCodes).then(function(resData3){
                                        countReq++;
                                        csvArrayData.push(resData3.csvArrayDataObj);
                                        if(countReq == concurrentRequests){
                                            resolve(csvArrayData);
                                        }
                                    });
                                }
                                else{
                                    countReq++;
                                    csvArrayData.push(resData2.csvArrayDataObj);
                                    if(countReq == concurrentRequests){
                                        resolve(csvArrayData);
                                    }
                                }
                            });
                        }
                        else{
                            countReq++;
                            if(countReq == concurrentRequests){
                                resolve(csvArrayData);
                            }
                        }
                    });
                }
                else{
                    csvArrayData.push(resData.csvArrayDataObj);

                    if(productCodeRow.promotionCode != ''){
                        let cartContextKey = resData.cartContextKey;
                        let applyPromoURL = `${basketEndpoint}/${cartContextKey}`;
                        let basketPromoPayload = createBasketPromoPayload(productCodeRow.promotionCode,null,null);
                        let nameAPIapplyPromo = 'ApplyPromoToBasket';

                        makeRequest('POST',applyPromoURL,basketPromoPayload,nameAPIapplyPromo,productCodeRow.promotionCode+' - '+productCodeRow.productCodes,productCodeRow.childProductCodes).then(function(resData2){
                            if(resData2.transactionKey != '' || resData2.multiTransactionKey != ''){
                                let basketPromoPayload2 = createBasketPromoPayload(productCodeRow.promotionCode,resData2.transactionKey,resData2.multiTransactionKey);
                                makeRequest('POST',applyPromoURL,basketPromoPayload2,nameAPIapplyPromo,productCodeRow.promotionCode+' - '+productCodeRow.productCodes,productCodeRow.childProductCodes).then(function(resData3){
                                    countReq++;
                                    csvArrayData.push(resData3.csvArrayDataObj);
                                    if(countReq == concurrentRequests){
                                        resolve(csvArrayData);
                                    }
                                });
                            }
                            else{
                                countReq++;
                                csvArrayData.push(resData2.csvArrayDataObj);
                                if(countReq == concurrentRequests){
                                    resolve(csvArrayData);
                                }
                            }
                        });
                    }
                    else{
                        countReq++;
                        if(countReq == concurrentRequests){
                            resolve(csvArrayData);
                        }
                    }
                }
            });
        }
    });
}

function createBasketPromoPayload(promotionCode:string,transactionKey:string,multiTransactionKey:string){
    let basketPromoPayload = {
        "basketAction": "AddWithNoConfig",
        "offer": promotionCode
    }

    if(transactionKey != null){
        basketPromoPayload['transactionKey'] = transactionKey;
    }

    if(multiTransactionKey != null){
        basketPromoPayload['multiTransactionKey'] = multiTransactionKey;
    }

    return basketPromoPayload;
}

function createBasketPayload(getOfferDetailsRootOffers:any,productCodeRow:any,multiTransactionKey:string){
    let arrayProductList = (productCodeRow.productCodes).split('|');
    let basketPayload = {};

    if(productCodeRow.childProductCodes != null && productCodeRow.childProductCodes != ''){
        let productConfigArray = [];
        arrayProductList.forEach(function(productCode){
            let jsonChildProductCodes = JSON.parse(productCodeRow.childProductCodes);
            if(jsonChildProductCodes[productCode]){
                var tempProductCodeList = _.clone(jsonChildProductCodes[productCode]);
                setQtyGetOfferDetails(getOfferDetailsRootOffers[productCode],getOfferDetailsRootOffers[productCode],getOfferDetailsRootOffers[productCode].childProducts,tempProductCodeList,tempProductCodeList);
                let productConfigObj = {
                    "offerDetails": {
                        "offer": getOfferDetailsRootOffers[productCode]
                    }
                }
                productConfigArray.push(productConfigObj);
            }
            else{
                let productConfigObj = {
                    "offerDetails": {
                        "offer": getOfferDetailsRootOffers[productCode]
                    }
                }
                productConfigArray.push(productConfigObj);
            }
        });

        basketPayload = {
            "basketAction": "AddAfterConfig",
            "productConfig": productConfigArray
        }
    }
    else{
        basketPayload = {
            "basketAction": "AddWithNoConfig",
            "offer": arrayProductList
        }
    }

    if(multiTransactionKey != null){
        basketPayload['multiTransactionKey'] = multiTransactionKey;
    }

    return basketPayload;
}

function setQtyGetOfferDetails(offerDetailsRoot:any,parent:any,childProducts:any,arrayProductCodeList:any,tempProductCodeList:any){
    if(tempProductCodeList.length > 0){
        if(parent.childProducts && parent.childProducts.length > 0){
            for(var _i=0; _i < parent.childProducts.length; _i++){
                if(arrayProductCodeList.includes(parent.childProducts[_i].ProductCode)){
                    parent.childProducts[_i].Quantity = 1;
                    _.pull(tempProductCodeList, parent.childProducts[_i].ProductCode);
                }
    
                if(childProducts[_i].childProducts && childProducts[_i].childProducts.length > 0){
                    setQtyGetOfferDetails(offerDetailsRoot,childProducts[_i],childProducts[_i].childProducts,arrayProductCodeList,tempProductCodeList);
                }
            }
        }
    }
    else
        return offerDetailsRoot;
}

async function makeRequest(method:string,url:string,payload:any,nameAPI:string,productCodes:string,childProducts:string){
    return new Promise<any>(resolve => {
        const timestampBefore = new Date();

        if(method == 'GET'){
            /* SFDC GET REQUEST */
            if(platform == PLATFORM_SFDC){
                conn.apex.get(url, function(err, res){
                    if (err) { console.log(res); }
        
                    const timestampAfter = new Date();
                    const timestamp = new Date().toISOString();
                    
                    res.elapsedTime = timestampAfter.getTime() - timestampBefore.getTime();
                    res.statusCode = res.errorCode == 'INVOKE-200'? '200' : res.errorCode;
                    res.headers = {
                        "vloc-op-cache":"-",
                        "x-amzn-requestid":"-",
                    }
        
                    if(res.errorCode == 'INVOKE-200'){
                        logTable(res,method,nameAPI,productCodes,childProducts,res.contextKey);
                    }
        
                    const csvArrayDataObj = {
                        "timestamp": timestamp,
                        "code": res.statusCode,
                        "productCodes": productCodes,
                        "contextKey": res.contextKey || '',
                        "time": res.elapsedTime
                    }
        
                    const resData = {
                        contextKey: res.contextKey,
                        body: res.result,
                        csvArrayDataObj: csvArrayDataObj
                    }
        
                    resolve(resData);
                });
            }
            
            /* AWS GET REQUEST */
            if(platform == PLATFORM_AWS){
                request(url, requestOptions, (err, res, body) => {
                    if (err) { console.log(err); }

                    const timestampAfter = new Date();
                    const timestamp = new Date().toISOString();
                    
                    res.elapsedTime = timestampAfter.getTime() - timestampBefore.getTime();

                    if(res.statusCode == 200){
                        logTable(res,method,nameAPI,productCodes,childProducts,body.contextKey);
                    }
                    
                    const csvArrayDataObj = {
                        "timestamp": timestamp,
                        "code": res.statusCode,
                        "productCodes": productCodes,
                        "contextKey": body.contextKey || '',
                        "time": res.elapsedTime,
                        "cache": res.headers['vloc-op-cache'] || '',
                        "x-amzn-requestid": res.headers['x-amzn-requestid'] || ''
                    }

                    const resData = {
                        contextKey: body.contextKey,
                        body: body.result,
                        csvArrayDataObj: csvArrayDataObj
                    }

                    resolve(resData);
                });
            }
        }

        if(method == 'POST'){
            /* SFDC POST REQUEST */
            if(platform == PLATFORM_SFDC){
                conn.apex.post(url, payload, function(err, res){
                    if (err) { console.log(res); }
    
                    const timestampAfter = new Date();
                    const timestamp = new Date().toISOString();
                    const timeDiff = timestampAfter.getTime() - timestampBefore.getTime();
                    let transactionKey = '';
                    let multiTransactionKey = '';
                    var csvArrayDataObj = {};
                    var cartContextKey = '-';
    
                    if(res != null){
                        res.elapsedTime = timeDiff;
                        res.statusCode = res.errorCode == 'INVOKE-200'? '200' : res.errorCode;
                        res.headers = {
                            "vloc-op-cache":"-",
                            "x-amzn-requestid":"-",
                        }
            
                        if(res.errorCode == 'INVOKE-200'){
                            logTable(res,method,nameAPI,productCodes,childProducts,res.cartContextKey || '');
                        }
                        
            
                        csvArrayDataObj = {
                            "timestamp": timestamp,
                            "code": res.statusCode,
                            "productCodes": productCodes,
                            "cartContextKey": res.cartContextKey || '-',
                            "time": res.elapsedTime
                        }
        
                        if(res.validateAndPriceAction && res.validateAndPriceAction.rest && res.validateAndPriceAction.rest.params.transactionKey){
                            transactionKey = res.validateAndPriceAction.rest.params.transactionKey;
                        }
    
                        if(res.nexttransaction && res.nexttransaction.rest && res.nexttransaction.rest.params.multiTransactionKey){
                            multiTransactionKey = res.nexttransaction.rest.params.multiTransactionKey;
                        }
    
                        cartContextKey = res.cartContextKey != null ? res.cartContextKey : '-';
                    }
                    else{
                        csvArrayDataObj = {
                            "timestamp": timestamp,
                            "code": 500,
                            "productCodes": productCodes,
                            "cartContextKey": "-",
                            "time": timeDiff
                        }
                    }
        
                    const resData = {
                        cartContextKey: cartContextKey,
                        csvArrayDataObj: csvArrayDataObj,
                        transactionKey: transactionKey,
                        multiTransactionKey: multiTransactionKey
                    }
        
                    resolve(resData);
                });
            }

            /* AWS POST REQUEST */
            if(platform == PLATFORM_AWS){
                requestOptions['body'] = payload;
                requestOptions['url'] = url;
                requestOptions['method'] = method;

                request(url, requestOptions, (err, res, body) => {
                    if (err) { console.log(err); }

                    const timestampAfter = new Date();
                    const timestamp = new Date().toISOString();
                    const timeDiff = timestampAfter.getTime() - timestampBefore.getTime();

                    let transactionKey = '';
                    let multiTransactionKey = '';
                    var csvArrayDataObj = {};
                    var cartContextKey = '-';
    
                    if(res != null){
                        res.elapsedTime = timeDiff;
            
                        if(res.statusCode == 200){
                            logTable(res,method,nameAPI,productCodes,childProducts,body.cartContextKey || '');
                        }
            
                        csvArrayDataObj = {
                            "timestamp": timestamp,
                            "code": res.statusCode,
                            "productCodes": productCodes,
                            "cartContextKey": body.cartContextKey || '-',
                            "time": res.elapsedTime,
                            "cache": res.headers['vloc-op-cache'] || '',
                            "x-amzn-requestid": res.headers['x-amzn-requestid'] || ''
                        }
        
                        if(body.validateAndPriceAction && body.validateAndPriceAction.rest && body.validateAndPriceAction.rest.params.transactionKey){
                            transactionKey = body.validateAndPriceAction.rest.params.transactionKey;
                        }
    
                        if(body.nexttransaction && body.nexttransaction.rest && body.nexttransaction.rest.params.multiTransactionKey){
                            multiTransactionKey = body.nexttransaction.rest.params.multiTransactionKey;
                        }
    
                        cartContextKey = body.cartContextKey != null ? body.cartContextKey : '-';
                    }
                    else{
                        csvArrayDataObj = {
                            "timestamp": timestamp,
                            "code": 500,
                            "productCodes": productCodes,
                            "cartContextKey": "-",
                            "time": timeDiff
                        }
                    }
        
                    const resData = {
                        cartContextKey: cartContextKey,
                        csvArrayDataObj: csvArrayDataObj,
                        transactionKey: transactionKey,
                        multiTransactionKey: multiTransactionKey
                    }
        
                    resolve(resData);
                });
            }
        }
    });
}

function readCSVRows(catalogCode:string, records:any[]){
    let getOfferDetailsSet = new Set();
    let getOfferDetailsRow:any[] = [];
    let basketRows:any[] = [];
    let baseEndPoint = platform == PLATFORM_SFDC ? SFDC_URL : AWS_CATALOGS_URL; 
    records.forEach(element => {
            let obj:any = {
                type: 'Basket',
                url: `${baseEndPoint}/${catalogCode}/basket`,
                productCodes: `${element['RootProductCombinations']}`,
                childProductCodes: `${element['Childs']}`,
                promotionCode: `${element['PromotionCode']}`
            }

            let productCodesArr = (`${element['RootProductCombinations']}`).split('|');
            productCodesArr.forEach(productCode => {
                getOfferDetailsSet.add(productCode);
            });

            basketRows.push(obj);
    });

    getOfferDetailsSet.forEach(productCode => {
        let obj:any = {
            type: 'GetOfferDetails',
            url: `${baseEndPoint}/${catalogCode}/offers/${productCode}`,
            productCode: productCode
        }
        getOfferDetailsRow.push(obj);
    });

    return [getOfferDetailsRow,basketRows];
}

function logTable(res:any,method:string,nameAPI:string,productCodes:string,childProducts:string,cartContextKey:string){
    let childProductsTable = '';
    let table = null;

    if(childProducts != null && childProducts != '') childProductsTable = childProducts;

    if(method == 'GET'){
        if(platform == PLATFORM_SFDC){
            table = new Table({
                head: ['Code','Method','Name API','ProductCodes','ContextKey','Time (ms)'], 
                colWidths: [10,10,20,60,35,13]
            });
            table.push(
                [res.statusCode,method,nameAPI,productCodes,cartContextKey,res.elapsedTime]
            );
        }

        if(platform == PLATFORM_AWS){
            table = new Table({
                head: ['Code','Method','Name API','ProductCodes','ContextKey','Time (ms)','Cache','x-amzn-requestid'], 
                colWidths: [10,10,20,60,35,13,10,40]
            });
            table.push(
                [res.statusCode,method,nameAPI,productCodes,cartContextKey,res.elapsedTime,res.headers['vloc-op-cache'],res.headers['x-amzn-requestid']]
            );
        }
    }

    if(method == 'POST'){
        if(platform == PLATFORM_SFDC){
            table = new Table({
                head: ['Code','Method','Name API','ProductCodes','ChildProducts','CartContextKey','Time (ms)'], 
                colWidths: [10,10,10,60,60,35,13]
            });
            table.push(
                [res.statusCode,method,nameAPI,productCodes,childProductsTable,cartContextKey,res.elapsedTime]
            );
        }

        if(platform == PLATFORM_AWS){
            table = new Table({
                head: ['Code','Method','Name API','ProductCodes','ChildProducts','CartContextKey','Time (ms)','Cache'], 
                colWidths: [10,10,10,60,60,35,13,10]
            });
            table.push(
                [res.statusCode,method,nameAPI,productCodes,childProductsTable,cartContextKey,res.elapsedTime,res.headers['vloc-op-cache']]
            );
        }
    }

    console.log(table.toString());
}

function setupReport(directory:string,platform:string){
    const today = new Date();
    const fileName = today.toISOString().split(":").join(".");
    var csvWriter = {};
    console.log(`Setup Report - ${directory}/${fileName}.csv`);
    console.log(`---------------------------------------------------------------------`);

    // AWS PLATFORM
    if(platform == PLATFORM_AWS){
        csvWriter = createCsvWriter({
            path: `${directory}/${fileName}.csv`,
            header: [
                {id: 'timestamp', title: 'Timestamp'},
                {id: 'code', title: 'Code'},
                {id: 'productCodes', title: 'Product Codes / Promotion Code'},
                {id: 'cartContextKey', title: 'CartContextKey'},
                {id: 'time', title: 'Time (ms)'},
                {id: 'cache', title: 'Cache'},
                {id: 'x-amzn-requestid', title: 'x-amzn-requestid'}
            ]
        });
    }

    // SFDC PLATFORM
    if(platform == PLATFORM_SFDC){
        csvWriter = createCsvWriter({
            path: `${directory}/${fileName}.csv`,
            header: [
                {id: 'timestamp', title: 'Timestamp'},
                {id: 'code', title: 'Code'},
                {id: 'productCodes', title: 'Product Codes / Promotion Code'},
                {id: 'cartContextKey', title: 'CartContextKey'},
                {id: 'time', title: 'Time (ms)'}
            ]
        });
    }
    
    if (!fs.existsSync(directory)){
        fs.mkdirSync(directory);
    }

    return csvWriter;
}

function upsertReport(csvWriterObj:any,csvArrayData:any[]){
    csvWriterObj.writeRecords(csvArrayData);
}