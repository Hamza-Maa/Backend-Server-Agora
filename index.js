var express = require('express');
var { AccessToken } = require('agora-access-token');
var { Token, Priviledges } = AccessToken;

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

function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}

// Endpoint to generate a random channel name and its access token
app.get('/create_channel', nocache, (req, resp) => {
    resp.header('Access-Control-Allow-Origin', "*");

    var channel = generateRandomChannelName();
    createdChannels.push(channel);

    var uid = req.query.uid ? req.query.uid : 0;
    var expiredTs = req.query.expiredTs ? req.query.expiredTs : 0;

    var token = new Token(APP_ID, APP_CERTIFICATE, channel, uid);
    token.addPriviledge(Priviledges.kJoinChannel, expiredTs);

    return resp.json({ 'channel': channel, 'token': token.build() });
});

// Endpoint to check if a channel exists
app.get('/check_channel', nocache, (req, resp) => {
    resp.header('Access-Control-Allow-Origin', "*");

    var channel = req.query.channel;
    if (!channel) {
        return resp.status(500).json({ 'error': 'channel name is required' });
    }

    if (createdChannels.includes(channel)) {
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

    var token = new Token(APP_ID, APP_CERTIFICATE, channel, uid);
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
