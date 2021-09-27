import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";

// Routes Handlers
import cacheRoute from './routes/cache';

// Create Express server
const app = express();

// Express configuration
app.set("port", process.env.PORT || 5000);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(morgan('dev'));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Routes
cacheRoute({app})

export default app;