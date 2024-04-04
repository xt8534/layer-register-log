const parseJSON = (string) => {
  try {
    if (esJsonObjectValido(string)) {
      return JSON.parse(string);
    }

    return string;
  } catch (error) {
   console.log("error",error);
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

module.exports = {
  UTILS: {
    parseJSON,
  },
};
