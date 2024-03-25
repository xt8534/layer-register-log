const { Logger } = require('@rimac/common');
const { Version3Client, AgileClient } = require('jira.js');
const ExcelJS = require('exceljs');
const path = require('path');
const DataAccess = require('./data-access');

const esLocal = process.env.IS_OFFLINE === 'true';
const stage = process.env.AWS_REGION === 'us-east-2' ? 'TEST' : 'PROD';

const redondearConPrecision = (num) => {
  const m = Number((Math.abs(num) * 100).toPrecision(15));
  return Math.round(m) / (100 * Math.sign(num));
};

const eliminarObjetosDuplicados = (jsonArray) => {
  const data = [...jsonArray];
  const set = new Set(data.map((item) => JSON.stringify(item)));
  return [...set].map((item) => JSON.parse(item));
};

const reemplazarReferenciaCircular = () => {
  const seen = new WeakSet();
  return (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    // eslint-disable-next-line consistent-return
    return value;
  };
};

const serializarJsonCircular = (obj) => {
  const cache = new Set();

  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        // referencia circular encontrada, descartar clave
        return undefined;
      }
      // valor no encontrado, guardarlo en nuestro set
      cache.add(value);
    }
    return value;
  });
};

const validarJsonCircular = (object) => {
  const seenObjects = new WeakSet();

  function detect(obj) {
    if (typeof obj === 'object' && obj !== null) {
      if (seenObjects.has(obj)) {
        return true;
      }
      seenObjects.add(obj);
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (detect(obj[key])) {
          return true;
        }
      }
    }
    return false;
  }

  return detect(object);
};

const obtenerTipoDato = (data = null) => {
  const isJSONObject = (jsonObject) => {
    try {
      JSON.stringify(jsonObject);
      return true;
    } catch (error) {
      return false;
    }
  };

  const isJSON = (jsonData) => {
    try {
      JSON.parse(jsonData);
      return true;
    } catch (error) {
      return false;
    }
  };

  try {
    const dataType = typeof data;

    if (dataType === 'object') {
      if (data === null) {
        return 'null';
      }

      if (data instanceof Error) {
        return 'string';
      }

      if (Array.isArray(data)) {
        return 'array';
      }

      if (data instanceof Date) {
        return 'date';
      }

      if (data instanceof RegExp) {
        return 'regexp';
      }

      if (typeof data[Symbol.iterator] === 'function') {
        return 'iterable';
      }

      if (validarJsonCircular(data)) {
        return 'json_circular';
      }

      if (isJSONObject(data)) {
        return 'json';
      }

      return 'object';
    }

    if (dataType === 'string') {
      if (isJSON(data)) {
        try {
          const parsedData = JSON.parse(data);
          return obtenerTipoDato(parsedData);
        } catch (error) {
          return 'invalid_jSON';
        }
      }
    }

    if (dataType === 'number') {
      if (Number.isNaN(data)) {
        return 'nan';
      }

      if (!Number.isFinite(data)) {
        return 'infinity';
      }
    }

    return dataType;
  } catch (error) {
    // capturar errores de sintaxis y errores al parsear JSON
    if (error instanceof SyntaxError) {
      return 'syntax_error';
    }
    if (error instanceof TypeError) {
      return 'type_error';
    }
    return 'unknown_error';
  }
};

const obtenerValor = (valor) => {
  const tipoDato = obtenerTipoDato(valor);

  switch (tipoDato) {
    case 'string':
      return String(valor);
    case 'json':
      return JSON.stringify(valor);
    case 'json_circular':
      return JSON.stringify(serializarJsonCircular(valor));
    case 'syntax_error':
    case 'type_error':
    case 'unknown_error':
      return String(valor);
    default:
      return valor;
  }
};

const formatearParametrosPdc = (arrayParametros = []) => {
  const listaFormateada = {};

  arrayParametros.forEach((element) => {
    let nomVar = element.codigo || '';
    nomVar = nomVar.split('-')
      .map((item, i) => {
        if (i === 0) {
          return item.toLowerCase();
        }
        return item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
      })
      .reduce((item, acc) => `${item}${acc}`);
    listaFormateada[nomVar] = element.valor;
  });

  return listaFormateada;
};

const textoMinusculasConEspacios = (texto = '') => {
  // Convertir todo a minúsculas
  let nuevoTexto = texto.toLowerCase();

  // Reemplazar caracteres extraños
  nuevoTexto = nuevoTexto.replace(/[=]/g, '');

  // Convertir la primera letra de cada oración en mayúscula
  nuevoTexto = nuevoTexto.replace(/(^\w{1}|\.\s*\w{1})/g, (c) => c.toUpperCase());

  // Agregar espacio después de punto, coma y punto y coma
  nuevoTexto = nuevoTexto.replace(/([.,;])/g, '$1 ');

  // Reemplazar "_" con "_"
  nuevoTexto = nuevoTexto.replace(/(\b\w+_+\w+\b)/g, (c) => c);

  // Agregar un punto al final si no lo tiene
  if (nuevoTexto.charAt(nuevoTexto.length - 1) !== '.') {
    nuevoTexto += '.';
  }

  return nuevoTexto;
};

const setConfigClientJira = async () => {
  try {
    const credentials = await DataAccess.obtenerComParametro({ codParametro: 'JIRA_CREDENCIALES' });
    const userJira = credentials.find((e) => e.codigo === 'JIRA-CORREO').valor;
    const tokenJira = credentials.find((e) => e.codigo === 'JIRA-TOKEN').valor;
    const jiraDominioUrl = credentials.find((e) => e.codigo === 'JIRA-DOMINIO').valor;

    if (!userJira) {
      return null;
    }

    if (!tokenJira) {
      return null;
    }

    if (!jiraDominioUrl) {
      return null;
    }

    return {
      host: jiraDominioUrl,
      authentication: {
        basic: {
          email: userJira,
          apiToken: tokenJira,
        },
      },
    };
  } catch (e) {
    Logger.info(e);
    return null;
  }
};

const jiraClientV3 = async () => {
  try {
    const credential = await setConfigClientJira();
    return new Version3Client(credential);
  } catch (e) {
    Logger.info(e);
    return null;
  }
};

const agileClient = async () => {
  try {
    const credential = await setConfigClientJira();
    return new AgileClient(credential);
  } catch (e) {
    Logger.info(e);
    return null;
  }
};

const esJsonObjectValido = (string) => {
  try {
    const parsedObject = JSON.parse(string);
    return typeof parsedObject === 'object' && parsedObject !== null;
  } catch (error) {
    return false;
  }
};

const parseJSON = (string) => {
  try {
    if (esJsonObjectValido(string)) {
      return JSON.parse(string);
    }

    return string;
  } catch (error) {
    Logger.error(error);
    return null;
  }
};

const camelToSnakeCase = (str) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).toUpperCase();

const generarExcel = async (data, options = {}) => {
  const { convertKeys = true, outputPath = '/file.xlsx', saveToFile = false } = options;

  try {
    if (!data || !data.length || data.length === 0) {
      return null;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    // obtener encabezados (keys) del primer objeto
    const headers = Object.keys(data[0]).map((key) => {
      return {
        header: convertKeys ? camelToSnakeCase(key).toUpperCase() : key,
        key,
      };
    });

    worksheet.columns = headers;

    // agrega las filas de datos
    data.forEach((item) => {
      worksheet.addRow(item);
    });

    if (saveToFile) {
      const fullPath = path.join(process.cwd(), outputPath);

      await workbook.xlsx.writeFile(fullPath);

      return { path: outputPath };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      base64: buffer.toString('base64'),
    };
  } catch (error) {
    Logger.error(error);
    return null;
  }
};

module.exports = {
  UTILS: {
    redondearConPrecision,
    eliminarObjetosDuplicados,
    reemplazarReferenciaCircular,
    serializarJsonCircular,
    obtenerTipoDato,
    obtenerValor,
    formatearParametrosPdc,
    textoMinusculasConEspacios,
    parseJSON,
  },
  Excel: {
    generarExcel,
  },
  Jira: {
    jiraClientV3,
    agileClient,
  },
  esLocal,
  stage,
};
