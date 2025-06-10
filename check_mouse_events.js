// Check if mouse events are stored in the database
const mongoose = require('mongoose');
const config = require('./config/config');

mongoose.connect(config.db.url, config.db.options)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

const SecurityEvent = require('./models/securityEvent.model');

async function checkMouseEvents() {
  try {
    console.log('🔍 Checking for recent mouse events...');
    
    // Find recent mouse events
    const events = await SecurityEvent.find({ 
      event_type: { $in: ['click', 'mousemove'] } 
    }).sort({ timestamp: -1 }).limit(10);
    
    console.log(`📊 Found ${events.length} mouse events:`);
    
    events.forEach((event, i) => {
      console.log(`Event ${i+1}:`);
      console.log(`  ID: ${event._id}`);
      console.log(`  Type: ${event.event_type}`);
      console.log(`  Timestamp: ${new Date(event.timestamp).toISOString()}`);
      console.log(`  Student ID: ${event.student_id}`);
      console.log(`  Exam ID: ${event.exam_id}`);
      console.log(`  Details:`, event.details ? JSON.stringify(event.details, null, 4) : 'None');
      console.log('  ---');
    });
    
    // Check specifically for our test events
    const testEvents = await SecurityEvent.find({ 
      monit_id: { $regex: /^test_/ }
    }).sort({ timestamp: -1 });
    
    console.log(`\n🧪 Found ${testEvents.length} test events:`);
    testEvents.forEach((event, i) => {
      console.log(`Test Event ${i+1}:`);
      console.log(`  ID: ${event._id}`);
      console.log(`  Type: ${event.event_type}`);
      console.log(`  Monitor ID: ${event.monit_id}`);
      console.log(`  X: ${event.details?.x}, Y: ${event.details?.y}`);
      console.log('  ---');
    });
    
  } catch (error) {
    console.error('❌ Error checking events:', error);
  } finally {
    mongoose.disconnect();
  }
}

setTimeout(checkMouseEvents, 1000);
