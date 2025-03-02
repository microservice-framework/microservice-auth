'use strict';
import fs from 'fs';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();


var pid = false;
if (process.env.PIDFILE) {
  try {
    pid = fs.readFileSync(process.env.PIDFILE).toString('utf8');
  } catch (e) {}
}

var result = {};
result[process.env.npm_package_name] = parseInt(pid);
console.log(JSON.stringify(result));
