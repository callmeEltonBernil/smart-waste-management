// Setup: Deploy with 'firebase deploy --only functions'
// npm install firebase-functions firebase-admin

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');

initializeApp();
const db = getFirestore();

// Enhanced alert management function
async function manageAlerts(binId, percentFull) {
  try {
    // Get the most recent unacknowledged alert for this bin
    const recentAlertsQuery = db.collection('alerts')
      .where('binId', '==', binId)
      .where('ack', '==', false)
      .orderBy('ts', 'desc')
      .limit(1);

    const recentAlertsSnapshot = await recentAlertsQuery.get();
    
    let currentAlertLevel = null;
    let message = '';
    
    // Determine what alert level should be active
    if (percentFull >= 95) {
      currentAlertLevel = 'full';
      message = `Bin ${binId} is ${percentFull}% full and needs immediate attention`;
    } else if (percentFull >= 80) {
      currentAlertLevel = 'warning';
      message = `Bin ${binId} is ${percentFull}% full - approaching capacity`;
    }

    if (!recentAlertsSnapshot.empty) {
      const existingAlert = recentAlertsSnapshot.docs[0];
      const existingAlertData = existingAlert.data();
      
      if (currentAlertLevel) {
        // Update existing alert if level changed
        if (existingAlertData.kind !== currentAlertLevel) {
          await existingAlert.ref.update({
            kind: currentAlertLevel,
            message,
            percentFull,
            ts: FieldValue.serverTimestamp() // Update timestamp for new severity
          });
          
          logger.info('Alert updated', { 
            binId, 
            from: existingAlertData.kind, 
            to: currentAlertLevel, 
            percentFull 
          });
        }
        // If same level, just update percentage and timestamp
        else {
          await existingAlert.ref.update({
            message,
            percentFull,
            ts: FieldValue.serverTimestamp()
          });
        }
      } else {
        // No alert needed anymore - acknowledge existing alert
        await existingAlert.ref.update({
          ack: true,
          resolvedAt: FieldValue.serverTimestamp()
        });
        
        logger.info('Alert resolved', { binId, percentFull });
      }
    } else {
      // No existing unacknowledged alert - create new one if needed
      if (currentAlertLevel) {
        await db.collection('alerts').add({
          binId,
          kind: currentAlertLevel,
          message,
          ts: FieldValue.serverTimestamp(),
          ack: false,
          percentFull
        });

        logger.info('New alert created', { binId, currentAlertLevel, percentFull });
      }
    }
  } catch (error) {
    logger.error('Error managing alerts', { binId, percentFull, error });
    throw error;
  }
}

// Process IoT readings and trigger alerts
exports.onCreateReading = onDocumentCreated('readings/{readingId}', async (event) => {
  try {
    const reading = event.data.data();
    const { binId, weightKg } = reading;

    if (!binId || weightKg == null) {
      logger.warn('Invalid reading data', { reading });
      return;
    }

    // Get bin configuration
    const binDoc = await db.collection('bins').doc(binId).get();
    if (!binDoc.exists) {
      logger.warn('Bin not found', { binId });
      return;
    }

    const bin = binDoc.data();
    const { capacityKg = 10, thresholdPct = 80 } = bin;

    // Calculate percentage full
    const percentFull = Math.min(Math.round((weightKg / capacityKg) * 100), 100);

    // Update reading with calculated percentage
    await event.data.ref.update({ percentFull });

    // Use enhanced alert management instead of old logic
    await manageAlerts(binId, percentFull);

  } catch (error) {
    logger.error('Error processing reading', error);
    throw error;
  }
});

// IoT data ingestion endpoint
exports.ingestReading = onRequest({
  cors: ['https://your-domain.com'], // Replace with your domain
  rateLimits: {
    maxConcurrentRequests: 10,
    maxRequestsPerSecond: 5
  }
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { binId, weightKg, timestamp } = req.body;

    // Validate input
    if (!binId || weightKg == null) {
      res.status(400).json({ error: 'Missing required fields: binId, weightKg' });
      return;
    }

    if (typeof weightKg !== 'number' || weightKg < 0) {
      res.status(400).json({ error: 'weightKg must be a positive number' });
      return;
    }

    // Create reading document
    const readingData = {
      binId: String(binId),
      weightKg: Number(weightKg),
      ts: timestamp ? new Date(timestamp) : FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('readings').add(readingData);

    logger.info('Reading ingested', { binId, weightKg, docId: docRef.id });

    res.status(201).json({ 
      success: true, 
      id: docRef.id,
      message: 'Reading recorded successfully'
    });

  } catch (error) {
    logger.error('Error ingesting reading', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Weekly summary generation (runs every Sunday at 2 AM)
exports.weeklySummary = onSchedule({
  schedule: '0 2 * * 0', // Sunday at 2 AM
  timeZone: 'Asia/Manila', // Adjust for your timezone
  retryCount: 3
}, async (event) => {
  try {
    logger.info('Starting weekly summary generation');

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all active bins
    const binsSnapshot = await db.collection('bins')
      .where('active', '==', true)
      .get();

    const summaries = [];

    for (const binDoc of binsSnapshot.docs) {
      const binId = binDoc.id;
      const binData = binDoc.data();

      // Get readings for this bin in the past week
      const readingsSnapshot = await db.collection('readings')
        .where('binId', '==', binId)
        .where('ts', '>=', weekStart)
        .where('ts', '<', now)
        .get();

      let totalWeight = 0;
      let readingCount = 0;
      let maxWeight = 0;
      let collectionCount = 0;
      let lastWeight = 0;

      readingsSnapshot.forEach(doc => {
        const reading = doc.data();
        totalWeight += reading.weightKg || 0;
        readingCount++;
        maxWeight = Math.max(maxWeight, reading.weightKg || 0);
        
        // Detect collections (significant weight drops)
        if (lastWeight > 0 && reading.weightKg < lastWeight * 0.5) {
          collectionCount++;
        }
        lastWeight = reading.weightKg || 0;
      });

      const avgWeight = readingCount > 0 ? totalWeight / readingCount : 0;

      // Get alerts for this bin
      const alertsSnapshot = await db.collection('alerts')
        .where('binId', '==', binId)
        .where('ts', '>=', weekStart)
        .where('ts', '<', now)
        .get();

      const summary = {
        binId,
        binLocation: binData.location || 'Unknown',
        weekStart,
        weekEnd: now,
        totalWeight,
        avgWeight,
        maxWeight,
        readingCount,
        collectionCount,
        alertCount: alertsSnapshot.size,
        createdAt: FieldValue.serverTimestamp()
      };

      summaries.push(summary);
    }

    // Save summaries
    const batch = db.batch();
    summaries.forEach(summary => {
      const docRef = db.collection('summaries').doc();
      batch.set(docRef, summary);
    });

    await batch.commit();

    logger.info('Weekly summaries created', { count: summaries.length });

  } catch (error) {
    logger.error('Error generating weekly summaries', error);
    throw error;
  }
});

// Get dashboard statistics
exports.getDashboardStats = onCall(async (request) => {
  try {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get user role
    const userDoc = await db.collection('users').doc(auth.uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's readings
    const todayReadings = await db.collection('readings')
      .where('ts', '>=', today)
      .where('ts', '<', tomorrow)
      .get();

    let todayTotal = 0;
    todayReadings.forEach(doc => {
      todayTotal += doc.data().weightKg || 0;
    });

    // Get bins status
    const binsSnapshot = await db.collection('bins').get();
    let activeBins = 0;
    let fullBins = 0;

    for (const binDoc of binsSnapshot.docs) {
      const bin = binDoc.data();
      if (bin.active) {
        activeBins++;

        // Get latest reading for this bin
        const latestReading = await db.collection('readings')
          .where('binId', '==', binDoc.id)
          .orderBy('ts', 'desc')
          .limit(1)
          .get();

        if (!latestReading.empty) {
          const reading = latestReading.docs[0].data();
          if (reading.percentFull >= 90) {
            fullBins++;
          }
        }
      }
    }

    // Get recent alerts
    const recentAlerts = await db.collection('alerts')
      .where('ts', '>=', today)
      .get();

    return {
      todayTotal,
      activeBins,
      fullBins,
      recentAlerts: recentAlerts.size
    };

  } catch (error) {
    logger.error('Error getting dashboard stats', error);
    throw new HttpsError('internal', 'Error getting dashboard statistics');
  }
});