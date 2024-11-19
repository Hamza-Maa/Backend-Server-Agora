const express = require('express');
const { RtcTokenBuilder, RtcRole, RtmTokenBuilder, Role: RtmRole } = require('agora-token');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());

// App ID and App Certificate from the Agora Console
const APP_ID = process.env.APP_ID || '2fdd33b34d5e429995a6f3936aded6a7';
const APP_CERTIFICATE = process.env.APP_CERTIFICATE || 'af9bb28245fc468c9f76aa277fd1e87c';
const BASE_URL = 'https://a71.chat.agora.io/711241378/1432932'; // Base URL for Agora Chat API

// List to store created channels
let createdChannels = [];

// Function to generate a random channel name
function generateRandomChannelName() {
    return 'channel_' + Math.floor(Math.random() * 1000000);
}

// Function to remove expired channels
function removeExpiredChannels() {
    const now = Math.floor(Date.now() / 1000);
    createdChannels = createdChannels.filter(channel => channel.expireAt > now);
}

// Disable cache for responses
function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}

// Automatically remove expired channels every 5 minutes
setInterval(removeExpiredChannels, 5 * 60 * 1000);

// Endpoint to generate an App Token and userUuid
app.post('/fetch_app_token', (req, res) => {
    try {
        const expirationInSeconds = 3600; // Token validity (1 hour)
        const userUuid = uuidv4(); // Generate a random userUuid
        const currentTimestamp = Math.floor(Date.now() / 1000);

        // Generate App Token using RTC and RTM token generation
        const rtcToken = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            'dummy_channel', // A dummy channel for the App Token
            0, // UID (0 means the app itself, as it's not specific to a user)
            RtcRole.PUBLISHER,
            currentTimestamp + expirationInSeconds
        );

        res.json({
            token: rtcToken,
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

// Endpoint to create a video call channel and generate token for RTC and RTM
app.get('/create_channel', nocache, (req, resp) => {
    try {
        const channel = generateRandomChannelName();
        const expireAt = Math.floor(Date.now() / 1000) + 3600; // Channel expires in 1 hour
        const uid = req.query.uid ? parseInt(req.query.uid) : 0; // Default to 0 if no UID provided
        const currentTimestamp = Math.floor(Date.now() / 1000);

        createdChannels.push({ channel, expireAt });

        // Generate RTC token
        const rtcToken = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channel,
            uid,
            RtcRole.PUBLISHER,
            expireAt
        );

        // Generate RTM token using a unique user ID or UUID
        const rtmToken = RtmTokenBuilder.buildToken(
            APP_ID,
            APP_CERTIFICATE,
            uuidv4(), // Generate a unique user ID for RTM
            RtmRole.PUBLISHER, // Correctly reference RtmRole here
            expireAt
        );

        console.log(`Created channel: ${channel}`);
        resp.json({ channel, rtcToken, rtmToken });
    } catch (error) {
        console.error('Error creating channel:', error);
        resp.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint to check if a channel exists
app.get('/check_channel', nocache, (req, resp) => {
    const channel = req.query.channel;
    if (!channel) {
        return resp.status(400).json({ error: 'Channel name is required' });
    }

    // Remove expired channels before checking
    removeExpiredChannels();

    const exists = createdChannels.some(c => c.channel === channel);
    resp.json({ exists });
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
});
