const express = require('express');
const { ChatTokenBuilder } = require('agora-token');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());

// App ID and App Certificate from the Agora Console (ensure you have .env for this)
const APP_ID = process.env.APP_ID || '2fdd33b34d5e429995a6f3936aded6a7';
const APP_CERTIFICATE = process.env.APP_CERTIFICATE || 'af9bb28245fc468c9f76aa277fd1e87c';
const BASE_URL = 'https://a71.chat.agora.io/711241378/1432932'; // Base URL for Agora Chat API

// List to store created channels
var createdChannels = [];

// Function to generate a random channel name
function generateRandomChannelName() {
    return 'channel_' + Math.floor(Math.random() * 1000000);
}

// Function to remove expired channels
function removeExpiredChannels() {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    createdChannels = createdChannels.filter(channel => channel.expireAt > now);
}

function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}
// Endpoint to generate a random channel name and its access token
app.get('/create_channel', nocache, (req, resp) => {
    resp.header('Access-Control-Allow-Origin', "*");

    try {
        var channel = generateRandomChannelName();
        const expireAt = Math.floor(Date.now() / 1000) + 3600; // Channel expires in 1 hour

        createdChannels.push({ channel, expireAt });

        var uid = req.query.uid ? req.query.uid : 0;
        var expiredTs = expireAt;

        console.log(`Creating token for channel: ${channel}`);

        var token = new Token(APP_ID, APP_CERTIFICATE, channel, uid);
        token.addPriviledge(Priviledges.kJoinChannel, expiredTs);

        return resp.json({ 'channel': channel, 'token': token.build() });
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

        var token = new Token(APP_ID, APP_CERTIFICATE, channel, uid);
        token.addPriviledge(Priviledges.kJoinChannel, expiredTs);
        return resp.json({ 'token': token.build() });
    } catch (error) {
        console.error('Error generating token:', error);
        return resp.status(500).json({ 'error': 'Internal Server Error' });
    }
});



// Endpoint to generate an App Token and userUuid
app.post('/fetch_app_token', (req, res) => {
    try {
        const expirationInSeconds = 3600; // Token validity (1 hour)
        const userUuid = uuidv4(); // Generate a random userUuid
        const appToken = ChatTokenBuilder.buildAppToken(APP_ID, APP_CERTIFICATE, expirationInSeconds);

        res.json({
            token: appToken,
            userUuid,
            expires_in: expirationInSeconds
        });
    } catch (error) {
        console.error('Error generating App Token:', error);
        res.status(500).json({ error: 'Failed to generate App Token' });
    }
});

// Endpoint to create a user in Agora Chat
app.post('/create_user', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'App Token is required.' });
        }

        const username = `user_${Math.random().toString(36).substr(2, 8)}`;
        const password = `pass_${Math.random().toString(36).substr(2, 8)}`;

        const response = await axios.post(
            `${BASE_URL}/users`,
            { username, password },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Pass through the entire response with additional fields
        res.json({
            username,
            password,
            ...response.data // Include all details from Agora's response
        });
    } catch (error) {
        console.error('Error creating user:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to create user',
            details: error.response?.data || error.message
        });
    }
});


// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Available Endpoints:');
    console.log('/fetch_app_token - Generate an App Token');
    console.log('/create_user - Create a new Agora chat user');
    console.log('Create Channel request, /create_channel');
    console.log('Check Channel request, /check_channel?channel=[channel name]');
    console.log('Channel Key request, /access_token?uid=[user id]&channel=[channel name]');
    console.log('Channel Key with expiring time request, /access_token?uid=[user id]&channel=[channel name]&expiredTs=[expire ts]');
});
