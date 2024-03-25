# layer-register-log
Layer que contiene dos funciones: 
- monitorearEventos para monitorear datos de entrada del handler.
- agregarAListaDeVariablesDeEntorno para gestionar datos de invocaciones a recursos externos.
## Usage
---
const registerLog = require('../registerLog');
---
### En caso se esta usando middware como middyjs:
---
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
      registerLog.monitorearEventos({ logType: 'TRACE', event: originalEvent, response });
    } catch (error) {
      Logger.info(`Error en 'after': ${error.message}`);
    }
  };

  const onError = async (request) => {
    try {
      const { originalEvent, error } = request;

      if (error) {
        registerLog.monitorearEventos({ logType: 'ERROR', event: originalEvent, error: errorInfo });
      } else {
        after(request);
      }
    } catch (catchError) {
      Logger.info(`Error en 'onError': ${catchError.message}`);
    }
  };

  return {
    before,
    after,
    onError,
  };
};

module.exports = {
  EventLoggerMiddleware,
};
---
### En caso no se usa middware:  
    try {
     const { originalEvent, event, response } = request;

      registerLog.monitorearEventos({ logType: 'TRACE', event: event, response });
    } catch (error) {
      registerLog.monitorearEventos({ logType: 'ERROR', event: event, error: error.message });
    }
---

Author:
-Juan Rojas.
-César Alfaro.