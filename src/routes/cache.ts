import * as CacheBasketController from '../controllers/cacheBasket.controller';
import multer from 'multer';

const upload = multer({ dest: 'tmp/csv/' });

export default ({ app }: any) => {
    app.post('/api/exec_warmup_cache_basket', upload.single('fileCSV'), async (req, res) => {
        if (!req.file) return res.status(400).send({error:'Please upload a file'});
        if (!req.body.catalogCode) return res.status(400).send({error:'Please send a catalogCode'});
        if (!req.body.concurrentRequests) return res.status(400).send({error:'Please send a count'});
        if (!req.body.limit) return res.status(400).send({error:'Please send a limit'});
        if (!req.body.platform) return res.status(400).send({error:'Please select a platform (AWS or SFDC)'});

        const data = await CacheBasketController.WarmupCache({
            filePath: req.file.path,
            catalogCode: req.body.catalogCode,
            concurrentRequests: req.body.concurrentRequests,
            limit: req.body.limit,
            cachePlatform: req.body.platform
        });
        return res.send(data);
    });
};