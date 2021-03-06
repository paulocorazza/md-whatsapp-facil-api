const axios = require('axios');

require('dotenv/config');

module.exports = class Sessions {

    static async notifyApiSessionUpdate(session) {

        let url = process.env.API_WEBHOOK_URL+'/session/status';

        console.log('Disparando Webhook para ',url);
        
        if(process.env.API_WEBHOOK === true) {
            const response = await axios.post(url, session)  
            .then(function(response){
                console.log('Webhook enviado com sucesso!');
            }).catch(e => console.log(e));
            
            return response;
        }
    }

}