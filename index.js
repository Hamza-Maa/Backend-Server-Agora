require('dotenv').config();
var express = require('express');
var { ChatTokenBuilder } = require('agora-token'); 
var { v4: uuidv4 } = require('uuid'); 
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
app.use(express.json()); 

// List to store created channels
var createdChannels = [];

// Function to generate a random channel name
function generateRandomChannelName() {
    return 'channel_' + Math.floor(Math.random() * 1000000);
}

// Function to remove expired channels
function removeExpiredChannels() {
    const now = Math.floor(Date.now() / 1000); 
    createdChannels = createdChannels.filter(channel => channel.expireAt > now);
}

function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}

// Function to generate a Chat token
function generateChatToken(chatUserUuid, expire) {
    const expireAt = Math.floor(Date.now()) + expire;

    try {
        const token = ChatTokenBuilder.buildUserToken(APP_ID, APP_CERTIFICATE, chatUserUuid, expireAt);
        console.log(`Generated Chat Token: ${token}`);
        return token;
    } catch (e) {
        console.error('Error generating chat token:', e);
        return '';
    }
}

// Endpoint to generate a random channel name and its access token
app.get('/create_channel', nocache, (req, resp) => {
    resp.header('Access-Control-Allow-Origin', "*");

    try {
        var channel = generateRandomChannelName();
        const expireAt = Math.floor(Date.now() / 1000) + 3600; 

        createdChannels.push({ channel, expireAt });

        var uid = req.query.uid ? req.query.uid : uuidv4(); 
        var expiredTs = expireAt;

        console.log(`Creating token for channel: ${channel}`);

        var token = ChatTokenBuilder.buildUserToken(APP_ID, APP_CERTIFICATE, uid, expiredTs);

        return resp.json({ 'channel': channel, 'token': token });
    } catch (error) {
        console.error('Error creating channel:', error);
        return resp.status(500).json({ 'error': 'Internal Server Error' });
    }
});

// Endpoint to check if a channel exists
app.get('/check_channel', nocache, (req, resp) => {
    resp.header('Access-Control-Allow-Origin', "*");

    var channel = req.query.channel;
    if (!channel) {
        return resp.status(500).json({ 'error': 'channel name is required' });
    }

    // Remove expired channels before checking
    removeExpiredChannels();

    if (createdChannels.some(c => c.channel === channel)) {
        return resp.json({ 'exists': true });
    } else {
        return resp.json({ 'exists': false });
    }
});

// Endpoint to generate a Chat Token with user privileges
app.post('/generate_chat_token', nocache, (req, resp) => {
    const { expire } = req.body;

    if (!expire) {
        return resp.status(400).json({ error: 'expire is required' });
    }

    try {
        const userId = uuidv4(); // Generate a unique userId
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
    const { token, username, password } = req.body;

    if (!token || !username || !password) {
        return resp.status(400).json({ error: 'token, username, and password are required' });
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
        return resp.status(500).json({ 'error': 'Internal Server Error:\n ' +error});
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
    console.log('Create Channel request, /create_channel');
    console.log('Check Channel request, /check_channel?channel=[channel name]');
    console.log('Generate Chat Token request, /generate_chat_token');
    console.log('Create User request, /create_user');
    console.log('Channel Key request, /access_token?uid=[user id]&channel=[channel name]');
    console.log('Channel Key with expiring time request, /access_token?uid=[user id]&channel=[channel name]&expiredTs=[expire ts]');
});
