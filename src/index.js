import http from 'http';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import {version} from '../package.json'
import WebSocketServer, {Server} from 'uws';
import AppRouter from './services/router'
import Model from './domains'
import Database from './infrastructure/database'
import path from 'path'

const PORT = 3001;
const app = express();
app.server = http.createServer(app);

app.use(cors({
    exposedHeaders: "*"
}));

app.use(bodyParser.json({
    limit: '50mb'
}));

app.wss = new Server({
	server: app.server
});

const wwwPath = path.join(__dirname, 'public');

app.use('/', express.static(wwwPath));

new Database().connect().then((db) => {

	app.db = db;
	
}).catch((err) => {
	throw(err);
});


app.models = new Model(app);
app.routers = new AppRouter(app);

app.server.listen(process.env.PORT || PORT, () => {
     console.log(`Server is running on port ${app.server.address().port}`);
});

export default app;