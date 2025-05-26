import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let validDomain = null;

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

// Call this once at server start
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
    console.error('Error creating email:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create email' });
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

// Serve the HTML file on the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Update the emails element with fetched data
document.getElementById('emails').textContent = JSON.stringify(data, null, 2);

