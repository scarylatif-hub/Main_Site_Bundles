// Test script for live webhook endpoint (after deployment)
// Run with: node test-webhook-live.js

const webhookUrl = 'https://sbbundles-main.vercel.app/api/webhooks/dakazina';
const webhookSecret = process.env.DAKAZINA_WEBHOOK_SECRET || 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

// Example webhook payload from Dakazina
const testPayload = {
  id: 7988,
  type: "test_event",
  status: "DELIVERED",
  previous_status: "PROCESSING",
  order_code: "DKZ-TEST-RQ5WKR",
  reference: "REF-HETWWVUOTM",
  amount: 10,
  user_id: 4,
  occurred_at: "2026-04-10T21:15:44+00:00",
  test: true,
  metadata: {
    message: "This is a test webhook from Dakazina"
  }
};

async function testWebhook() {
  console.log('Testing Dakazina webhook integration (LIVE)...');
  console.log('URL:', webhookUrl);
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', responseText);

    if (response.ok) {
      console.log('✅ Webhook test successful!');
      const responseData = JSON.parse(responseText);
      console.log('Updated transactions:', responseData.transactions_updated);
      console.log('Updated overrides:', responseData.overrides_updated);
    } else {
      console.log('❌ Webhook test failed');
    }
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
  }
}

// Run tests
if (require.main === module) {
  testWebhook();
}

module.exports = { testPayload, testWebhook };
