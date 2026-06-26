# Config local (no se sube al repo)

1. Edita **`local/.env`** — usuario y contraseña de Atlas (`league_planning` recomendado).
   - Si el usuario es un **email**, codifica `@` como **`%40`**.
   - **Guarda el archivo (Ctrl+S)** antes de ejecutar comandos.

2. Prueba la conexión:

   ```bash
   npm run test:mongo
   ```

3. Inicializa la base (aparte de `park-net`):

   ```bash
   npm run init:mongo
   ```

   Crea la base **`league_planning`** y la colección **`rooms`** con una sala vacía. No hace falta crear nada a mano en Atlas.

4. Copia `MONGODB_URI` y `MONGODB_DB=league_planning` a **Render → Environment**.

Atlas: [cloud.mongodb.com](https://cloud.mongodb.com) → Security → Database Access / Network Access (`0.0.0.0/0` para Render).
