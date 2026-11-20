const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const Mascota = require('../models/mascota');

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
    await Mascota.deleteMany({});
});

// Al terminar todos los tests, cerramos la conexión y paramos el servidor en memoria
afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
});

describe('Endpoints de /mascotas', () => {

    // =========================================================================
    // PRUEBAS PARA GET /mascotas
    // =========================================================================
    describe('GET /mascotas', () => {
        test('Debe devolver 200 y un array vacío si no hay mascotas registradas', async () => {
            const res = await request(app).get('/mascotas');

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toEqual([]);
        });

        test('Debe devolver 200 y el listado completo de mascotas existentes', async () => {
            // Insertamos datos de prueba directamente con el modelo
            await Mascota.create([
                { nombre: 'Rex', tipo: 'perro' },
                { nombre: 'Misifu', tipo: 'gato' }
            ]);

            const res = await request(app).get('/mascotas');

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toHaveLength(2);
        });
    });

    // =========================================================================
    // PRUEBAS PARA POST /mascotas
    // =========================================================================
    describe('POST /mascotas', () => {
        test('Debe crear una nueva mascota y devolver 200 con los datos guardados', async () => {
            const nuevaMascota = {
                nombre: 'Toby',
                tipo: 'perro'
            };

            const res = await request(app)
                .post('/mascotas')
                .send(nuevaMascota);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado).toHaveProperty('_id');
            expect(res.body.resultado.nombre).toBe('Toby');
            expect(res.body.resultado.tipo).toBe('perro');

            // Verificamos que realmente se guardó en la base de datos
            const mascotaEnBD = await Mascota.findById(res.body.resultado._id);
            expect(mascotaEnBD).not.toBeNull();
        });

        test('Debe devolver 400 si faltan campos obligatorios según el esquema de Mongoose', async () => {
            // Enviamos un objeto vacío o incompleto (asumiendo que nombre/tipo son required en models/mascota.js)
            const res = await request(app)
                .post('/mascotas')
                .send({ nombre: 'SinTipo' });

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Error añadiendo mascota');
        });
    });

    // =========================================================================
    // PRUEBAS PARA DELETE /mascotas/:id
    // =========================================================================
    describe('DELETE /mascotas/:id', () => {
        test('Debe eliminar una mascota existente y devolver 200', async () => {
            const mascotaCreada = await Mascota.create({
                nombre: 'Nemo',
                tipo: 'otros'
            });

            const res = await request(app)
                .delete(`/mascotas/${mascotaCreada._id}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.resultado._id).toBe(mascotaCreada._id.toString());

            // Comprobamos que ya no existe en la BD
            const mascotaEnBD = await Mascota.findById(mascotaCreada._id);
            expect(mascotaEnBD).toBeNull();
        });

        test('Debe devolver 400 con "Mascota no encontrada" si el ID es válido pero no existe', async () => {
            // Generamos un ObjectId válido de MongoDB que no está en la colección
            const idInexistente = new mongoose.Types.ObjectId();

            const res = await request(app)
                .delete(`/mascotas/${idInexistente}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Mascota no encontrada');
        });

        test('Debe devolver 400 con "Error borrando mascota" si el formato del ID no es un ObjectId válido', async () => {
            // Un ID mal formado provoca una CastError en Mongoose que entra en el catch
            const res = await request(app)
                .delete('/mascotas/id-invalido-123');

            expect(res.statusCode).toBe(400);
            expect(res.body.ok).toBe(false);
            expect(res.body.error).toBe('Error borrando mascota');
        });
    });
});