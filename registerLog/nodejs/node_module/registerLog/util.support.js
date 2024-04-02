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

module.exports = {
  UTILS: {
    parseJSON,
  },
};
