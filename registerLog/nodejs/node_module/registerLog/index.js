const awsSdk = require('aws-sdk');
const momentTime = require('moment-timezone');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { UTILS } = require('./util.support');
const { TIMEZONE_AMERICA_LIMA, YYYY_MM_DD_HH_MM_SS } = require('./constants/common.constants');

module.exports = {
  
  async sensorizeLambdasRequest(payload) {
    const serverlessOffline = process.env.IS_OFFLINE === 'true';

    console.info('Payload para Tema SNS:');
    console.info(JSON.stringify(payload));

    if (serverlessOffline) {
      return {
        statusCode: 200,
        respuesta: 'no-ref',
      };
    }

    const {
      INCIDENTE: numeroIncidente = null,
      INCIDENTE_JIRA: numeroIncidenteJira = null,
      RECURSOS_EXTERNOS: recursosExternos = null,
      OPERACION: operacion = null,
      BROKER_USERNAME: usuarioBroker,
      SNS_REGISTRO_EVENTOS: topicArn,
      BROKER_ID: idBroker,
      BROKER_IDECANAL: idBrokerCanal,
      BROKER_IDEVENDEDOR: idBrokerVendedor,
      BROKER_USUARIOSAS: usuarioBrokerSas,
      BROKER_NAME: nombreBroker,
    } = process.env;

    let nombreLambda = null;
    let logGroupCloudwatch = null;
    let logStreamCloudwatch = null;

    if (serverlessOffline) {
      nombreLambda = 'LAMBDA-SLS-OFFLINE';
      logGroupCloudwatch = 'LOG_GROUP-SLS-OFFLINE';
      logStreamCloudwatch = 'LOG_STREAM-SLS-OFFLINE';
    } else {
      nombreLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;
      logGroupCloudwatch = process.env.AWS_LAMBDA_LOG_GROUP_NAME;
      logStreamCloudwatch = process.env.AWS_LAMBDA_LOG_STREAM_NAME;
    }

    if (!topicArn || !nombreLambda) {
      console.error('Faltan variables de entorno necesarias.');
      return {
        statusCode: 500,
        respuesta: 'Error de configuración',
      };
    }

    try {
      const {
        logType = 'TRACE', event = {}, response = {}, error = {},
      } = payload;

      if (logType !== 'TRACE' && logType !== 'ERROR') {
        console.error('Tipo de log inválido.');
        return {
          statusCode: 400,
          respuesta: 'Tipo de log inválido',
        };
      }

      const {
        action = '', body = '', headers = {}, identity = {}, domainName = '', path = '', requestId = '', httpMethod = '',
      } = event;

      console.info('Event para Tema SNS:');
      console.info(JSON.stringify(event));

      const trazabilidadId = uuidv4();
      const operationId = uuidv4();

      const datosCanal = {
        id_broker: idBroker,
        id_broker_Canal: idBrokerCanal,
        id_broker_vendedor: idBrokerVendedor,
        usuario_broker_sas: usuarioBrokerSas,
        nombre_broker: nombreBroker,
        numero_incidente: numeroIncidente,
        numero_incidente_jira: numeroIncidenteJira,
      };

      const PayloadCanal = {
        operacion,
        nombre_lambda: nombreLambda,
        accion: action,
        request_id: requestId,
        log_group_cloudwatch: logGroupCloudwatch,
        log_stream_cloudwatch: logStreamCloudwatch,
        consulta: UTILS.parseJSON(body),
        respuesta: logType === 'ERROR' ? UTILS.parseJSON(error) : UTILS.parseJSON(response),
      };

      const procedencia = {
        web_origen: headers.origin || 'desconocido',
        web_url: headers.Referer || 'desconocido',
        navegador: headers['User-Agent'] || 'desconocido',
        visor_escritorio: headers['CloudFront-Is-Desktop-Viewer'] || 'desconocido',
        visor_movil: headers['CloudFront-Is-Mobile-Viewer'] || 'desconocido',
        visor_tv: headers['CloudFront-Is-SmartTV-Viewer'] || 'desconocido',
        visor_tablet: headers['CloudFront-Is-Tablet-Viewer'] || 'desconocido',
        pais: headers['CloudFront-Viewer-Country'] || 'desconocido',
      };

      const mensaje = {
        usuario_sesion: headers['id-client'] || 'desconocido',
        trazabilidad_id: trazabilidadId,
        operation_id: operationId,
        log_type: logType,
        fecha: momentTime().tz(TIMEZONE_AMERICA_LIMA).format(YYYY_MM_DD_HH_MM_SS),
        usuario: usuarioBroker,
        nombre_canal: 'brokers',
        datos_canal: datosCanal,
        payload_canal: PayloadCanal,
        recursos_externos: UTILS.parseJSON(recursosExternos),
        procedencia,
        ip_visitante: identity.sourceIp || 'desconocida',
        metodo_http: httpMethod,
        host_servicio: domainName,
        url_servicio: path,
      };

      // Define OpenTelemetry format
      const OpenTelemetryMessage = {
        Timestamp: new Date().toISOString(),
        ObservedTimestamp:new Date().toISOString(),
        TraceId:trazabilidadId,
        SpanId:null || undefined,
        TraceFlags:null || undefined,
        SeverityText: logType,
        SeverityNumber:logType === 'ERROR'? 17: logType === 'TRACE'? 2 : null,
        Body: UTILS.parseJSON(mensaje),
        Resource: {         
          host_name: domainName
        },
        InstrumentationScope: null || undefined,
        Attributes: {
          http_method: httpMethod,
        }
      };

      console.info('Mensaje para Tema SNS:');
      console.info(JSON.stringify(mensaje));

      const inicio = moment();
      console.info(`Fecha de inicio: ${inicio.format(YYYY_MM_DD_HH_MM_SS)}`);

      await module.exports.sendMessageAwsSns(topicArn, OpenTelemetryMessage);

      const fin = moment();
      console.info(`Fecha de fin: ${fin.format(YYYY_MM_DD_HH_MM_SS)}`);
      const tiempoTranscurrido = moment.duration(fin.diff(inicio));
      console.info(`Tiempo transcurrido: ${tiempoTranscurrido.asMilliseconds()} ms`);

      return {
        statusCode: 200,
        respuesta: 'OK',
      };
    } catch (error) {
      console.error('----- ERROR EN MONITOREO -----');
      console.error(`respuesta: ${error}`);

      const fin = moment();
      console.info('Fecha de fin:', fin.format('YYYY-MM-DD HH:mm:ss'));

      return {
        statusCode: 500,
        respuesta: 'Error',
      };
    }
  },
  
  sensorizeExternalInvocation(nombreVariable, objeto) {
    try {
      if (!process.env[nombreVariable] || process.env[nombreVariable] === undefined || process.env[nombreVariable] === 'undefined') {
        process.env[nombreVariable] = '[]';
      }

      if (typeof objeto !== 'object' || objeto === null || Array.isArray(objeto)) {
        console.error('El objeto proporcionado no es un objeto JSON válido');
        return false;
      }

      let listaActual = process.env[nombreVariable];
      listaActual = JSON.parse(listaActual);

      if (!Array.isArray(listaActual)) {
        console.error('La variable de entorno no contiene un arreglo válido');
        return false;
      }

      console.info(`Insertar valor a process.env.${nombreVariable}: ${JSON.stringify(objeto)}`);
      listaActual.push(objeto);

      process.env[nombreVariable] = JSON.stringify(listaActual);

      return true;
    } catch (error) {
      console.error(`Error al modificar la variable de entorno ${nombreVariable}: ${error}`);
      return false;
    }
  },

  async sendMessageAwsSns(topicArn, message, messageAttributes = null) {
    try {
      console.info('----- SNS REQUEST -----');
      console.info(`topicArn: ${JSON.stringify(topicArn)}`);
      console.info(`message: ${JSON.stringify(message)}`);
      console.info(`messageAttributes: ${JSON.stringify(messageAttributes)}`);

      const sns = new awsSdk.SNS();

      let messageString = null;
      if (typeof message === 'string') {
        messageString = message;
      } else if (typeof message === 'object' && message !== null) {
        messageString = JSON.stringify(message);
      } else {
        messageString = String(message);
      }

      const params = {
        Message: messageString,
        TopicArn: topicArn,
      };

      if (messageAttributes) {
        params.MessageAttributes = messageAttributes;
      }

      console.info('----- SNS PARAMS -----');
      console.info(`${JSON.stringify(params)}`);

      const data = await sns.publish(params).promise();

      console.info('----- SNS RESPONSE -----');
      console.info(`${JSON.stringify(data)}`);

      return {
        messageId: data.MessageId,
      };
    } catch (error) {
      console.info('----- SNS ERROR -----');
      console.info(`Error: ${error}`);
      return {
        messageId: null,
      };
    }
  },
};
