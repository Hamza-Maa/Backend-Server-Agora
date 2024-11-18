var express = require('express');
var { AccessToken2, ServiceChat, PrivilegeChat } = require('agora-access-token');
var { v4: uuidv4 } = require('uuid'); // UUID library for generating unique IDs

var PORT = process.env.PORT || 8080;

if (!(process.env.APP_ID && process.env.APP_CERTIFICATE)) {
    throw new Error('You must define an APP_ID and APP_CERTIFICATE');
}
var APP_ID = process.env.APP_ID;
var APP_CERTIFICATE = process.env.APP_CERTIFICATE;

var app = express();

app.use(express.json()); // Middleware to parse JSON bodies

// Function to generate a Chat token
function generateChatToken(chatUserUuid, expire) {
    const accessToken = new AccessToken2(APP_ID, APP_CERTIFICATE, expire);
    const serviceChat = new ServiceChat(chatUserUuid);

    serviceChat.addPrivilegeChat(PrivilegeChat.PRIVILEGE_CHAT_USER, expire);
    accessToken.addService(serviceChat);

    try {
        return accessToken.build();
    } catch (e) {
        console.error('Error generating chat token:', e);
        return '';
    }
}

// Endpoint to generate a Chat token with user privileges
app.post('/generate_chat_token', (req, resp) => {
    const { userId, expire } = req.body;

    if (!userId || !expire) {
        return resp.status(400).json({ error: 'userId and expire are required' });
    }

    try {
        const token = generateChatToken(userId, expire);
        console.log(`Generated Chat Token for userId: ${userId}`);
        return resp.json({ uid: userId, token });
    } catch (error) {
        console.error('Error generating chat token:', error);
        return resp.status(500).json({ error: 'Internal Server Error' });
    }
});

// Existing endpoints...

app.listen(PORT, function () {
    console.log(`Service URL http://127.0.0.1:${PORT}/`);
});
