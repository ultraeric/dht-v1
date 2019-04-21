import express from 'express';
import http from 'http';
import {connectIO} from 'backend/ioManager';
import {key, selfCert} from 'shared/crypto';
import {DHT, accounts, web3} from 'blockchainSetup/DHTClass';

const port = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);

// Connect all I/O functionality to the backend server
connectIO(server, key, selfCert);

server.listen(port,
  () => console.log('Node/express server started on port ' + port)
);

