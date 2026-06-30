# Migraciones de Supabase

Guardar aqui cada cambio futuro de la base de datos con nombres consecutivos:

`001-descripcion.sql`, `002-descripcion.sql`, etc.

No editar una migracion que ya fue ejecutada. Crear una nueva permite saber
exactamente que cambio se aplico y evita reiniciar la informacion existente.

## Migraciones

- `001-acceso-por-codigo.sql`: conserva la fila `main`, elimina la lectura
  directa y obliga a validar un codigo de perfil para leer o guardar.
