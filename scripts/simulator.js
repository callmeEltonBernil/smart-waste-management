// Real-time data simulator for Firebase Emulator testing
// Generates realistic waste bin data patterns for dashboard testing

const admin = require('firebase-admin');

// Initialize Firebase Admin for Emulator
admin.initializeApp({
  projectId: 'demo-project', // Must match your emulator projectId
});

// Connect to Firestore emulator
const db = admin.firestore();
db.settings({
  host: 'localhost:8080',
  ssl: false
});

// Simulation configuration
const BINS = [
  { id: 'BIN-001', location: 'Canteen 1', capacity: 5, currentWeight: 1.5 },
  { id: 'BIN-002', location: 'Canteen 2', capacity: 10, currentWeight: 2.0 },
];

const SIMULATION_INTERVAL = 10000; // 10 seconds (faster for testing)
const WASTE_ACCUMULATION_RATE = 0.5; // kg per interval during busy periods
const COLLECTION_PROBABILITY = 0.08; // 8% chance of collection per interval

function getRandomWasteIncrease() {
  const hour = new Date().getHours();
  
  // Higher waste during meal times (11-13, 17-19)
  const isMealTime = (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 19);
  const baseRate = isMealTime ? WASTE_ACCUMULATION_RATE * 2 : WASTE_ACCUMULATION_RATE;
  
  // Random variation ±50%
  return baseRate * (0.5 + Math.random());
}

function simulateCollection(bin) {
  // Simulate bin collection (weight drops to near zero)
  const residualWeight = 0.1 + Math.random() * 0.3; // Small amount always remains
  console.log(`🗑️  Collection simulated for ${bin.id}: ${bin.currentWeight.toFixed(2)}kg → ${residualWeight.toFixed(2)}kg`);
  bin.currentWeight = residualWeight;
}

async function sendReading(bin) {
  try {
    // Simulate weight accumulation
    const increase = getRandomWasteIncrease();
    bin.currentWeight += increase;

    // Randomly simulate collections
    if (Math.random() < COLLECTION_PROBABILITY && bin.currentWeight > 2) {
      simulateCollection(bin);
    }

    // Ensure weight doesn't exceed reasonable limits
    const maxWeight = bin.capacity * 1.2; // Allow slight overflow
    bin.currentWeight = Math.min(bin.currentWeight, maxWeight);

    // Calculate percentage
    const percentFull = Math.min(Math.round((bin.currentWeight / bin.capacity) * 100), 100);

    // Create reading document
    const reading = {
      binId: bin.id,
      weightKg: Math.round(bin.currentWeight * 100) / 100, // 2 decimal places
      percentFull,
      ts: admin.firestore.FieldValue.serverTimestamp(),
      simulatedData: true // Flag to identify test data
    };

    await db.collection('readings').add(reading);

    // Create alerts if needed
    await checkAndCreateAlerts(bin, percentFull);

    // Log with status indicators
    const status = percentFull >= 90 ? '🔴' : percentFull >= 80 ? '🟡' : '🟢';
    console.log(`${status} ${bin.id} (${bin.location}): ${reading.weightKg}kg (${percentFull}%)`);

  } catch (error) {
    console.error(`Error sending reading for ${bin.id}:`, error);
  }
}

async function checkAndCreateAlerts(bin, percentFull) {
  let alertKind = null;
  let message = '';

  if (percentFull >= 95) {
    alertKind = 'full';
    message = `Bin ${bin.id} is ${percentFull}% full and needs immediate attention`;
  } else if (percentFull >= 80) {
    alertKind = 'warning';
    message = `Bin ${bin.id} is ${percentFull}% full - approaching capacity`;
  }

  if (alertKind) {
    // Check if similar alert exists in last 30 minutes to avoid spam
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentAlerts = await db.collection('alerts')
      .where('binId', '==', bin.id)
      .where('kind', '==', alertKind)
      .where('ts', '>=', thirtyMinAgo)
      .limit(1)
      .get();

    if (recentAlerts.empty) {
      await db.collection('alerts').add({
        binId: bin.id,
        kind: alertKind,
        message,
        ts: admin.firestore.FieldValue.serverTimestamp(),
        ack: false,
        percentFull
      });

      console.log(`🚨 Alert created: ${alertKind.toUpperCase()} for ${bin.id}`);
    }
  }
}

async function createInitialData() {
  console.log('Creating initial bins data...');
  
  // Create bins if they don't exist
  for (const bin of BINS) {
    const binRef = db.collection('bins').doc(bin.id);
    const binDoc = await binRef.get();
    
    if (!binDoc.exists) {
      await binRef.set({
        name: `${bin.location} Main Bin`,
        location: bin.location,
        capacityKg: bin.capacity,
        thresholdPct: 80,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Created bin: ${bin.id}`);
    }
  }
}

async function createHistoricalData() {
  console.log('Creating historical data (last 7 days)...');
  
  const now = new Date();
  const readings = [];
  
  for (let day = 6; day >= 0; day--) {
    for (const bin of BINS) {
      // Generate 3-5 readings per day per bin
      const readingsPerDay = 3 + Math.floor(Math.random() * 3);
      
      for (let reading = 0; reading < readingsPerDay; reading++) {
        const date = new Date(now);
        date.setDate(date.getDate() - day);
        date.setHours(8 + Math.floor(Math.random() * 12)); // 8 AM to 8 PM
        date.setMinutes(Math.floor(Math.random() * 60));

        const baseWeight = bin.id === 'BIN-001' ? 2 : 3;
        const dailyVariation = Math.random() * 4; // 0-4kg variation
        const weightKg = Math.max(0.1, baseWeight + dailyVariation);
        const percentFull = Math.min(Math.round((weightKg / bin.capacity) * 100), 100);

        readings.push({
          binId: bin.id,
          weightKg: Math.round(weightKg * 100) / 100,
          percentFull,
          ts: date,
          simulatedData: true
        });
      }
    }
  }

  // Add readings in batches
  const batchSize = 100;
  for (let i = 0; i < readings.length; i += batchSize) {
    const batch = db.batch();
    const batchReadings = readings.slice(i, i + batchSize);
    
    batchReadings.forEach(reading => {
      const docRef = db.collection('readings').doc();
      batch.set(docRef, reading);
    });
    
    await batch.commit();
    console.log(`📊 Added ${batchReadings.length} historical readings`);
  }

  // Create some historical alerts
  const alerts = [
    {
      binId: 'BIN-001',
      kind: 'warning',
      message: 'Bin BIN-001 is 85% full - approaching capacity',
      percentFull: 85,
      ts: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      ack: false
    },
    {
      binId: 'BIN-002',
      kind: 'full',
      message: 'Bin BIN-002 is 95% full and needs immediate attention',
      percentFull: 95,
      ts: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      ack: false
    }
  ];

  for (const alert of alerts) {
    await db.collection('alerts').add(alert);
  }
  console.log(`🚨 Created ${alerts.length} historical alerts`);
}

async function runSimulation() {
  console.log('🚀 Starting Smart Waste Bin Simulator for Firebase Emulator');
  console.log('📊 Creating initial data and starting real-time simulation');
  console.log('⏱️  Sending readings every 10 seconds');
  console.log('🔄 Press Ctrl+C to stop\n');

  try {
    // Create initial data
    await createInitialData();
    await createHistoricalData();
    
    console.log('\n🎯 Initial data created. Starting real-time simulation...\n');

    // Display initial status
    BINS.forEach(bin => {
      console.log(`📍 ${bin.id} (${bin.location}): ${bin.capacity}kg capacity, starting at ${bin.currentWeight}kg`);
    });
    console.log('');

    // Start simulation loop
    const interval = setInterval(async () => {
      const promises = BINS.map(bin => sendReading(bin));
      await Promise.all(promises);
    }, SIMULATION_INTERVAL);

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping simulator...');
      clearInterval(interval);
      console.log('✅ Simulator stopped. Historical data preserved.');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Simulation error:', error);
    process.exit(1);
  }
}

// Start simulation
runSimulation();