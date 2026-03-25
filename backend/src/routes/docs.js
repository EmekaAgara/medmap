const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const router = express.Router();

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MedMap API',
      version: '1.0.0',
    },
    servers: [
      {
        url: '/api/v1',
      },
    ],
  },
  apis: ['src/modules/**/*.routes.js'],
};

const specs = swaggerJsdoc(options);

router.use('/', swaggerUi.serve, swaggerUi.setup(specs));

module.exports = router;

