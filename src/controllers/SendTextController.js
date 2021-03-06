const SessionService = require("../services/SessionService");

module.exports = {
    async create(request, response, next) {
        let result = await SessionService.sendText(
            request.body.sessionName,
            request.body.number,
            request.body.text
        );
        response.json(result);
    },
    async test(request, response, next) {
        let result = await SessionService.sendText(
            request.query.sessionName,
            '553784171388',
            'Testando WhatsApp Api'
        );
        response.json(result);
    }
};