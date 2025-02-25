import { ClientRegister } from '../index.js';

import Microservice from '@microservice-framework/microservice';
import Cluster from '@microservice-framework/microservice-cluster';
import debugF from 'debug';
import tokenGenerate from './includes/token-generate.js';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

const debug = {
  log: debugF('microservice-auth:log'),
  debug: debugF('microservice-auth:debug'),
};

// Create a new microservice
let mservice = new Microservice({
  mongoUrl: process.env.MONGO_URL,
  mongoDB: process.env.MONGO_DB,
  schema: process.env.SCHEMA,
  mongoTable: process.env.MONGO_TABLE,
  secureKey: process.env.SECURE_KEY,
});

new Cluster({
  singleton: RegisterLoader,
  init: function (callback) {
    callback({ test: 1 });
    console.log('init');
  },
  shutdown: function (init) {
    console.log('shutdown', init);
    process.exit(0);
  },
  validate: async function (method, data, request) {
    debug.debug('request', request);
    let accessToken = false;

    if (request.headers.access_token) {
      accessToken = request.headers.access_token;
    }
    if (request.headers['access-token']) {
      accessToken = request.headers['access-token'];
    }
    if (!accessToken) {
      return mservice.validate(method, data, request);
    }
    request.url = request.url.toLowerCase();
    if (method.toLowerCase() == 'get') {
      if (request.url == accessToken.toLowerCase() && request.headers.scope) {
        // access itself with its own token is allowed
        return true;
      }
    }

    let response = await mservice.get(request.url, request);
    if (response.error) {
      return response.error;
    }

    let item = response.answer;
    if (item.expireAt != -1 && item.expireAt < Date.now()) {
      mservice.delete(request.url, request);
      return new Error('Token expired');
    }
    let methods = {};
    for (var i in item.scope) {
      if (item.scope[i].service == process.env.SCOPE) {
        methods = item.scope[i].methods;
        break;
      }
    }
    if (!methods[method.toLowerCase()]) {
      debug.debug('Request:%s denied', method);
      return new Error('Access denied');
    }
    // Access Validated
    return true;
  },
  methods: {
    POST: async function (data, request) {
      if (!data.accessToken) {
        data.accessToken = await tokenGenerate(24);
      }
      if (!data.ttl) {
        data.ttl = 3600;
      }
      if (data.ttl == -1) {
        data.expireAt = -1;
      } else {
        data.expireAt = Date.now() + data.ttl * 1000;
      }
      var searchToken = {
        accessToken: data.accessToken,
      };
      let response = await mservice.search(searchToken, request);
      // if for some reason token exists - generate new.
      // TODO: this is old.
      if (response.code != 404) {
        data.accessToken = await tokenGenerate(24);
      }
      return mservice.post(data, request);
    },
    GET: async function (accessToken, request) {
      let response = await mservice.get(accessToken, request);
      if (response.error) {
        return response.error;
      }
      if (accessToken == request.headers['access-token']) {
        delete response.answer.token;
      }
      // not a validation request
      if (!request.headers.scope) {
        return response;
      }
      let item = response.answer;
      if (item.expireAt != -1 && item.expireAt < Date.now()) {
        return new Error('Token expired');
      }

      let answer = {};
      answer.accessToken = item.accessToken;
      answer.ttl = item.ttl;
      answer.expireAt = item.expireAt;
      answer.credentials = item.credentials;
      answer.scope = item.scope;
      answer.methods = {};

      for (var i in item.scope) {
        if (item.scope[i].service == request.headers.scope) {
          answer.methods = item.scope[i].methods;
          break;
        }
      }

      response.answer = answer;
      return response;
    },
    PUT: mservice.put.bind(mservice),
    DELETE: mservice.delete.bind(mservice),
    SEARCH: async function (data, request) {
      let validate = false;
      let scope = false;
      if (data.validate) {
        validate = true;
        delete data.validate;
        scope = data.scope;
        delete data.scope;
      }
      let response = await mservice.search(data, request);
      if (!validate) {
        return response;
      }
      if (response.error) {
        return response;
      }
      if (response.code == 404) {
        return response;
      }
      let item = response.answer[0];
      if (item.expireAt != -1 && item.expireAt < Date.now()) {
        return callback(new Error('Token expired'));
      }
      let answer = {};
      answer.accessToken = item.accessToken;
      answer.ttl = item.ttl;
      answer.expireAt = item.expireAt;
      answer.credentials = item.credentials;
      answer.methods = {};

      for (var i in item.scope) {
        if (item.scope[i].service == scope) {
          answer.methods = item.scope[i].methods;
          break;
        }
      }

      response.answer = answer;
      return response;
    },
    OPTIONS: mservice.options.bind(mservice),
  },
});

function RegisterLoader(isStart, variables) {
  let cluster = this;
  if (isStart) {
    let register = new ClientRegister({
      route: {
        path: [process.env.SELF_PATH],
        url: process.env.SELF_URL,
        secureKey: process.env.SECURE_KEY,
        provides: {
          ':access_token': {
            field: 'accessToken',
            type: 'number',
          },
        },
      },
      cluster: cluster.cluster,
    });
    variables({ register: register });
  } else {
    variables.register.shutdown();
  }
}
