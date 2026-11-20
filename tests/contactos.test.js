const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const Contacto = require('../models/contacto');

let mongoServer;

// Antes de empezar todos los tests, levantamos MongoDB en memoria
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
        instance: {
            dbName: 'contactos',
        },
    });
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, { runtimeAdapters: { os } });
}, 30000);

// Antes de cada test individual, limpiamos la colección para evitar interferencias
beforeEach(async () => {
    await Contacto.deleteMany({});
});

// Al terminar todos los tests, cerramos la conexión y paramos el servidor en memoria
afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
});

describe('Endpoints de /contactos', () => {

    // =========================================================================
    // PRUEBAS PARA GET /contactos
    // =========================================================================
    describe('GET /contactos', () => {
        test('Debe devolver 200 y un array vacío si no hay contactos registrados', async () => {
            const res = await request(app).get('/contactos');

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toEqual([]);
        });

        test('Debe devolver 200 y el listado completo de contactos existentes', async () => {
            await Contacto.create([
                { nombre: 'Ana García', telefono: '611223344', edad: 28 },
                { nombre: 'Carlos López', telefono: '655443322', edad: 35 }
            ]);

            const res = await request(app).get('/contactos');

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toHaveLength(2);
        });
    });

    // =========================================================================
    // PRUEBAS PARA GET /contactos/:id
    // =========================================================================
    describe('GET /contactos/:id', () => {
        test('Debe devolver 200 y el contacto correspondiente cuando el ID existe', async () => {
            const contactoCreado = await Contacto.create({
                nombre: 'Laura Martínez',
                telefono: '699887766',
                edad: 31
            });

            const res = await request(app).get(`/contactos/${contactoCreado._id}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado._id).toBe(contactoCreado._id.toString());
            expect(res.body.resultado.nombre).toBe('Laura Martínez');
            expect(res.body.resultado.telefono).toBe('699887766');
            expect(res.body.resultado.edad).toBe(31);
        });

        test('Debe devolver 400 con "No se han encontrado contactos" si el ID es válido pero no existe', async () => {
            const idInexistente = new mongoose.Types.ObjectId();

            const res = await request(app).get(`/contactos/${idInexistente}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('No se han encontrado contactos');
        });

        test('Debe devolver 400 con "Error buscando el contacto indicado" si el ID no tiene formato válido', async () => {
            const res = await request(app).get('/contactos/id-invalido-999');

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Error buscando el contacto indicado');
        });
    });

    // =========================================================================
    // PRUEBAS PARA POST /contactos
    // =========================================================================
    describe('POST /contactos', () => {
        test('Debe crear un nuevo contacto y devolver 200 con los datos guardados', async () => {
            const nuevoContacto = {
                nombre: 'Pedro Sánchez',
                telefono: '600112233',
                edad: 42
            };

            const res = await request(app)
                .post('/contactos')
                .send(nuevoContacto);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toHaveProperty('_id');
            expect(res.body.resultado.nombre).toBe('Pedro Sánchez');
            expect(res.body.resultado.telefono).toBe('600112233');
            expect(res.body.resultado.edad).toBe(42);

            const contactoEnBD = await Contacto.findById(res.body.resultado._id);
            expect(contactoEnBD).not.toBeNull();
        });

        test('Debe devolver 400 si los datos enviados no cumplen las validaciones del modelo', async () => {
            // Enviamos un tipo de dato inválido en edad (string no convertible) o campos obligatorios vacíos
            const res = await request(app)
                .post('/contactos')
                .send({ edad: 'no-es-un-numero' });

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Error añadiendo contacto');
        });
    });

    // =========================================================================
    // PRUEBAS PARA PUT /contactos/:id
    // =========================================================================
    describe('PUT /contactos/:id', () => {
        test('Debe actualizar un contacto existente y devolver 200 con los datos actualizados', async () => {
            const contactoCreado = await Contacto.create({
                nombre: 'Elena Ruiz',
                telefono: '622334455',
                edad: 25
            });

            const datosActualizados = {
                nombre: 'Elena Ruiz Gómez',
                telefono: '622999888',
                edad: 26
            };

            const res = await request(app)
                .put(`/contactos/${contactoCreado._id}`)
                .send(datosActualizados);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado.nombre).toBe('Elena Ruiz Gómez');
            expect(res.body.resultado.telefono).toBe('622999888');
            expect(res.body.resultado.edad).toBe(26);

            // Verificamos el cambio directamente en la base de datos
            const contactoEnBD = await Contacto.findById(contactoCreado._id);
            expect(contactoEnBD.nombre).toBe('Elena Ruiz Gómez');
            expect(contactoEnBD.edad).toBe(26);
        });

        test('Debe devolver 400 con "Contacto no encontrado" si el ID es válido pero no existe', async () => {
            const idInexistente = new mongoose.Types.ObjectId();

            const res = await request(app)
                .put(`/contactos/${idInexistente}`)
                .send({ nombre: 'Nadie', telefono: '600000000', edad: 30 });

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Contacto no encontrado');
        });

        test('Debe devolver 400 con "Error actualizando contacto" si el formato del ID no es válido', async () => {
            const res = await request(app)
                .put('/contactos/id-mal-formado')
                .send({ nombre: 'Test', telefono: '600000000', edad: 30 });

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Error actualizando contacto');
        });
    });

    // =========================================================================
    // PRUEBAS PARA DELETE /contactos/:id
    // =========================================================================
    describe('DELETE /contactos/:id', () => {
        test('Debe eliminar un contacto existente y devolver 200', async () => {
            const contactoCreado = await Contacto.create({
                nombre: 'Miguel Torres',
                telefono: '677889900',
                edad: 40
            });

            const res = await request(app)
                .delete(`/contactos/${contactoCreado._id}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado._id).toBe(contactoCreado._id.toString());

            const contactoEnBD = await Contacto.findById(contactoCreado._id);
            expect(contactoEnBD).toBeNull();
        });

        test('Debe devolver 400 con "Contacto no encontrado" si el ID es válido pero no existe', async () => {
            const idInexistente = new mongoose.Types.ObjectId();

            const res = await request(app)
                .delete(`/contactos/${idInexistente}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Contacto no encontrado');
        });

        test('Debe devolver 400 con "Error eliminando contacto" si el formato del ID no es válido', async () => {
            const res = await request(app)
                .delete('/contactos/id-invalido-delete');

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Error eliminando contacto');
        });
    });
});