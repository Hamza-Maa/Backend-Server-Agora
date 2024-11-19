// Import the Agora Token Library
const express = require('express');
const { ChatTokenBuilder } = require('agora-token');

const app = express();
app.use(express.json());

// Replace with your actual App ID and App Certificate from the Agora Console
const APP_ID = '2fdd33b34d5e429995a6f3936aded6a7';
const APP_CERTIFICATE = 'af9bb28245fc468c9f76aa277fd1e87c';

// Endpoint to generate an App Token
app.post('/fetch_app_token', (req, res) => {
    try {
        // Define token expiration time (in seconds)
        const expirationInSeconds = 3600; // 1 hour validity

        // Generate the App Token
        const appToken = ChatTokenBuilder.buildAppToken(APP_ID, APP_CERTIFICATE, expirationInSeconds);

        // Send the token as a response
        res.json({
            token: appToken,
            expires_in: expirationInSeconds
        });
    } catch (error) {
        console.error('Error generating App Token:', error);
        res.status(500).json({ error: 'Failed to generate App Token' });
    }
});

// Start the server
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Token server running at http://localhost:${PORT}`);
});
