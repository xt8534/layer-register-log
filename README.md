# Functions: sensorize-lambdas
The program to sensorize lambdas contains two functions:
*`sensorizeLambdasRequest()`main function to sensorize lambdas request.
*`collectLambdaExternalInvocationData()` support function to collect external invocation data and  add it to the function  sensorizeLambdasRequest().
# Usage
```
const sensorLambda = require('sensorize-lambdas'); or
import sensorLambda = from 'sensorize-lambdas';
```

### Implementation in projects that do not use middleware:  
```sh
    try {

     const { originalEvent, event, response } = request;

     sensorLambda.sensorizeLambdasRequest({ logType: 'TRACE', event: event,response });

    } catch (error) {

    sensorLambda.sensorizeLambdasRequest({ logType: 'ERROR', event: event, error: error.message });

    }
```

### Implementation in projects that use middleware:

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

      sensorLambda.sensorizeLambdasRequest({ logType: 'TRACE', event: originalEvent, response });

    } catch (error) {

      Logger.info(`Error en 'after': ${error.message}`);
    }
  };

  const onError = async (request) => {

    try {
      const { originalEvent, error } = request;

      if (error) {

        sensorLambda.sensorizeLambdasRequest({ logType: 'ERROR', event: originalEvent, error: errorInfo });

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

### Implementation support function
`collectLambdasExternalInvocation()`:

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

      sensorLambda.collectLambdaExternalInvocationData(EXTERNAL_INVOCATION_DATA, externalInvocationData);

      return data.payload;

    } catch (error) {
      
      externalInvocationData.response = error;

      sensorLambda.collectLambdaExternalInvocationData(EXTERNAL_INVOCATION_DATA, externalInvocationData);
    }
  },
```
#### note:
```sh
Environment variable: EXTERNAL_INVOCATION_DATA
```
## Authors

- Juan Rojas Rojas (juan.rojas@rimac.com.pe)
- Cesar Alfaro Mendivel (xt8534@rimac.com.pe)

