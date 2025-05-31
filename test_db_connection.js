// Test database connection using db.js
const db = require('./config/db');
const config = require('./config/config');

console.log('🔄 Testing database connection...');
console.log('📍 Database URL:', config.db.url ? config.db.url.replace(/:([^:@]+)@/, ':****@') : 'Not configured');
console.log('⚙️ Connection Options:', config.db.options);

// Test the connection
db.once('open', () => {
    console.log('✅ Database connection test successful!');
    console.log('📊 Connection state:', db.readyState);
    console.log('🏷️ Database name:', db.name);
    console.log('🌐 Host:', db.host);
    console.log('🔗 Connection details verified');
    
    // Close the connection and exit
    setTimeout(() => {
        console.log('🔒 Closing test connection...');
        process.exit(0);
    }, 2000);
});

db.on('error', (error) => {
    console.error('❌ Database connection test failed:');
    console.error('Error:', error.message);
    process.exit(1);
});

// Handle timeout
setTimeout(() => {
    console.error('⏰ Database connection test timed out after 10 seconds');
    process.exit(1);
}, 10000);
