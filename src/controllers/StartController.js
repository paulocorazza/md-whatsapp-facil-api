const SessionService = require("../services/SessionService");
// const WebhookService = require("../service/WebhookService");


module.exports = {
    async create(request, response, next) {
        console.log("starting session:" + request.query.sessionName);
        let session = await SessionService.start(request.query.sessionName);
    
        console.log('CHECK: -> StartController create session:', session);
        // WebhookService.notifySessionState(session);

        if (["CONNECTED", "QRCODE", "STARTING"].includes(session.state)) {
            response.status(200).json({ 
                result: 'success', 
                state: session.state,
                status: session.status     
            });
        } else {
            response.status(200).json({ result: 'error', message: session.state });
        }
    }
};