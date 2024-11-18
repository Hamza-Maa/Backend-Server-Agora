var express = require('express');
var { ChatTokenBuilder } = require('agora-token');
var { v4: uuidv4 } = require('uuid'); // UUID library for generating unique IDs
var axios = require('axios');

var PORT = process.env.PORT || 8080;

if (!(process.env.APP_ID && process.env.APP_CERTIFICATE)) {
    throw new Error('You must define an APP_ID and APP_CERTIFICATE');
}
var APP_ID = process.env.APP_ID;
var APP_CERTIFICATE = process.env.APP_CERTIFICATE;
var ORG_NAME = '711241378'; // Your Agora organization name
var APP_NAME = '1432932'; // Your Agora app name
var BASE_URL = `https://a71.chat.agora.io/${ORG_NAME}/${APP_NAME}`;

var app = express();
app.use(express.json()); // Middleware to parse JSON bodies

// Function to generate a Chat token
function generateChatToken(chatUserUuid, expire) {
    const expireAt = Math.floor(Date.now() / 1000) + expire;

    try {
        const token = ChatTokenBuilder.buildUserToken(APP_ID, APP_CERTIFICATE, chatUserUuid, expireAt);
        return token;
    } catch (e) {
        console.error('Error generating chat token:', e);
        return '';
    }
}

// Endpoint to generate a Chat Token with user privileges
app.post('/generate_chat_token', nocache, (req, resp) => {
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
        return resp.status(500).json({ 'error': 'Internal Server Error' });
    }
});

// Endpoint to create a user in Agora Chat
app.post('/create_user', nocache, async (req, resp) => {
    const { uid, token, username, password } = req.body;

    if (!uid || !token || !username || !password) {
        return resp.status(400).json({ error: 'uid, token, username, and password are required' });
    }

    try {
        const response = await axios.post(`${BASE_URL}/users`, {
            username: username,
            password: password
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`Created user: ${username}`);
        return resp.json(response.data);
    } catch (error) {
        console.error('Error creating user:', error.response ? error.response.data : error.message);
        return resp.status(500).json({ 'error': 'Internal Server Error' });
    }
});

// Existing endpoint to generate access token
app.get('/access_token', nocache, (req, resp) => {
    resp.header('Access-Control-Allow-Origin', "*");

    var channel = req.query.channel;
    if (!channel) {
        return resp.status(500).json({ 'error': 'channel name is required' });
    }

    var uid = req.query.uid ? req.query.uid : 0;
    var expiredTs = req.query.expiredTs ? req.query.expiredTs : 0;

    try {
        console.log(`Generating token for channel: ${channel}`);

        var token = ChatTokenBuilder.buildUserToken(APP_ID, APP_CERTIFICATE, uid, expiredTs);

        return resp.json({ 'token': token });
    } catch (error) {
        console.error('Error generating token:', error);
        return resp.status(500).json({ 'error': 'Internal Server Error' });
    }
});

app.listen(PORT, function () {
    console.log(`Service URL http://127.0.0.1:${PORT}/`);
    console.log('Generate Chat Token request, /generate_chat_token');
    console.log('Create User request, /create_user');
    console.log('Channel Key request, /access_token?uid=[user id]&channel=[channel name]');
    console.log('Channel Key with expiring time request, /access_token?uid=[user id]&channel=[channel name]&expiredTs=[expire ts]');
});
