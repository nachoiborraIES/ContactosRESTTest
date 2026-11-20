// Crea y configura una instancia de Express, sin ponerla en marcha

const express = require('express');

const mascotas = require('./routes/mascotas');
const restaurantes = require('./routes/restaurantes');
const contactos = require('./routes/contactos');

const app = express();
app.use(express.json());

app.use('/mascotas', mascotas);
app.use('/restaurantes', restaurantes);
app.use('/contactos', contactos);

// Exportamos la instancia sin llamar a app.listen()
module.exports = app;