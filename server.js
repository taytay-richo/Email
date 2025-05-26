const express = require('express');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let validDomain = null;

// In-memory store for code -> accounts mapping
const codeToAccounts = {};

// Utility to generate a random 6-digit code as a string
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Function to fetch available domains and pick the first valid one
async function fetchValidDomain() {
  try {
    const res = await axios.get('https://api.mail.tm/domains');
    const domains = res.data['hydra:member'];
    if (domains && domains.length > 0) {
      validDomain = domains[0].domain;
      console.log('Valid domain found:', validDomain);
    } else {
      console.error('No domains found from API');
    }
  } catch (error) {
    console.error('Failed to fetch domains:', error.message);
  }
}

// Wrap server start in an async IIFE
(async () => {
  await fetchValidDomain();

  app.post('/create-email', async (req, res) => {
    if (!validDomain) {
      return res.status(500).json({ error: 'No valid domain available' });
    }

    const username = `user${Math.floor(Math.random() * 100000)}`;
    const password = 'StrongPass123!';
    const email = `${username}@${validDomain}`;

    try {
      // Create account on mail.tm
      const createAccountRes = await axios.post('https://api.mail.tm/accounts', {
        address: email,
        password,
      });

      // Login to get token
      const tokenRes = await axios.post('https://api.mail.tm/token', {
        address: email,
        password,
      });

      // Only send if both account and token are present
      if (createAccountRes.data && tokenRes.data && tokenRes.data.token) {
        res.json({
          inboxId: createAccountRes.data.id,
          email,
          password,
          token: tokenRes.data.token,
        });
      } else {
        res.status(500).json({ error: 'Failed to create or login to email' });
      }
    } catch (error) {
      if (error.response && error.response.status === 429) {
        res.status(429).json({ error: 'Rate limited by mail.tm. Please try again later.' });
      } else {
        console.error('Error creating email:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create email' });
      }
    }
  });

  // New route: fetch emails for a user
  app.post('/get-emails', async (req, res) => {
    const { inboxId, token } = req.body;

    if (!inboxId || !token) {
      return res.status(400).json({ error: 'Missing inboxId or token' });
    }

    try {
      console.log("Fetching emails for inbox:", inboxId);
      const response = await axios.get('https://api.mail.tm/messages', {
        headers: {
          Authorization: `Bearer ${token}`,
        }
        // params: { account: inboxId }, // Try commenting this out
      });
      console.log("Emails fetched:", response.data);
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching emails:", error.response?.data || error.message);
      console.error("Full error:", error); // Add this for more details
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });

  // Route to create multiple emails and assign a code
  app.post('/create-emails', async (req, res) => {
    const { count } = req.body;
    if (!count || count < 1 || count > 10) {
      return res.status(400).json({ error: 'Count must be between 1 and 10' });
    }

    if (!validDomain) {
      return res.status(500).json({ error: 'No valid domain available' });
    }

    const accounts = [];
    let created = 0;
    for (let i = 0; i < count; i++) {
      const username = `user${Math.floor(Math.random() * 100000)}`;
      const password = 'StrongPass123!';
      const email = `${username}@${validDomain}`;

      try {
        const createAccountRes = await axios.post('https://api.mail.tm/accounts', {
          address: email,
          password,
        });
        const tokenRes = await axios.post('https://api.mail.tm/token', {
          address: email,
          password,
        });

        if (createAccountRes.data && tokenRes.data && tokenRes.data.token) {
          accounts.push({
            inboxId: createAccountRes.data.id,
            email,
            password,
            token: tokenRes.data.token,
          });
          created++;
          // Optional: add delay to avoid rate limiting
          await new Promise(res => setTimeout(res, 2000));
        }
      } catch (error) {
        if (error.response && error.response.status === 429) {
          break; // Stop on rate limit
        }
      }
    }

    if (accounts.length === 0) {
      return res.status(429).json({ error: 'Rate limited by mail.tm. Please try again later.' });
    }

    const code = generateCode();
    await AccountBatch.create({ code, accounts });
    res.json({ code, accountsCreated: accounts.length });
  });

  // Serve the HTML file on the root URL
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();

async function createMultipleEmails(count) {
  for (let i = 0; i < count; i++) {
    await fetch('/create-email', { method: 'POST' });
    await new Promise(res => setTimeout(res, 3000)); // 3 second delay
  }
}

// Replace with your MongoDB Atlas connection string
mongoose.connect(
  'mongodb+srv://taylor:<db_password>@cluster0.pef2ln4.mongodb.net/emailgen?retryWrites=true&w=majority&appName=Cluster0',
  { useNewUrlParser: true, useUnifiedTopology: true }
);

const AccountBatchSchema = new mongoose.Schema({
  code: String,
  accounts: Array,
  createdAt: { type: Date, default: Date.now }
});
const AccountBatch = mongoose.model('AccountBatch', AccountBatchSchema);

// New route: get accounts by code
app.post('/get-accounts', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }
  const batch = await AccountBatch.findOne({ code });
  if (!batch) {
    return res.status(404).json({ error: 'Code not found or expired' });
  }
  res.json({ accounts: batch.accounts });
});

// Admin route to generate codes in advance
app.post('/admin/generate-codes', async (req, res) => {
  const { count } = req.body;
  if (!count || count < 1 || count > 100) {
    return res.status(400).json({ error: 'Count must be between 1 and 100' });
  }
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    await AccountBatch.create({ code, accounts: [] }); // No accounts yet
    codes.push(code);
  }
  res.json({ codes });
});

