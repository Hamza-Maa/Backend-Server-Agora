const express = require('express');
const bodyParser = require('body-parser');
const { ChatTokenBuilder } = require('agora-token');

// Replace these with your Agora project credentials
const APP_ID = '2fdd33b34d5e429995a6f3936aded6a7';
const APP_CERTIFICATE = 'af9bb28245fc468c9f76aa277fd1e87c';

if (!APP_ID || !APP_CERTIFICATE) {
    console.error('Please set your APP_ID and APP_CERTIFICATE.');
    process.exit(1);
}

const app = express();
app.use(bodyParser.json());

// Generate Chat Token
app.post('/get-chat-token', (req, res) => {
    const { userUuid, expirationTimeInSeconds } = req.body;

    if (!userUuid) {
        return res.status(400).json({ error: 'userUuid is required.' });
    }

    const expiration = expirationTimeInSeconds || 3600; // Default: 1 hour
    try {
        const token = ChatTokenBuilder.buildUserToken(APP_ID, APP_CERTIFICATE, userUuid, expiration);
        res.json({ token });
    } catch (error) {
        console.error('Error generating token:', error);
        res.status(500).json({ error: 'Failed to generate token.' });
    }
});

// Start the server
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Token server is running on http://localhost:${PORT}`);
});
