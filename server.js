require('dotenv').config();
const express = require('express');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const bodyParser = require('body-parser');
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Middlewares
app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.json());

// Config para Stripe (publishable key)
app.get('/api/config', (req, res) => {
  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    console.error('❌ STRIPE_PUBLISHABLE_KEY no está definida');
    return res.status(500).json({ error: 'Stripe publishable key not configured' });
  }

  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// Crear sesión de pago
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const items = req.body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No se recibieron productos' });
    }

    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name || 'Producto',
        },
        unit_amount: item.price, // en céntimos
      },
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creando sesión de checkout:', error);
    res.status(500).json({ error: 'Error creando sesión de pago' });
  }
});

// Página de éxito
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'success.html'));
});

// Página de cancelación
app.get('/cancel', (req, res) => {
  res.sendFile(path.join(__dirname, 'cancel.html'));
});

// Webhook de Stripe
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        endpointSecret
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return response.sendStatus(400);
    }

    // Manejar eventos aquí si quieres

    response.sendStatus(200);
  }
);

// Arrancar servidor
const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log('✓ Servidor iniciado');
  console.log('✓ STRIPE_SECRET_KEY cargada:', !!process.env.STRIPE_SECRET_KEY);
  console.log('✓ STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY);
  console.log('');
  console.log('🚀 Servidor corriendo en:');
  console.log(`   Local: http://localhost:${port}`);
  console.log(`   Red:   http://92.113.26.131:${port}`);
});
