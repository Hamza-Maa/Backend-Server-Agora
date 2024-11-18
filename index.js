var express = require('express');
var { AccessToken, RtmTokenBuilder, RtmRole } = require('agora-access-token');
var { Token, Priviledges } = AccessToken;
var { v4: uuidv4 } = require('uuid'); // UUID library for generating unique IDs

var PORT = process.env.PORT || 8080;

if (!(process.env.APP_ID && process.env.APP_CERTIFICATE)) {
    throw new Error('You must define an APP_ID and APP_CERTIFICATE');
}
var APP_ID = process.env.APP_ID;
var APP_CERTIFICATE = process.env.APP_CERTIFICATE;

var app = express();

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

// Endpoint to generate a Chat App Temp Token
app.get('/generate_chat_token', nocache, (req, resp) => {
    resp.header('Access-Control-Allow-Origin', "*");

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

app.listen(PORT, function () {
    console.log('Service URL http://127.0.0.1:' + PORT + "/");
    console.log('Create Channel request, /create_channel');
    console.log('Check Channel request, /check_channel?channel=[channel name]');
    console.log('Generate Chat Token request, /generate_chat_token');
    console.log('Channel Key request, /access_token?uid=[user id]&channel=[channel name]');
    console.log('Channel Key with expiring time request, /access_token?uid=[user id]&channel=[channel name]&expiredTs=[expire ts]');
});
