import express from 'express';

const app = express();
app.use(express.json());

app.post('/get-emails', async (req, res) => {
  try {
    console.log('Request body:', req.body);
    // Simulate fetching emails (replace with real logic if needed)
    // const emails = await fetchEmails(req.body.inboxId, req.body.token);
    res.json({ received: req.body });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

app.listen(3000, () => console.log('Test server running on http://localhost:3000'));
