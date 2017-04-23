const expect  = require("chai").expect;
const MicroserviceClient = require('@microservice-framework/microservice-client');

require('dotenv').config();

describe('AUTH CRUD API',function(){
  var accessToken;
  var RecordID;

  it('POST should return 200',function(done){
    var client = new MicroserviceClient({
      URL: process.env.SELF_URL,
      secureKey: process.env.SECURE_KEY
    });
    client.post({
        accessToken: accessToken,
        ttl: 10,
        scope:[
          {
            service: 'auth',
            methods: {
              get:true,
              post:true,
              put: true,
              search: true,
              delete: true
            },
            values: {
            }
          }
        ]
      }, function(err, handlerResponse){
        accessToken = handlerResponse.accessToken;
        expect(err).to.equal(null);
        expect(handlerResponse.accessToken).to.not.equal(null);
        expect(handlerResponse.expiresAt).to.not.equal(null);
        expect(handlerResponse.ttl).to.not.equal(null);
        done();
    });
  });

  it('SEARCH should return 200',function(done){
    var client = new MicroserviceClient({
      URL: process.env.SELF_URL,
      accessToken: accessToken
    });
    client.search({ "accessToken": accessToken}, function(err, handlerResponse){
      RecordID = handlerResponse[0].id;
      expect(err).to.equal(null);
      expect(handlerResponse).to.not.equal(null);
      done();
    });
  });

  it('SEARCH SCOPE should return 200',function(done){
    var client = new MicroserviceClient({
      URL: process.env.SELF_URL,
      accessToken: accessToken
    });
    client.search({ "accessToken": accessToken, 'scope': 'auth' }, function(err, handlerResponse){
      expect(err).to.equal(null);
      expect(handlerResponse).to.not.equal(null);
      done();
    });
  });

  it('GET should return 200',function(done){
    var client = new MicroserviceClient({
      URL: process.env.SELF_URL,
      accessToken: accessToken
    });
    client.get(RecordID, function(err, handlerResponse){
      expect(err).to.equal(null);
      done();
    });
  });


  it('DELETE should return 200',function(done){
    var client = new MicroserviceClient({
      URL: process.env.SELF_URL,
      accessToken: accessToken
    });
    client.delete(RecordID, function(err, handlerResponse){
      expect(err).to.equal(null);
      done();
    });
  });

  it('GET after delete should return Access Denied',function(done){
    var client = new MicroserviceClient({
      URL: process.env.SELF_URL,
      accessToken: accessToken
    });
    client.get(RecordID, function(err, handlerResponse){
      expect(err).to.not.equal(null);
      done();
    });
  });

});
