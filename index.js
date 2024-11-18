const express = require('express');
const { AccessToken } = require('agora-access-token');
const { Token, Priviledges } = AccessToken;

const PORT = process.env.PORT || 8080;

if (!(process.env.APP_ID && process.env.APP_CERTIFICATE)) {
    throw new Error('You must define an APP_ID and APP_CERTIFICATE');
}
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

const app = express();

// List to store created channels with their expiration times
let createdChannels = [];

// Function to generate a random channel name
function generateRandomChannelName() {
    return 'channel_' + Math.floor(Math.random() * 1000000);
}

// Function to remove expired channels
function removeExpiredChannels() {
    const now = Date.now();
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

    const channel = generateRandomChannelName();
    const expireAt = Date.now() + 3600000; // Channel expires in 1 hour

    createdChannels.push({ channel, expireAt });

    const uid = req.query.uid ? req.query.uid : 0;
    const expiredTs = req.query.expiredTs ? req.query.expiredTs : expireAt;

    const token = new Token(APP_ID, APP_CERTIFICATE, channel, uid);
    token.addPriviledge(Priviledges.kJoinChannel, expiredTs);

    return resp.json({ 'channel': channel, 'token': token.build() });
});

// Endpoint to check if a channel exists
app.get('/check_channel', nocache, (req, resp) => {
    resp.header('Access-Control-Allow-Origin', "*");

    const channel = req.query.channel;
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

    const channel = req.query.channel;
    if (!channel) {
        return resp.status(500).json({ 'error': 'channel name is required' });
    }

    const uid = req.query.uid ? req.query.uid : 0;
    const expiredTs = req.query.expiredTs ? req.query.expiredTs : 0;

    const token = new Token(APP_ID, APP_CERTIFICATE, channel, uid);
    token.addPriviledge(Priviledges.kJoinChannel, expiredTs);
    return resp.json({ 'token': token.build() });
});

app.listen(PORT, function () {
    console.log('Service URL http://127.0.0.1:' + PORT + "/");
    console.log('Create Channel request, /create_channel');
    console.log('Check Channel request, /check_channel?channel=[channel name]');
    console.log('Channel Key request, /access_token?uid=[user id]&channel=[channel name]');
    console.log('Channel Key with expiring time request, /access_token?uid=[user id]&channel=[channel name]&expiredTs=[expire ts]');
});
