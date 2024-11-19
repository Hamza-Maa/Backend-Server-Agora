const express = require('express');
const { ChatTokenBuilder } = require('agora-token');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Replace with your actual App ID and App Certificate from the Agora Console
const APP_ID = '2fdd33b34d5e429995a6f3936aded6a7';
const APP_CERTIFICATE = 'af9bb28245fc468c9f76aa277fd1e87c'; 
const BASE_URL = 'https://a71.chat.agora.io/711241378/1432932';

// Endpoint to generate an App Token and userUuid
app.post('/fetch_app_token', (req, res) => {
    try {
        // Define token expiration time (in seconds)
        const expirationInSeconds = 3600; // 1 hour validity

        // Generate a random userUuid
        const userUuid = uuidv4();

        // Generate the App Token
        const appToken = ChatTokenBuilder.buildAppToken(APP_ID, APP_CERTIFICATE, expirationInSeconds);

        // Send the token and userUuid as a response
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
        // Get the App Token
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'App Token is required.' });
        }

        // Generate a random username and password for the new user
        const username = `user_${Math.random().toString(36).substr(2, 8)}`;
        const password = `pass_${Math.random().toString(36).substr(2, 8)}`;

        // Create the user in Agora Chat
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

        // Respond with the created user details
        res.json({
            username,
            password,
            userId: response.data.entities[0].uuid // The unique user ID returned by Agora
        });
    } catch (error) {
        console.error('Error creating user:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create user', details: error.response?.data || error.message });
    }
});

// Start the server
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Token server running at ${PORT}`);
});
