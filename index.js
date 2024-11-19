const express = require('express');
const { ChatTokenBuilder } = require('agora-token');
const { AccessToken, RtmTokenBuilder, RtmRole } = require('agora-access-token');
const { v4: uuidv4 } = require('uuid'); // UUID library for generating unique IDs
require('dotenv').config();

const app = express();
app.use(express.json());

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

// Function to prevent caching
function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}

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

// Endpoint to create a video call channel and generate token for RTC
app.get('/create_channel', nocache, (req, resp) => {
    try {
        var channel = generateRandomChannelName();
        const expireAt = Math.floor(Date.now() / 1000) + 3600; // Channel expires in 1 hour

        createdChannels.push({ channel, expireAt });

        var uid = req.query.uid ? req.query.uid : 0;
        var expiredTs = expireAt;

        console.log(`Creating token for channel: ${channel}`);

        var token = new AccessToken(APP_ID, APP_CERTIFICATE, channel, uid);
        token.addPrivilege(AccessToken.Privileges.kJoinChannel, expiredTs);

        return resp.json({ 'channel': channel, 'token': token.build() });
    } catch (error) {
        console.error('Error creating channel:', error);
        return resp.status(500).json({ 'error': 'Internal Server Error' });
    }
});

// Endpoint to check if a channel exists
app.get('/check_channel', nocache, (req, resp) => {
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

// Endpoint to generate a Chat App Temp Token
app.get('/generate_chat_token', nocache, (req, resp) => {
    try {
        var uid = uuidv4(); // Generate a unique UID
        const expireAt = Math.floor(Date.now() / 1000) + 3600; // Token expires in 1 hour

        const token = RtmTokenBuilder.buildToken(APP_ID, APP_CERTIFICATE, uid, RtmRole.Rtm_User, expireAt);
        console.log(`Generated Chat App Temp Token for uid: ${uid}`);

        return resp.json({ 'uid': uid, 'token': token });
    } catch (error) {
        console.error('Error generating chat token:', error);
        return resp.status(500).json({ 'error': 'Internal Server Error' });
    }
});

// Endpoint to generate access token for a given channel and user
app.get('/access_token', nocache, (req, resp) => {
    var channel = req.query.channel;
    if (!channel) {
        return resp.status(500).json({ 'error': 'channel name is required' });
    }

    var uid = req.query.uid ? req.query.uid : 0;
    var expiredTs = req.query.expiredTs ? req.query.expiredTs : 0;

    try {
        console.log(`Generating token for channel: ${channel}`);

        var token = new AccessToken(APP_ID, APP_CERTIFICATE, channel, uid);
        token.addPrivilege(AccessToken.Privileges.kJoinChannel, expiredTs);
        return resp.json({ 'token': token.build() });
    } catch (error) {
        console.error('Error generating token:', error);
        return resp.status(500).json({ 'error': 'Internal Server Error' });
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Available Endpoints:');
    console.log('/fetch_app_token - Generate an App Token');
    console.log('/create_user - Create a new Agora chat user');
    console.log('/create_channel - Create a new video call channel');
    console.log('/check_channel?channel=[channel_name] - Check if a channel exists');
    console.log('/generate_chat_token - Generate a temporary chat token');
    console.log('/access_token?channel=[channel_name]&uid=[user_id] - Get RTC token for a channel');
});
