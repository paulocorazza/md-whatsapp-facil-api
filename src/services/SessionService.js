const os = require('os');
const fs = require('fs');
const path = require('path');
const venom = require('venom-bot');
const WebhookService = require("./WebhookService");
const { Session } = require('inspector');
// const { json } = require('express');
// const { Session } = require('inspector');
// const { info } = require('console');

module.exports = class Sessions {

    static async start(sessionName) {
        Sessions.sessions = Sessions.sessions || []; //start array

        var session = Sessions.getSession(sessionName);

        if (session == false) { //create new session
            
            console.log("session == false");
            session = await Sessions.addSesssion(sessionName);

        } else if (["CLOSED"].includes(session.state)) { //restart session
            
            console.log("session.state == CLOSED");
            session.state = "STARTING";
            session.status = 'notLogged';
            session.client = Sessions.initSession(sessionName);

            Sessions.setup(sessionName);
        
        } else if (["CONFLICT", "UNPAIRED", "UNLAUNCHED"].includes(session.state)) {

            console.log("client.useHere()");
            session.client.then(client => {
                client.useHere();
            });

        } else {
            console.log("session.state: " + session.state);
        }

        return session;
    }//start

    static async addSesssion(sessionName) {
        var newSession = {
            name: sessionName,
            qrcode: false,
            client: false,
            status: 'notLogged',
            state: 'STARTING'
        }
        Sessions.sessions.push(newSession);
        console.log("newSession.state: " + newSession.state);

        //setup session
        newSession.client = Sessions.initSession(sessionName);
        Sessions.setup(sessionName);

        return newSession;
    }//addSession

    static async initSession(sessionName) {
        var session = Sessions.getSession(sessionName);
        const client = await venom.create(
            sessionName,
            (base64Qr) => {
                session.state = "QRCODE";
                session.qrcode = base64Qr;
                console.log("new qrcode updated - session.state: " + session.state);
                WebhookService.notifyApiSessionUpdate(session);
            },
            (statusFind) => {
                console.log('statusFind', statusFind);
                session.status = statusFind;
                console.log("session.status: " + session.status);
                WebhookService.notifyApiSessionUpdate(session);
            },
            {
                headless: true,
                devtools: false,
                useChrome: false,
                debug: false,
                logQR: false,
                browserArgs: [
                    '--log-level=3',
                    '--no-default-browser-check',
                    '--disable-site-isolation-trials',
                    '--no-experiments',
                    '--ignore-gpu-blacklist',
                    '--ignore-certificate-errors',
                    '--ignore-certificate-errors-spki-list',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-default-apps',
                    '--enable-features=NetworkService',
                    '--disable-setuid-sandbox',
                    '--no-sandbox',
                    // Extras
                    '--disable-webgl',
                    '--disable-threaded-animation',
                    '--disable-threaded-scrolling',
                    '--disable-in-process-stack-traces',
                    '--disable-histogram-customizer',
                    '--disable-gl-extensions',
                    '--disable-composited-antialiasing',
                    '--disable-canvas-aa',
                    '--disable-3d-apis',
                    '--disable-accelerated-2d-canvas',
                    '--disable-accelerated-jpeg-decoding',
                    '--disable-accelerated-mjpeg-decode',
                    '--disable-app-list-dismiss-on-blur',
                    '--disable-accelerated-video-decode',
                ],
                refreshQR: 15000,
                autoClose: 60 * 60 * 24 * 365, //never
                disableSpins: true
            }
        );
        return client;
    }//initSession

    static async setup(sessionName) {
        var session = Sessions.getSession(sessionName);
        await session.client.then(client => {
            client.onStateChange(state => {
                session.state = state;
                console.log("session.state: " + state);
                WebhookService.notifyApiSessionUpdate(session);
            });//.then((client) => Sessions.startProcess(client));
            client.onMessage((message) => {
                if (message.body === 'hi') {
                    client.sendText(message.from, 'Hello\nfriend!');
                }
            });
        });
    }//setup

    static async closeSession(sessionName) {
        var session = Sessions.getSession(sessionName);
        if (session) { //só adiciona se não existir
            if (session.state != "CLOSED") {
                if (session.client)
                    await session.client.then(async client => {
                        try {
                            await client.close();
                        } catch (error) {
                            console.log("client.close(): " + error.message);
                        }
                        session.state = "CLOSED";
                        session.client = false;
                        console.log("client.close - session.state: " + session.state);
                    });
                    WebhookService.notifyApiSessionUpdate(session);
                return { result: "success", message: "CLOSED" };
            } else {//close
                WebhookService.notifyApiSessionUpdate(session);
                return { result: "success", message: session.state };
            }
        } else {
            return { result: "error", message: "NOTFOUND" };
        }
    }//close

    static getSession(sessionName) {
        var foundSession = false;
        if (Sessions.sessions)
            Sessions.sessions.forEach(session => {
                if (sessionName == session.name) {
                    foundSession = session;
                }
            });
        return foundSession;
    }//getSession

    static getSessions() {
        if (Sessions.sessions) {
            return Sessions.sessions;
        } else {
            return [];
        }
    }//getSessions

    static async getHostDevice(sessionName) {
        var session = Sessions.getSession(sessionName);
        if (session) {
            let host_device = await session.client.then(async client => {
                console.log('client.getHostDevice() ->', client.getHostDevice()); 
            });
            
            return host_device;
        }
    
        return false;

    }

    static async getQrcode(sessionName) {
        var session = Sessions.getSession(sessionName);
        if (session) {
            // if (["UNPAIRED", "UNPAIRED_IDLE"].includes(session.state)) {
            if (["UNPAIRED_IDLE"].includes(session.state)) {
                //restart session
                await Sessions.closeSession(sessionName);
                Sessions.start(sessionName);
                WebhookService.notifyApiSessionUpdate(session);

                return { result: "error", message: session.state };
            } else if (["CLOSED"].includes(session.state)) {
                Sessions.start(sessionName);
                WebhookService.notifyApiSessionUpdate(session);
                return { result: "error", message: session.state };
            } else { //CONNECTED
                if (session.status != 'isLogged') {
                    Session.getHostDevice(session.name);
                    WebhookService.notifyApiSessionUpdate(session);
                    return { result: "success", message: session.state, qrcode: session.qrcode };
                } else {
                    WebhookService.notifyApiSessionUpdate(session);
                    return { result: "success", message: session.state };
                }
            }
        } else {
            return { result: "error", message: "NOTFOUND" };
        }
    } //getQrcode

    static async sendText(sessionName, number, text) {

        console.log('sessionName sendText', sessionName);

        var session = Sessions.getSession(sessionName);

        console.log('session sendText',session);
        if (session) {
            if (session.state == "CONNECTED") {
                var resultSendText = await session.client.then(async client => {
                    // return await client.sendMessageToId(number + '@c.us', text);

                    return await client
                    .sendText(number + '@c.us', text)
                    .then((result) => {
                      console.log('Result: ', result); //return object success
                    })
                    .catch((erro) => {
                      console.error('Error when sending: ', erro); //return object error
                    });

                }).catch(error => console.log('error', error));
                return { result: "success" }
            } else {
                return { result: "error", message: session.state };
            }
        } else {
            return { result: "error", message: "NOTFOUND" };
        }
    }//message

    static async sendFile(sessionName, number, base64Data, fileName, caption) {
        var session = Sessions.getSession(sessionName);
        if (session) {
            if (session.state == "CONNECTED") {
                var resultSendFile = await session.client.then(async (client) => {
                    var folderName = fs.mkdtempSync(path.join(os.tmpdir(), session.name + '-'));
                    var filePath = path.join(folderName, fileName);
                    fs.writeFileSync(filePath, base64Data, 'base64');
                    console.log(filePath);
                    return await client.sendFile(number + '@c.us', filePath, fileName, caption);
                });//client.then(
                return { result: "success" };
            } else {
                return { result: "error", message: session.state };
            }
        } else {
            return { result: "error", message: "NOTFOUND" };
        }
    }//message
}