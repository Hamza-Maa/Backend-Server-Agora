const express = require('express');
const { ChatTokenBuilder } = require('agora-token');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());

// App ID and App Certificate from the Agora Console (ensure you have .env for this)
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;
const ORG_NAME = process.env.ORG_NAME;
const APP_NAME = process.env.APP_NAME;
var BASE_URL = `https://a71.chat.agora.io/${ORG_NAME}/${APP_NAME}`;//Base URL for Agora Chat API

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

// Improved error handling to log response
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

        res.json({
            username,
            password,
            ...response.data
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
app.get('/create_channel', (req, resp) => {
    try {
        const channel = generateRandomChannelName();
        const expireAt = Math.floor(Date.now() / 1000) + 3600; // Token expiration time (1 hour)

        createdChannels.push({ channel, expireAt });

        // Generate a random user ID for this channel or use the provided query uid
        const uid = req.query.uid ? req.query.uid : uuidv4();
        const token = ChatTokenBuilder.buildUserToken(APP_ID, APP_CERTIFICATE, uid, expireAt);

        resp.json({ channel, token });
    } catch (error) {
        console.error('Error creating channel:', error);
        resp.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint to check if a channel exists
app.get('/check_channel', (req, resp) => {
    const channel = req.query.channel;
    if (!channel) {
        return resp.status(500).json({ error: 'Channel name is required' });
    }

    // Remove expired channels before checking
    removeExpiredChannels();

    if (createdChannels.some(c => c.channel === channel)) {
        return resp.json({ exists: true });
    } else {
        return resp.json({ exists: false });
    }
});

// Endpoint to generate access token for a given channel and user
app.get('/access_token', (req, resp) => {
    const channel = req.query.channel;
    const uid = req.query.uid || 0; // Default to 0 if no user ID is provided
    const expiredTs = req.query.expiredTs || 0;

    if (!channel) {
        return resp.status(500).json({ error: 'Channel name is required' });
    }

    try {
        console.log(`Generating token for channel: ${channel}`);

        // Generate RTC token for the given user in the channel
        const token = ChatTokenBuilder.buildUserToken(APP_ID, APP_CERTIFICATE, uid, expiredTs);

        return resp.json({ token });
    } catch (error) {
        console.error('Error generating token:', error);
        return resp.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running at :${PORT}`);
    console.log('Available Endpoints:');
    console.log('/fetch_app_token - Generate an App Token');
    console.log('/create_user - Create a new Agora chat user');
    console.log('/create_channel - Create a new video call channel');
    console.log('/check_channel?channel=[channel_name] - Check if a channel exists');
    console.log('/access_token?channel=[channel_name]&uid=[user_id] - Get RTC token for a channel');
});
