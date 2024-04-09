# layer-register-log
Library or Layer that contains two functions:
 --`sensorizeLambdasRequest()`main function to sensorize lambdas request.
--`collectLambdaExternalInvocationData()` support function to collect external invocation data and  add it to the function  sensorizeLambdasRequest().
## Usage
```
const registerLog = require('../registerLog');
```
### In case it is used middeware:

```sh
const EventLoggerMiddleware = () => {
  const before = async (request) => {
    try {
      const { event } = request;     
      request.originalEvent = event;
    } catch (error) {
      Logger.info(`Error en 'before': ${error.message}`);
    }
  };
  
  const after = async (request) => {
    try {

      const { originalEvent, event, response } = request;

      registerLog.sensorizeLambdasRequest({ logType: 'TRACE', event: originalEvent, response });

    } catch (error) {

      Logger.info(`Error en 'after': ${error.message}`);
    }
  };

  const onError = async (request) => {

    try {
      const { originalEvent, error } = request;

      if (error) {

        registerLog.sensorizeLambdasRequest({ logType: 'ERROR', event: originalEvent, error: errorInfo });

      } else {

        after(request);
      }
    } catch (catchError) {

      Logger.info(`Error en 'onError': ${catchError.message}`);
    }
  };
  
  return {before, after,onError,  };
  
};

module.exports = {  EventLoggerMiddleware};

```
### In case not used moddware:  
```sh
    try {

     const { originalEvent, event, response } = request;

      registerLog.sensorizeLambdasRequest({ logType: 'TRACE', event: event, response });

    } catch (error) {

      registerLog.sensorizeLambdasRequest({ logType: 'ERROR', event: event, error: error.message });

    }
```
### implementation:
`collectLambdasExternalInvocation` function:
```sh
async invokeFunctionSync(functionName, payload, action, config = {}) {
   
    const externalInvocationData = {
      name: functionName,
      accion: action,
      request: payload,
      response: null,
    };

    try {
      const lambda = new AWS.Lambda(config);

      const data = await lambda.invokeFunctionSync({functionName, payload, action });

      externalInvocationData.response = data;

      registerLog.collectLambdaExternalInvocationData(EXTERNAL_INVOCATION_DATA, externalInvocationData);

      return data.payload;

    } catch (error) {
      
      externalInvocationData.response = error;

      module.exports.collectLambdaExternalInvocationData(EXTERNAL_INVOCATION_DATA, externalInvocationData);

     
    }
  },
```
Author:
-Juan Rojas.
-César Alfaro.