const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const Restaurante = require('../models/restaurante');

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
    await Restaurante.deleteMany({});
});

// Al terminar todos los tests, cerramos la conexión y paramos el servidor en memoria
afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
});

describe('Endpoints de /restaurantes', () => {

    // =========================================================================
    // PRUEBAS PARA GET /restaurantes
    // =========================================================================
    describe('GET /restaurantes', () => {
        test('Debe devolver 200 y un array vacío si no hay restaurantes registrados', async () => {
            const res = await request(app).get('/restaurantes');

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toEqual([]);
        });

        test('Debe devolver 200 y el listado completo de restaurantes existentes', async () => {
            await Restaurante.create([
                { nombre: 'La Tagliatella', direccion: 'Av. Maisonnave 12', telefono: '965112233' },
                { nombre: 'El Buen Comer', direccion: 'C/ San Vicente 45', telefono: '965445566' }
            ]);

            const res = await request(app).get('/restaurantes');

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toHaveLength(2);
        });
    });

    // =========================================================================
    // PRUEBAS PARA POST /restaurantes
    // =========================================================================
    describe('POST /restaurantes', () => {
        test('Debe crear un nuevo restaurante y devolver 200 con los datos guardados', async () => {
            const nuevoRestaurante = {
                nombre: 'Mesón del Puerto',
                direccion: 'Paseo Marítimo 8',
                telefono: '965778899'
            };

            const res = await request(app)
                .post('/restaurantes')
                .send(nuevoRestaurante);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toHaveProperty('_id');
            expect(res.body.resultado.nombre).toBe('Mesón del Puerto');
            expect(res.body.resultado.direccion).toBe('Paseo Marítimo 8');
            expect(res.body.resultado.telefono).toBe('965778899');

            // Verificamos que se haya persistido realmente en la BD
            const restauranteEnBD = await Restaurante.findById(res.body.resultado._id);
            expect(restauranteEnBD).not.toBeNull();
        });

        test('Debe devolver 400 si faltan campos obligatorios según el esquema de Mongoose', async () => {
            // Enviamos un objeto incompleto (asumiendo campos required en models/restaurante.js)
            const res = await request(app)
                .post('/restaurantes')
                .send({ nombre: 'Restaurante Incompleto' });

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Error añadiendo restaurante');
        });
    });

    // =========================================================================
    // PRUEBAS PARA DELETE /restaurantes/:id
    // =========================================================================
    describe('DELETE /restaurantes/:id', () => {
        test('Debe eliminar un restaurante existente y devolver 200', async () => {
            const restauranteCreado = await Restaurante.create({
                nombre: 'Asador Central',
                direccion: 'Plaza Mayor 1',
                telefono: '965001122'
            });

            const res = await request(app)
                .delete(`/restaurantes/${restauranteCreado._id}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado._id).toBe(restauranteCreado._id.toString());

            // Comprobamos que ya no existe en la BD
            const restauranteEnBD = await Restaurante.findById(restauranteCreado._id);
            expect(restauranteEnBD).toBeNull();
        });

        test('Debe devolver 400 con "Restaurante no encontrado" si el ID es válido pero no existe', async () => {
            const idInexistente = new mongoose.Types.ObjectId();

            const res = await request(app)
                .delete(`/restaurantes/${idInexistente}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Restaurante no encontrado');
        });

        test('Debe devolver 400 con "Error borrando restaurante" si el formato del ID no es un ObjectId válido', async () => {
            const res = await request(app)
                .delete('/restaurantes/id-no-valido');

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Error borrando restaurante');
        });
    });
});