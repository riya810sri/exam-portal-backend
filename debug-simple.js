/**
 * Simple debug script to verify StudentRestriction model static methods
 */

const mongoose = require('mongoose');
const StudentRestriction = require('./models/studentRestriction.model');

console.log('StudentRestriction:', StudentRestriction);
console.log('Static methods:');
console.log('checkExamRestriction exists:', typeof StudentRestriction.checkExamRestriction === 'function');
console.log('checkIPRestriction exists:', typeof StudentRestriction.checkIPRestriction === 'function');
